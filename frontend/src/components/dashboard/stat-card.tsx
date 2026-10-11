import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ icon: Icon, label, value, hint, tone = "primary" }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: string; tone?: "primary" | "accent" | "success" }) {
  const tones = { primary: "bg-primary/12 text-primary", accent: "bg-accent/20 text-accent-foreground dark:text-accent", success: "bg-success/15 text-success" };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 place-items-center rounded-xl", tones[tone])}><Icon className="size-5" aria-hidden /></span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
