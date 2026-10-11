"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Check, Code2, Copy, Download, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, normalizeMermaid } from "@/lib/utils";

type MermaidApi = typeof import("mermaid")["default"];
let mermaidPromise: Promise<MermaidApi> | null = null;
let renderQueue: Promise<unknown> = Promise.resolve();
let counter = 0;

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import("mermaid").then((m) => m.default);
  return mermaidPromise;
}

/** Renders Mermaid source to SVG. Calls are serialised because Mermaid is not safe to run concurrently. */
async function renderDiagram(code: string, dark: boolean): Promise<string> {
  const run = async () => {
    const mermaid = await loadMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "neutral",
      fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif",
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    const valid = await mermaid.parse(code, { suppressErrors: true });
    if (!valid) throw new Error("invalid");
    const id = `mmd-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, code);
      return svg;
    } finally {
      document.getElementById(`d${id}`)?.remove();
      document.getElementById(id)?.remove();
    }
  };
  const result = renderQueue.then(run, run);
  renderQueue = result.catch(() => undefined);
  return result;
}

function DiagramCanvas({ svg, height }: { svg: string; height: string }) {
  return (
    <TransformWrapper minScale={0.3} maxScale={6} centerOnInit wheel={{ step: 0.15 }} doubleClick={{ mode: "zoomIn" }}>
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className="relative">
          <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomIn()} aria-label="Zoom in"><ZoomIn /></Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomOut()} aria-label="Zoom out"><ZoomOut /></Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => resetTransform()} aria-label="Reset view"><RotateCcw /></Button>
          </div>
          <TransformComponent wrapperStyle={{ width: "100%", height }} contentStyle={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <div className="p-4 [&_svg]:h-auto [&_svg]:max-w-none" dangerouslySetInnerHTML={{ __html: svg }} />
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}

export function MermaidDiagram({ code, streaming = false, title }: { code: string; streaming?: boolean; title?: string }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const source = normalizeMermaid(code);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const lastGood = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // While tokens stream in the diagram is usually incomplete, so wait briefly before trying to draw it.
    const timer = setTimeout(
      () => {
        renderDiagram(source, dark)
          .then((out) => {
            if (cancelled) return;
            lastGood.current = out;
            setSvg(out);
            setFailed(false);
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      streaming ? 700 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, dark, streaming]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [source]);

  const downloadSvg = () => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "diagram").replace(/\W+/g, "-").toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const display = svg ?? lastGood.current;
  const showCode = showSource || (failed && !streaming && !display);

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-xl border border-border bg-card" aria-label={title || "Diagram"}>
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
        <figcaption className="text-xs font-medium text-muted-foreground">{title || "Diagram"} · scroll to zoom, drag to pan</figcaption>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setShowSource((s) => !s)} aria-label="Toggle source" aria-pressed={showSource}><Code2 /></Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={copy} aria-label="Copy diagram source">{copied ? <Check /> : <Copy />}</Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={downloadSvg} disabled={!display} aria-label="Download SVG"><Download /></Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setFullscreen(true)} disabled={!display} aria-label="Open full screen"><Maximize2 /></Button>
        </div>
      </div>
      {showCode ? (
        <pre className="scroll-thin max-h-80 overflow-auto p-4 font-mono text-xs leading-6"><code>{source}</code></pre>
      ) : display ? (
        <div className={cn("transition-opacity", failed && streaming && "opacity-70")}>
          <DiagramCanvas svg={display} height="min(420px, 60vh)" />
        </div>
      ) : (
        <div className="p-4"><Skeleton className="h-48 w-full" /></div>
      )}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent title={title || "Diagram"} description="Scroll to zoom and drag to pan." wide>
          {display && <DiagramCanvas svg={display} height="70vh" />}
        </DialogContent>
      </Dialog>
    </figure>
  );
}
