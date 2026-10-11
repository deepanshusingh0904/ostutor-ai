import { describe, expect, it } from "vitest";
import { cn, formatBytes, formatMinutes, groupByRecency, initials, normalizeMermaid, relativeTime, truncate } from "./utils";

describe("utils", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });

  it("formats sizes and durations", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(125)).toBe("2 h 5 min");
  });

  it("truncates and builds initials", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(initials("Test Student Person")).toBe("TS");
  });

  it("describes relative time", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(relativeTime("2026-01-10T11:59:40", now)).toBe("just now");
    expect(relativeTime("2026-01-10T11:00:00", now)).toBe("1 h ago");
    expect(relativeTime("2026-01-08T12:00:00", now)).toBe("2 d ago");
  });

  it("groups conversations by recency with pinned first", () => {
    const now = new Date(2026, 0, 10, 15, 0, 0);
    const iso = (d: Date) => d.toISOString().replace("Z", "");
    const items = [
      { id: 1, pinned: true, updated_at: iso(new Date(2025, 5, 1)) },
      { id: 2, pinned: false, updated_at: iso(new Date(2026, 0, 10, 9)) },
      { id: 3, pinned: false, updated_at: iso(new Date(2026, 0, 9, 9)) },
      { id: 4, pinned: false, updated_at: iso(new Date(2025, 11, 1)) },
    ];
    const groups = groupByRecency(items, now);
    expect(groups.map((g) => g.label)).toEqual(["Pinned", "Today", "Yesterday", "Older"]);
  });

  it("strips mermaid fences", () => {
    expect(normalizeMermaid("```mermaid\nflowchart TD\n A-->B\n```")).toBe("flowchart TD\n A-->B");
  });
});
