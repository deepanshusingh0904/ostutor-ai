"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, GalleryVerticalEnd, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { errorMessage, toast } from "@/lib/toast";
import type { Deck, Flashcard } from "@/lib/types";
import { cn } from "@/lib/utils";

const RATINGS = [
  { value: 0, label: "Again", style: "border-destructive/50 text-destructive hover:bg-destructive/10" },
  { value: 1, label: "Hard", style: "border-accent/60 hover:bg-accent/15" },
  { value: 2, label: "Good", style: "border-primary/50 text-primary hover:bg-primary/10" },
  { value: 3, label: "Easy", style: "border-success/50 text-success hover:bg-success/10" },
];

function StudySession({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.flashcards.cards(deck.id, true).then((c) => { setQueue(c); setTotal(c.length); }).catch((e) => toast.error("Could not load cards", errorMessage(e)));
  }, [deck.id]);

  const rate = async (rating: number) => {
    if (!queue?.length) return;
    const [card, ...rest] = queue;
    setFlipped(false);
    try {
      await api.flashcards.review(card.id, rating);
      // "Again" puts the card back at the end of this session.
      setQueue(rating === 0 ? [...rest, card] : rest);
    } catch (e) { toast.error("Could not save your rating", errorMessage(e)); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = queue?.[0];
  return (
    <PageContainer className="max-w-2xl">
      <Button variant="ghost" onClick={onExit} className="mb-4 -ml-2"><ArrowLeft />All decks</Button>
      <h1 className="font-display text-2xl font-semibold">{deck.topic}</h1>
      {queue === null ? <Skeleton className="mt-6 h-72 rounded-2xl" /> : !card ? (
        <Card className="mt-6 p-10 text-center"><p className="font-display text-2xl font-semibold">All caught up!</p><p className="mt-2 text-sm text-muted-foreground">No more cards are due in this deck. Come back tomorrow for spaced review.</p><Button className="mt-5" onClick={onExit}>Back to decks</Button></Card>
      ) : (
        <>
          <Progress className="mt-3" value={total ? ((total - queue.length) / total) * 100 : 0} label="Session progress" />
          <p className="mt-1 text-xs text-muted-foreground">{queue.length} card{queue.length === 1 ? "" : "s"} left</p>
          <div className="mt-5 [perspective:1200px]">
            <AnimatePresence mode="wait">
              <motion.button
                key={card.id + (flipped ? "b" : "f")} onClick={() => setFlipped((f) => !f)}
                initial={{ rotateX: -12, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className={cn("flex min-h-[18rem] w-full flex-col items-center justify-center rounded-2xl border p-8 text-center shadow-sm", flipped ? "border-primary/40 bg-primary/5" : "border-border bg-card")}
                aria-label={flipped ? "Answer. Press to show question" : "Question. Press to reveal answer"}
              >
                <span className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{flipped ? "Answer" : "Question"}</span>
                <span className={cn("leading-8", flipped ? "text-lg" : "font-display text-2xl font-medium")}>{flipped ? card.back : card.front}</span>
                {!flipped && <span className="mt-6 text-xs text-muted-foreground">Click or press Space to reveal</span>}
              </motion.button>
            </AnimatePresence>
          </div>
          <div className={cn("mt-4 grid grid-cols-4 gap-2 transition-opacity", flipped ? "opacity-100" : "pointer-events-none opacity-30")}>
            {RATINGS.map((r, i) => <Button key={r.value} variant="outline" className={r.style} onClick={() => rate(r.value)} disabled={!flipped}>{r.label}<kbd className="ml-1 hidden text-[10px] opacity-60 sm:inline">{i + 1}</kbd></Button>)}
          </div>
        </>
      )}
    </PageContainer>
  );
}

export default function FlashcardsPage() {
  const decks = useQuery(() => api.flashcards.decks());
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Deck | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const deck = await api.flashcards.create(topic.trim(), count);
      toast.success(`Created ${deck.card_count} flashcards`);
      setTopic(""); decks.reload();
    } catch (err) { toast.error("Could not create the deck", errorMessage(err)); }
    finally { setCreating(false); }
  };

  const remove = async (deck: Deck) => {
    try { await api.flashcards.remove(deck.id); decks.reload(); } catch (err) { toast.error("Could not delete", errorMessage(err)); }
  };

  if (active) return <StudySession deck={active} onExit={() => { setActive(null); decks.reload(); }} />;

  return (
    <PageContainer>
      <PageHeader title="Flashcards" description="Spaced repetition on cards built from your course material. Rate each card honestly and the schedule adapts." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="h-fit lg:col-span-2">
          <CardHeader><CardTitle>New deck</CardTitle><CardDescription>Cards are generated from approved documents.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="fc-topic">Topic</Label><Input id="fc-topic" required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. memory management" /></div>
              <div className="space-y-1.5"><Label htmlFor="fc-count">Cards: {count}</Label><input id="fc-count" type="range" min={5} max={25} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" /></div>
              <Button type="submit" className="w-full" loading={creating}><Plus />Generate deck</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3 lg:col-span-3">
          {decks.loading ? <Skeleton className="h-24 rounded-2xl" /> : decks.data?.length ? decks.data.map((d) => (
            <Card key={d.id} className="flex items-center gap-4 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><GalleryVerticalEnd aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.topic}</p><p className="text-sm text-muted-foreground">{d.card_count} cards</p></div>
              {d.due_count > 0 ? <Badge variant="warning">{d.due_count} due</Badge> : <Badge variant="success">Up to date</Badge>}
              <Button onClick={() => setActive(d)} disabled={d.due_count === 0} size="sm">Study</Button>
              <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => remove(d)} aria-label={`Delete deck ${d.topic}`}><Trash2 /></Button>
            </Card>
          )) : <EmptyState icon={GalleryVerticalEnd} title="No decks yet" description="Generate a deck on any topic from your notes to begin spaced review." />}
        </div>
      </div>
    </PageContainer>
  );
}
