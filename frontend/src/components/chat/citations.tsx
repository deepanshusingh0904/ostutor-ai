"use client";
import { useEffect, useState } from "react";
import { BookText, ChevronDown, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/lib/types";
import { cn } from "@/lib/utils";

function scoreVariant(score: number): "success" | "warning" | "secondary" {
  if (score >= 0.6) return "success";
  if (score >= 0.35) return "warning";
  return "secondary";
}

export function Citations({ citations, focusIndex }: { citations: Citation[]; focusIndex?: number | null }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex) {
      setOpen(true);
      setExpanded(focusIndex);
    }
  }, [focusIndex]);

  if (!citations.length) return null;
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <BookText className="size-3.5" aria-hidden />
        {citations.length} source{citations.length > 1 ? "s" : ""} from approved material
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {citations.map((c) => (
            <li key={`${c.document_id}-${c.index}`} className={cn("rounded-xl border border-border bg-card", expanded === c.index && "ring-2 ring-primary/40")}>
              <button
                onClick={() => setExpanded(expanded === c.index ? null : c.index)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                aria-expanded={expanded === c.index}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">{c.index}</span>
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.document_name}</span>
                <Badge variant="outline">Page {c.page}</Badge>
                <Badge variant={scoreVariant(c.score)} title="Similarity score">{Math.round(c.score * 100)}% match</Badge>
              </button>
              {expanded === c.index && (
                <blockquote className="mx-3 mb-3 max-h-56 overflow-y-auto border-l-2 border-primary/50 pl-3 text-sm leading-6 text-muted-foreground scroll-thin">
                  {c.text}
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
