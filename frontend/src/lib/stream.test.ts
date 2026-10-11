import { describe, expect, it } from "vitest";
import { parseSSE } from "./stream";

describe("parseSSE", () => {
  it("parses complete frames and keeps the remainder", () => {
    const buffer = 'data: {"type":"token","content":"Hel"}\n\ndata: {"type":"token","content":"lo"}\n\ndata: {"type":"to';
    const { events, rest } = parseSSE(buffer);
    expect(events).toEqual([
      { type: "token", content: "Hel" },
      { type: "token", content: "lo" },
    ]);
    expect(rest).toBe('data: {"type":"to');
  });

  it("ignores malformed frames", () => {
    const { events } = parseSSE("data: not-json\n\ndata: {\"type\":\"done\",\"message_id\":1,\"content\":\"x\",\"title\":\"t\"}\n\n");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });
});
