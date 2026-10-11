import { Progress } from "@/components/ui/progress";
import type { TopicStat } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TopicList({ topics, empty, tone }: { topics: TopicStat[]; empty: string; tone: "weak" | "strong" }) {
  if (!topics.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-4">
      {topics.map((t) => (
        <li key={t.topic}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{t.topic}</span>
            <span className={cn("shrink-0 font-semibold", tone === "weak" ? "text-destructive" : "text-success")}>{t.accuracy}%</span>
          </div>
          <Progress value={t.accuracy} label={`${t.topic} accuracy`} className={tone === "weak" ? "[&>div]:bg-destructive" : "[&>div]:bg-success"} />
        </li>
      ))}
    </ul>
  );
}
