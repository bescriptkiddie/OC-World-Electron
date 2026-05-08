import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HermesBridgeStatus, HermesSessionEvent, HermesSessionEventQuery } from "../../src/types";
import { resolveOcDataPath } from "../capabilities/storage-paths";
import { safeParseHermesSessionEventQuery } from "./schemas";

const MAX_SESSION_EVENTS = 500;

let sessionEvents: HermesSessionEvent[] = [];
let lastEventAt: number | null = null;

function resolveTurnEventPath(sessionId: string, turnId: string, dataRoot?: string) {
  return resolveOcDataPath(dataRoot, "session-events", "turns", sessionId, `${turnId}.jsonl`);
}

async function ensureParentDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readStoredTurnEvents(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as HermesSessionEvent];
        } catch {
          return [];
        }
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as HermesSessionEvent[];
    }

    throw error;
  }
}

async function readStoredSessionEvents(sessionId: string, dataRoot?: string) {
  const sessionDir = resolveOcDataPath(dataRoot, "session-events", "turns", sessionId);
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(sessionDir);
    const eventGroups = await Promise.all(files.filter((file) => file.endsWith(".jsonl")).map((file) => readStoredTurnEvents(path.join(sessionDir, file))));
    return eventGroups.flat().sort((left, right) => left.emittedAt - right.emittedAt);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [] as HermesSessionEvent[];
    }

    throw error;
  }
}

function getDerivedSessionId(query: HermesSessionEventQuery) {
  if (query.sessionId) {
    return query.sessionId;
  }

  if (query.userId && query.characterId) {
    return `${query.userId}:${query.characterId}`;
  }

  return null;
}

function normalizeSessionEventQuery(query: HermesSessionEventQuery) {
  const parsedQuery = safeParseHermesSessionEventQuery(query);

  if (!parsedQuery.success) {
    return null;
  }

  return parsedQuery.data;
}

function filterEvents(events: HermesSessionEvent[], query: HermesSessionEventQuery) {
  const derivedSessionId = getDerivedSessionId(query);
  const filteredEvents = events.filter((event) => {
    if (derivedSessionId && event.sessionId !== derivedSessionId) {
      return false;
    }

    if (query.turnId && event.turnId !== query.turnId) {
      return false;
    }

    return true;
  });

  if (query.limit === undefined || query.limit >= filteredEvents.length) {
    return filteredEvents;
  }

  return filteredEvents.slice(-query.limit);
}

export async function recordSessionEvent(event: HermesSessionEvent, dataRoot?: string) {
  sessionEvents = [...sessionEvents, event].slice(-MAX_SESSION_EVENTS);
  lastEventAt = event.emittedAt;

  const filePath = resolveTurnEventPath(event.sessionId, event.turnId, dataRoot);
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
}

export async function recordTurnEvent(event: HermesSessionEvent, dataRoot?: string) {
  await recordSessionEvent(event, dataRoot);
}

export async function listSessionEvents(query: HermesSessionEventQuery, dataRoot?: string): Promise<HermesSessionEvent[]> {
  const normalizedQuery = normalizeSessionEventQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const inMemoryEvents = filterEvents(sessionEvents, normalizedQuery);
  if (inMemoryEvents.length) {
    return inMemoryEvents;
  }

  const derivedSessionId = getDerivedSessionId(normalizedQuery);
  if (!derivedSessionId) {
    return [];
  }

  if (normalizedQuery.turnId) {
    const storedEvents = await readStoredTurnEvents(resolveTurnEventPath(derivedSessionId, normalizedQuery.turnId, dataRoot));
    return filterEvents(storedEvents, normalizedQuery);
  }

  const storedEvents = await readStoredSessionEvents(derivedSessionId, dataRoot);
  return filterEvents(storedEvents, normalizedQuery);
}

export function getSessionEventBridgeStatus(): HermesBridgeStatus {
  return {
    connected: lastEventAt !== null,
    transport: "plugin",
    lastEventAt,
  };
}

export function resetSessionEventsForTests() {
  sessionEvents = [];
  lastEventAt = null;
}
