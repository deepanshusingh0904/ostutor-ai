"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Send, Trophy } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { DIFFICULTIES } from "@/lib/constants";
import { errorMessage, toast } from "@/lib/toast";
import type { Difficulty, VivaSession } from "@/lib/types";
import { cn, relativeTime, scoreColor } from "@/lib/utils";

function ScoreBadge({ score }: { score: number }) {
  return <Badge variant={score >= 7.5 ? "success" : score >= 5 ? "warning" : "destructive"}>{score.toFixed(1)}/10</Badge>;
}

export default function VivaPage() {
  const history = useQuery(() => api.viva.history());
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questions, setQuestions] = useState(5);
  const [session, setSession] = useState<VivaSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [session]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { setSession(await api.viva.start(topic.trim(), difficulty, questions)); setAnswer(""); }
    catch (err) { toast.error("Could not start the viva", errorMessage(err)); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!session || !answer.trim()) return;
    setBusy(true);
    try {
      const updated = await api.viva.answer(session.id, answer.trim());
      setSession(updated); setAnswer("");
      if (updated.status === "completed") history.reload();
    } catch (err) { toast.error("Could not submit your answer", errorMessage(err)); }
    finally { setBusy(false); }
  };

  if (session) {
    const answered = session.transcript.filter((t) => t.answer !== null).length;
    const done = session.status === "completed";
    return (
      <PageContainer className="max-w-3xl">
        <PageHeader title={`Viva: ${session.topic}`} description={`${session.difficulty} · question ${Math.min(answered + (done ? 0 : 1), session.max_questions)} of ${session.max_questions}`} actions={<Button variant="outline" onClick={() => { setSession(null); history.reload(); }}>{done ? "Done" : "Leave"}</Button>} />
        <Progress value={(answered / session.max_questions) * 100} label="Viva progress" />
        <div className="mt-6 space-y-6">
          {session.transcript.map((t, i) => (
            <div key={i} className="space-y-3">
              <div className="flex gap-3"><span className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Mic className="size-4" aria-hidden /></span><div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 text-[15px] leading-7 shadow-sm ring-1 ring-border"><p className="mb-1 text-xs font-medium text-muted-foreground">Examiner · Q{i + 1}</p>{t.question}</div></div>
              {t.answer !== null && (
                <>
                  <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-[15px] leading-7 text-primary-foreground">{t.answer}</div></div>
                  <Card className="ml-11 p-4 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">Feedback</span>{t.score !== undefined && <ScoreBadge score={t.score} />}</div>
                    <p className="mt-2 text-muted-foreground">{t.feedback}</p>
                    {t.reference_answer && <p className="mt-2 rounded-lg bg-muted px-3 py-2"><span className="font-medium">Model answer: </span>{t.reference_answer}</p>}
                  </Card>
                </>
              )}
            </div>
          ))}
          {done && (
            <Card className="border-primary/40 bg-primary/5 p-6 text-center">
              <Trophy className="mx-auto size-8 text-accent" aria-hidden />
              <p className={cn("mt-2 font-display text-5xl font-semibold", scoreColor((session.final_score ?? 0) * 10))}>{(session.final_score ?? 0).toFixed(1)}<span className="text-xl text-muted-foreground"> / 10</span></p>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{session.final_feedback}</p>
              <Button className="mt-5" onClick={() => setSession(null)}>Start another viva</Button>
            </Card>
          )}
          <div ref={endRef} />
        </div>
        {!done && (
          <div className="sticky bottom-4 mt-6 space-y-2 rounded-2xl glass p-3 shadow-lg">
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer as you would in front of the examiner..." aria-label="Your answer" className="min-h-[96px] border-0 bg-transparent" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Ctrl/Cmd + Enter to submit</span><Button onClick={submit} loading={busy} disabled={!answer.trim()}><Send />Submit answer</Button></div>
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Viva mode" description="An AI examiner asks oral-style questions from your course material, evaluates each answer and gives a final score." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Start a viva</CardTitle><CardDescription>Answer in your own words - key terms matter.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={start} className="space-y-5">
              <div className="space-y-1.5"><Label htmlFor="viva-topic">Topic</Label><Input id="viva-topic" required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. deadlock, virtual memory" /></div>
              <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Difficulty</legend>
                <div className="flex gap-2">{DIFFICULTIES.map((d) => <button type="button" key={d.value} aria-pressed={difficulty === d.value} onClick={() => setDifficulty(d.value)} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium", difficulty === d.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>{d.label}</button>)}</div>
              </fieldset>
              <div className="space-y-1.5"><Label htmlFor="viva-count">Questions: {questions}</Label><input id="viva-count" type="range" min={2} max={10} value={questions} onChange={(e) => setQuestions(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" /></div>
              <Button type="submit" size="lg" className="w-full" loading={busy}><Mic />Begin viva</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Past vivas</CardTitle></CardHeader>
          <CardContent>
            {history.data?.length ? (
              <ul className="space-y-2">{history.data.map((v) => (
                <li key={v.id}>
                  <button onClick={() => setSession(v)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-border p-3 text-left hover:bg-muted">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{v.topic}</span><span className="text-xs text-muted-foreground capitalize">{v.difficulty} · {relativeTime(v.created_at)}</span></span>
                    {v.final_score !== null ? <ScoreBadge score={v.final_score} /> : <Badge variant="outline">In progress</Badge>}
                  </button>
                </li>
              ))}</ul>
            ) : <EmptyState icon={Mic} title="No vivas yet" description="Your scores and feedback will appear here." />}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
