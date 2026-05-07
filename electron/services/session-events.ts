import type { HermesBridgeStatus, HermesSessionEvent, HermesSessionEventQuery } from "../../src/types";
import { safeParseHermesSessionEventQuery } from "./schemas";

const MAX_SESSION_EVENTS = 500;

let sessionEvents: HermesSessionEvent[] = [];
let lastEventAt: number | null = null;

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

export function recordSessionEvent(event: HermesSessionEvent) {
  sessionEvents = [...sessionEvents, event].slice(-MAX_SESSION_EVENTS);
  lastEventAt = event.emittedAt;
}

export function listSessionEvents(query: HermesSessionEventQuery): HermesSessionEvent[] {
  const normalizedQuery = normalizeSessionEventQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const derivedSessionId = getDerivedSessionId(normalizedQuery);
  const filteredEvents = sessionEvents.filter((event) => {
    if (derivedSessionId && event.sessionId !== derivedSessionId) {
      return false;
    }

    if (normalizedQuery.turnId && event.turnId !== normalizedQuery.turnId) {
      return false;
    }

    return true;
  });

  if (normalizedQuery.limit === undefined || normalizedQuery.limit >= filteredEvents.length) {
    return filteredEvents;
  }

  return filteredEvents.slice(-normalizedQuery.limit);
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
