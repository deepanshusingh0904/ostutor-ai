"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, BookText, FileText, MessageSquare, Search } from "lucide-react";
import { Citations } from "@/components/chat/citations";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/utils";

function Results() {
  const q = useSearchParams().get("q")?.trim() ?? "";
  const { data, loading, error } = useQuery(() => (q.length >= 2 ? api.search(q) : Promise.resolve(null)), [q]);

  if (q.length < 2) return <EmptyState icon={Search} title="Search everything" description="Type at least two characters in the search box above." />;
  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  if (error || !data) return <p role="alert" className="text-destructive">{error}</p>;
  const empty = !data.passages.length && !data.conversations.length && !data.bookmarks.length && !data.guides.length;
  if (empty) return <EmptyState icon={Search} title={`No results for "${q}"`} description="Try different words, or ask the AI Professor to teach it." />;

  return (
    <div className="space-y-6">
      {data.passages.length > 0 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" aria-hidden />From course material</CardTitle></CardHeader><CardContent><Citations citations={data.passages} focusIndex={1} /></CardContent></Card>
      )}
      {data.conversations.length > 0 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="size-5 text-primary" aria-hidden />Conversations</CardTitle></CardHeader><CardContent><ul className="space-y-1">{data.conversations.map((c) => (
          <li key={c.id}><Link href={`/${c.mode === "professor" ? "professor" : "chat"}?c=${c.id}`} className="flex justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"><span className="truncate">{c.title}</span><span className="shrink-0 text-xs text-muted-foreground">{relativeTime(c.updated_at)}</span></Link></li>
        ))}</ul></CardContent></Card>
      )}
      {data.bookmarks.length > 0 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bookmark className="size-5 text-primary" aria-hidden />Bookmarks</CardTitle></CardHeader><CardContent><ul className="space-y-1">{data.bookmarks.map((b) => (
          <li key={b.id}><Link href="/bookmarks" className="block rounded-lg px-2 py-2 text-sm hover:bg-muted">{b.title}</Link></li>
        ))}</ul></CardContent></Card>
      )}
      {data.guides.length > 0 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookText className="size-5 text-primary" aria-hidden />Study guides</CardTitle></CardHeader><CardContent><ul className="space-y-1">{data.guides.map((g) => (
          <li key={g.id}><Link href="/study-guide" className="block rounded-lg px-2 py-2 text-sm capitalize hover:bg-muted">{g.topic} · {g.kind.replace("_", " ")}</Link></li>
        ))}</ul></CardContent></Card>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Search" description="Semantic search across approved material, plus your own chats, bookmarks and guides." />
      <Suspense fallback={<Skeleton className="h-24 rounded-2xl" />}><Results /></Suspense>
    </PageContainer>
  );
}
