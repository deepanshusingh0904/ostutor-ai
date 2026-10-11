import { API_URL } from "./constants";
import { getToken } from "./auth-store";
import type { StreamEvent } from "./types";

/** Parse as many complete SSE "data:" events as possible; returns the events and the unconsumed remainder. */
export function parseSSE(buffer: string): { events: StreamEvent[]; rest: string } {
  const events: StreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const line = part
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("");
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as StreamEvent);
    } catch {
      /* ignore malformed frames */
    }
  }
  return { events, rest };
}

export interface StreamBody {
  action: "send" | "regenerate" | "edit" | "continue";
  content?: string;
  message_id?: number;
}

export async function streamChat(
  conversationId: number,
  body: StreamBody,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat/conversations/${conversationId}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = "The tutor could not be reached.";
    try {
      detail = (await response.json()).detail ?? detail;
    } catch {
      /* keep default */
    }
    onEvent({ type: "error", message: detail });
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSSE(buffer);
    buffer = parsed.rest;
    parsed.events.forEach(onEvent);
  }
  if (buffer.trim()) parseSSE(`${buffer}\n\n`).events.forEach(onEvent);
}
