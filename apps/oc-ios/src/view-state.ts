import type { ChatHistoryEntry } from "../../../src/types";

export type IosChatMessage = {
  id: string;
  role: "user" | "oc";
  text: string;
};

export function toChatMessages(history: ChatHistoryEntry[]): IosChatMessage[] {
  return history.flatMap((entry) => [
    {
      id: `${entry.timestamp}-user`,
      role: "user" as const,
      text: entry.userMessage,
    },
    {
      id: `${entry.timestamp}-oc`,
      role: "oc" as const,
      text: entry.ocResponse,
    },
  ]);
}

export function resolveStatusText(input: { greeting: string; revealText: string | null }) {
  return input.revealText || input.greeting;
}
