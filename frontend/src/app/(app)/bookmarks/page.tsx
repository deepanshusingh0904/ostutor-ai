"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark as BookmarkIcon, ExternalLink, Search, Trash2 } from "lucide-react";
import { Markdown } from "@/components/chat/markdown";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { errorMessage, toast } from "@/lib/toast";
import { relativeTime } from "@/lib/utils";

type Kind = "all" | "message" | "guide" | "topic" | "document";

export default function BookmarksPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [open, setOpen] = useState<number | null>(null);
  const dq = useDebounce(q, 250);
  const { data, loading, reload } = useQuery(() => api.bookmarks.list(dq, kind === "all" ? undefined : kind), [dq, kind]);

  const remove = async (id: number) => {
    try { await api.bookmarks.remove(id); reload(); } catch (e) { toast.error("Could not remove", errorMessage(e)); }
  };

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Bookmarks" description="Answers, guides and topics you saved for later." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookmarks" className="pl-9" aria-label="Search bookmarks" /></div>
        <Tabs<Kind> value={kind} onChange={setKind} items={[{ value: "all", label: "All" }, { value: "message", label: "Answers" }, { value: "guide", label: "Guides" }, { value: "topic", label: "Topics" }]} />
      </div>
      {loading && !data ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div> : data?.length ? (
        <ul className="space-y-3">
          {data.map((b) => (
            <li key={b.id}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>
                    <p className="font-medium">{b.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="capitalize">{b.kind}</Badge>{relativeTime(b.created_at)}</p>
                  </button>
                  {b.conversation_id && <Button asChild variant="ghost" size="icon" aria-label="Open conversation"><Link href={`/chat?c=${b.conversation_id}`}><ExternalLink /></Link></Button>}
                  <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => remove(b.id)} aria-label={`Remove bookmark ${b.title}`}><Trash2 /></Button>
                </div>
                {open === b.id && b.content && <div className="mt-4 border-t border-border pt-4"><Markdown content={b.content} /></div>}
              </Card>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={BookmarkIcon} title="No bookmarks" description="Use the Save button under any answer to keep it here." />}
    </PageContainer>
  );
}
