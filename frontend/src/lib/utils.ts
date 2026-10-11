import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDate(value: string): string {
  return new Date(`${value}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(value: string, now: Date = new Date()): string {
  const then = new Date(value.endsWith("Z") ? value : `${value}Z`);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface Groupable {
  pinned: boolean;
  updated_at: string;
}

/** Group conversations the way chat apps do: Pinned, Today, Yesterday, Previous 7 days, Older. */
export function groupByRecency<T extends Groupable>(items: T[], now: Date = new Date()): { label: string; items: T[] }[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const buckets: Record<string, T[]> = { Pinned: [], Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  for (const item of items) {
    if (item.pinned) {
      buckets.Pinned.push(item);
      continue;
    }
    const t = new Date(item.updated_at.endsWith("Z") ? item.updated_at : `${item.updated_at}Z`).getTime();
    if (t >= startOfToday) buckets.Today.push(item);
    else if (t >= startOfToday - day) buckets.Yesterday.push(item);
    else if (t >= startOfToday - 7 * day) buckets["Previous 7 days"].push(item);
    else buckets.Older.push(item);
  }
  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function scoreColor(percent: number): string {
  if (percent >= 75) return "text-success";
  if (percent >= 50) return "text-accent";
  return "text-destructive";
}

/** Escape a Mermaid source so a broken streamed diagram never throws in the UI. */
export function normalizeMermaid(code: string): string {
  return code.replace(/\r\n/g, "\n").replace(/^\s*```(?:mermaid)?\s*|\s*```\s*$/g, "").trim();
}

export function downloadText(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
