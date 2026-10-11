"use client";
import { useState } from "react";
import { Network, Wand2 } from "lucide-react";
import { MermaidDiagram } from "@/components/chat/mermaid-diagram";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { VISUAL_KINDS } from "@/lib/constants";
import { errorMessage, toast } from "@/lib/toast";
import type { Visual, VisualKind } from "@/lib/types";

const QUICK: { topic: string; kind: VisualKind }[] = [
  { topic: "Process states", kind: "state" },
  { topic: "Binary search tree", kind: "binary_tree" },
  { topic: "Min heap", kind: "heap" },
  { topic: "Stack operations", kind: "stack" },
  { topic: "Queue operations", kind: "queue" },
  { topic: "System call", kind: "sequence" },
  { topic: "Linked list", kind: "linked_list" },
  { topic: "Operating system", kind: "architecture" },
];

export default function VisualLabPage() {
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<VisualKind>("flowchart");
  const [busy, setBusy] = useState(false);
  const [visual, setVisual] = useState<Visual | null>(null);

  const generate = async (t = topic, k = kind) => {
    setBusy(true);
    try { setVisual(await api.visuals.generate(t.trim(), k)); }
    catch (err) { toast.error("Could not draw that", errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <PageContainer>
      <PageHeader title="Visual lab" description="Generate flowcharts, mind maps, trees, heaps, graphs, state and sequence diagrams. Zoom, pan, copy the source or download as SVG." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Draw a diagram</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="v-topic">Topic</Label><Input id="v-topic" required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. page replacement" /></div>
                <div className="space-y-1.5"><Label htmlFor="v-kind">Diagram type</Label><Select id="v-kind" value={kind} onChange={(e) => setKind(e.target.value as VisualKind)}>{VISUAL_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></div>
                <Button type="submit" className="w-full" loading={busy}><Wand2 />Generate</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Quick examples</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {QUICK.map((q) => <button key={q.topic} onClick={() => { setTopic(q.topic); setKind(q.kind); generate(q.topic, q.kind); }} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/50 hover:bg-primary/5">{q.topic}</button>)}
            </CardContent>
          </Card>
        </div>
        <div>
          {visual ? <MermaidDiagram code={visual.mermaid} title={visual.title} /> : (
            <div className="grid min-h-[22rem] place-items-center rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground"><div><Network className="mx-auto mb-3 size-10 text-primary/50" aria-hidden />Choose a topic and diagram type, or try a quick example.</div></div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
