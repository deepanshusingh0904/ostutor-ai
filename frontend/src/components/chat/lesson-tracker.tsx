import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const LESSON_STAGES = [
  "Definition", "Simple explanation", "Detailed explanation", "Real-life example", "Analogy", "Visualization", "Flowchart",
  "Diagram", "Numerical", "Quiz", "Interview questions", "Summary", "Next topic",
];
const GROUP_SIZES = [2, 2, 3, 2, 2, 2];

/** Shows how far through the 13-stage teaching flow the current lesson is, based on professor turns taken. */
export function LessonTracker({ turns }: { turns: number }) {
  const covered = GROUP_SIZES.slice(0, Math.min(turns, GROUP_SIZES.length)).reduce((a, b) => a + b, 0);
  return (
    <div className="mb-2 flex items-center gap-1" role="img" aria-label={`Lesson progress: ${covered} of ${LESSON_STAGES.length} stages covered`}>
      {LESSON_STAGES.map((stage, i) => (
        <span
          key={stage}
          title={`${stage}${i < covered ? " (covered)" : ""}`}
          className={cn("grid h-5 flex-1 place-items-center rounded-full text-[10px] transition-colors", i < covered ? "bg-primary text-primary-foreground" : "bg-muted text-transparent")}
        >
          {i < covered ? <Check className="size-3" aria-hidden /> : "."}
        </span>
      ))}
    </div>
  );
}
