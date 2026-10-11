"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ language, text, children }: { language: string; text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language || "text"}</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Copy code">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-4 font-mono text-[13px] leading-6">{children}</pre>
    </div>
  );
}
