import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="OSTutor AI home">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="leading-none">
        <span className="block font-display text-lg font-semibold tracking-tight">OSTutor AI</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">Your Personal AI Professor</span>
      </span>
    </Link>
  );
}
