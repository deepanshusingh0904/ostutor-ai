"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, Check, ChevronLeft, ChevronRight, Clock, RotateCcw, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Markdown } from "@/components/chat/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { DIFFICULTIES, QUESTION_TYPES } from "@/lib/constants";
import { errorMessage, toast } from "@/lib/toast";
import type { Difficulty, QuestionType, Quiz, QuizAttempt, QuizQuestion } from "@/lib/types";
import { cn, relativeTime, scoreColor } from "@/lib/utils";

type View = "setup" | "taking" | "result";

function QuestionInput({ q, value, onChange }: { q: QuizQuestion; value: string; onChange: (v: string) => void }) {
  if (q.type === "mcq" || q.type === "true_false") {
    const options = q.type === "true_false" ? ["True", "False"] : q.options ?? [];
    return (
      <div role="radiogroup" aria-label="Answer options" className="grid gap-2">
        {options.map((o, i) => (
          <button
            key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors", value === o ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}
          >
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", value === o ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{q.type === "mcq" ? String.fromCharCode(65 + i) : ""}</span>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "coding") {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="Write code or pseudocode..." className="min-h-[200px] font-mono text-[13px]" aria-label="Your code" spellCheck={false} />;
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={q.type === "numerical" ? "Enter a number" : "Type your answer"} aria-label="Your answer" inputMode={q.type === "numerical" ? "decimal" : "text"} />;
}

export default function QuizPage() {
  const user = useAuthStore((s) => s.user);
  const history = useQuery(() => api.quiz.list());
  const [view, setView] = useState<View>("setup");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(user?.settings?.default_difficulty ?? "medium");
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "true_false", "fill_blank"]);
  const [count, setCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (view !== "taking") return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [view]);

  const toggleType = (t: QuestionType) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!types.length) return toast.error("Pick at least one question type");
    setGenerating(true);
    try {
      const q = await api.quiz.generate({ topic: topic.trim(), difficulty, types, count });
      begin(q);
      history.reload();
    } catch (err) {
      toast.error("Could not build the quiz", errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const begin = (q: Quiz) => {
    setQuiz(q); setAnswers({}); setIndex(0); setAttempt(null); setElapsed(0);
    startedAt.current = Date.now();
    setView("taking");
  };

  const submit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await api.quiz.submit(quiz.id, answers, Math.round((Date.now() - startedAt.current) / 1000));
      setAttempt(res); setView("result"); history.reload();
    } catch (err) {
      toast.error("Could not submit", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reopen = async (id: number) => {
    try { begin(await api.quiz.get(id)); } catch (err) { toast.error("Could not open quiz", errorMessage(err)); }
  };

  const remove = async (id: number) => {
    try { await api.quiz.remove(id); history.reload(); } catch (err) { toast.error("Could not delete", errorMessage(err)); }
  };

  if (view === "taking" && quiz) {
    const q = quiz.questions[index];
    const answered = quiz.questions.filter((x) => (answers[x.id] ?? "").trim()).length;
    const last = index === quiz.questions.length - 1;
    return (
      <PageContainer className="max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0"><h1 className="truncate font-display text-2xl font-semibold">{quiz.topic}</h1><p className="text-sm text-muted-foreground capitalize">{quiz.difficulty} · {quiz.questions.length} questions</p></div>
          <Badge variant="secondary" className="gap-1.5 text-sm"><Clock className="size-3.5" aria-hidden />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</Badge>
        </div>
        <Progress value={(answered / quiz.questions.length) * 100} label="Questions answered" />
        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
            <Card className="mt-5 p-6">
              <div className="mb-3 flex items-center gap-2"><Badge>Question {index + 1} of {quiz.questions.length}</Badge><Badge variant="outline">{QUESTION_TYPES.find((t) => t.value === q.type)?.label}</Badge></div>
              <div className="mb-5 text-lg leading-7"><Markdown content={q.question} /></div>
              <QuestionInput q={q} value={answers[q.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            </Card>
          </motion.div>
        </AnimatePresence>
        <div className="mt-5 flex items-center justify-between">
          <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ChevronLeft />Previous</Button>
          <div className="hidden gap-1.5 sm:flex" aria-label="Question navigator">
            {quiz.questions.map((x, i) => (
              <button key={x.id} onClick={() => setIndex(i)} aria-label={`Go to question ${i + 1}`} aria-current={i === index} className={cn("size-8 rounded-lg text-xs font-medium", i === index ? "bg-primary text-primary-foreground" : (answers[x.id] ?? "").trim() ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{i + 1}</button>
            ))}
          </div>
          {last ? <Button onClick={submit} loading={submitting}>Submit quiz</Button> : <Button onClick={() => setIndex((i) => i + 1)}>Next<ChevronRight /></Button>}
        </div>
        {last && answered < quiz.questions.length && <p className="mt-3 text-right text-xs text-muted-foreground">{quiz.questions.length - answered} unanswered - they will count as incorrect.</p>}
      </PageContainer>
    );
  }

  if (view === "result" && attempt && quiz) {
    const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
    return (
      <PageContainer className="max-w-3xl">
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">{quiz.topic}</p>
          <p className={cn("mt-2 font-display text-6xl font-semibold", scoreColor(pct))}>{pct}%</p>
          <p className="mt-1 text-sm text-muted-foreground">{attempt.score} of {attempt.total} points · {Math.floor(attempt.duration_seconds / 60)}m {attempt.duration_seconds % 60}s</p>
          <p className="mt-3 text-sm">{pct >= 75 ? "Excellent work - this topic is a strength." : pct >= 50 ? "Good effort. Review the explanations below." : "Let's revise this topic with the AI Professor, then try again."}</p>
          <div className="mt-5 flex justify-center gap-2"><Button onClick={() => begin(quiz)}><RotateCcw />Retake</Button><Button variant="outline" onClick={() => setView("setup")}>New quiz</Button></div>
        </Card>
        <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Review</h2>
        <ol className="space-y-3">
          {attempt.results.map((r, i) => (
            <li key={r.id}>
              <Card className={cn("p-5", r.correct ? "border-success/40" : "border-destructive/40")}>
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", r.correct ? "bg-success" : "bg-destructive")}>{r.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}</span>
                  <div className="min-w-0 flex-1 space-y-2 text-sm">
                    <div className="font-medium"><Markdown content={`${i + 1}. ${r.question}`} /></div>
                    <p><span className="text-muted-foreground">Your answer: </span>{r.given ? <span className="whitespace-pre-wrap">{r.given}</span> : <em>no answer</em>}</p>
                    {!r.correct && <p><span className="text-muted-foreground">Correct answer: </span><span className="font-medium whitespace-pre-wrap">{r.answer}</span></p>}
                    {r.explanation && <p className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">{r.explanation}</p>}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quizzes" description="Questions are generated from your approved course material, so every answer can be traced back to a source." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Build a quiz</CardTitle><CardDescription>Choose a topic, difficulty and question types.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={generate} className="space-y-5">
              <div className="space-y-1.5"><Label htmlFor="topic">Topic</Label><Input id="topic" required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. CPU scheduling, deadlock, paging" /></div>
              <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Difficulty</legend>
                <div className="flex gap-2">{DIFFICULTIES.map((d) => <button type="button" key={d.value} aria-pressed={difficulty === d.value} onClick={() => setDifficulty(d.value)} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium", difficulty === d.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>{d.label}</button>)}</div>
              </fieldset>
              <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Question types</legend>
                <div className="flex flex-wrap gap-2">{QUESTION_TYPES.map((t) => <button type="button" key={t.value} aria-pressed={types.includes(t.value)} onClick={() => toggleType(t.value)} className={cn("rounded-full border px-3 py-1.5 text-sm", types.includes(t.value) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>{t.label}</button>)}</div>
              </fieldset>
              <div className="space-y-1.5"><Label htmlFor="count">Number of questions: {count}</Label><input id="count" type="range" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" /></div>
              <Button type="submit" loading={generating} className="w-full" size="lg"><BrainCircuit />Generate quiz</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Your quizzes</CardTitle></CardHeader>
          <CardContent>
            {history.loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> : history.data?.length ? (
              <ul className="space-y-2">{history.data.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
                  <button onClick={() => reopen(h.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-medium">{h.topic}</p><p className="text-xs text-muted-foreground capitalize">{h.difficulty} · {h.question_count} Qs · {relativeTime(h.created_at)}</p></button>
                  {h.best_score !== null && <Badge variant={h.best_score >= 75 ? "success" : h.best_score >= 50 ? "warning" : "destructive"}>{h.best_score}%</Badge>}
                  <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={() => remove(h.id)} aria-label={`Delete quiz ${h.topic}`}><Trash2 /></Button>
                </li>
              ))}</ul>
            ) : <EmptyState icon={BrainCircuit} title="No quizzes yet" description="Generate your first quiz to start tracking your accuracy." />}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
