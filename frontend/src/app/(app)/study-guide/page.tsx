"use client";
import { useState } from "react";
import { BookOpenCheck, BookmarkPlus, Download, Sparkles, Trash2 } from "lucide-react";
import { Citations } from "@/components/chat/citations";
import { Markdown } from "@/components/chat/markdown";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { GUIDE_KINDS } from "@/lib/constants";
import { errorMessage, toast } from "@/lib/toast";
import type { GuideKind, StudyGuide } from "@/lib/types";
import { cn, downloadText, relativeTime } from "@/lib/utils";

export default function StudyGuidePage() {
  const guides = useQuery(() => api.guides.list());
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState<GuideKind>("summary");
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<StudyGuide | null>(null);
  const label = (k: string) => GUIDE_KINDS.find((g) => g.value === k)?.label ?? k;

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { const g = await api.guides.generate(topic.trim(), kind); setCurrent(g); guides.reload(); }
    catch (err) { toast.error("Could not create the guide", errorMessage(err)); }
    finally { setBusy(false); }
  };

  const remove = async (g: StudyGuide) => {
    try { await api.guides.remove(g.id); if (current?.id === g.id) setCurrent(null); guides.reload(); } catch (err) { toast.error("Could not delete", errorMessage(err)); }
  };

  const bookmark = async (g: StudyGuide) => {
    try { await api.bookmarks.create({ kind: "guide", title: `${label(g.kind)}: ${g.topic}`, content: g.content, ref_id: g.id }); toast.success("Saved to bookmarks"); }
    catch (err) { toast.error("Could not bookmark", errorMessage(err)); }
  };

  return (
    <PageContainer>
      <PageHeader title="Study guides" description="Summaries, revision notes, formula sheets, mind maps, cheat sheets and likely exam questions - all grounded in approved material." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Create a guide</CardTitle><CardDescription>Pick a format and a topic.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={generate} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="g-topic">Topic</Label><Input id="g-topic" required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. process scheduling" /></div>
                <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Format</legend>
                  <div className="grid gap-1.5">{GUIDE_KINDS.map((g) => (
                    <button type="button" key={g.value} aria-pressed={kind === g.value} onClick={() => setKind(g.value)} className={cn("rounded-lg border px-3 py-2 text-left", kind === g.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                      <span className="block text-sm font-medium">{g.label}</span><span className="block text-xs text-muted-foreground">{g.hint}</span>
                    </button>
                  ))}</div>
                </fieldset>
                <Button type="submit" className="w-full" loading={busy}><Sparkles />Generate</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Saved guides</CardTitle></CardHeader>
            <CardContent>
              {guides.loading ? <Skeleton className="h-16" /> : guides.data?.length ? (
                <ul className="space-y-1.5">{guides.data.map((g) => (
                  <li key={g.id} className={cn("flex items-center gap-1 rounded-lg", current?.id === g.id && "bg-primary/10")}>
                    <button onClick={() => setCurrent(g)} className="min-w-0 flex-1 px-2 py-2 text-left"><span className="block truncate text-sm font-medium">{g.topic}</span><span className="text-xs text-muted-foreground">{label(g.kind)} · {relativeTime(g.created_at)}</span></button>
                    <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={() => remove(g)} aria-label="Delete guide"><Trash2 /></Button>
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
            </CardContent>
          </Card>
        </div>
        <Card className="min-h-[24rem]">
          {busy ? <CardContent className="space-y-3 p-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></CardContent> : current ? (
            <CardContent className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <Badge>{label(current.kind)}</Badge>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => bookmark(current)}><BookmarkPlus />Bookmark</Button>
                  <Button variant="outline" size="sm" onClick={() => downloadText(`${current.topic.replace(/\W+/g, "-").toLowerCase()}-${current.kind}.md`, current.content)}><Download />Download</Button>
                </div>
              </div>
              <Markdown content={current.content} />
              <Citations citations={current.citations} />
            </CardContent>
          ) : <div className="p-6"><EmptyState icon={BookOpenCheck} title="Your guide appears here" description="Choose a format and topic, then generate. You can download any guide as Markdown." /></div>}
        </Card>
      </div>
    </PageContainer>
  );
}
