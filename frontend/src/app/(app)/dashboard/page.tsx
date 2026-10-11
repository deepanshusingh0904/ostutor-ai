"use client";
import Link from "next/link";
import { BookMarked, BrainCircuit, Clock, Flame, GalleryVerticalEnd, GraduationCap, Mic, Target } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { QuizTrendChart, StudyTimeChart } from "@/components/dashboard/study-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { TopicList } from "@/components/dashboard/topic-lists";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatMinutes, relativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, reload } = useQuery(() => api.progress.dashboard());
  const firstName = user?.full_name.split(" ")[0] ?? "";

  if (loading && !data) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-72" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
      </PageContainer>
    );
  }
  if (error || !data) {
    return <PageContainer><p role="alert" className="text-destructive">{error ?? "Could not load your dashboard."}</p><Button className="mt-4" onClick={reload}>Retry</Button></PageContainer>;
  }

  const goalPct = Math.round((data.today_minutes / Math.max(1, data.daily_goal_minutes)) * 100);
  const noMaterial = data.documents_available === 0;

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={data.streak > 0 ? `You're on a ${data.streak}-day streak. Keep it going!` : "Study for a minute today to start your streak."}
        actions={<Button asChild><Link href="/professor"><GraduationCap />Start a lesson</Link></Button>}
      />
      {noMaterial && (
        <div role="status" className="mb-6 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          No course material has been published yet. Ask your instructor to upload notes - the professor teaches only from approved documents.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Flame} tone="accent" label="Daily streak" value={`${data.streak} day${data.streak === 1 ? "" : "s"}`} hint="Study 1+ minute a day" />
        <StatCard icon={Clock} label="Study time today" value={formatMinutes(data.today_minutes)} hint={`${formatMinutes(data.total_minutes)} in total`} />
        <StatCard icon={Target} tone="success" label="Quiz accuracy" value={data.quiz_accuracy === null ? "-" : `${data.quiz_accuracy}%`} hint={`${data.quizzes_taken} quiz${data.quizzes_taken === 1 ? "" : "zes"} taken`} />
        <StatCard icon={Mic} label="Viva average" value={data.viva_average === null ? "-" : `${data.viva_average}/10`} hint={`${data.vivas_completed} completed`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Study time this week</CardTitle><CardDescription>Daily goal: {data.daily_goal_minutes} min</CardDescription></CardHeader>
          <CardContent>
            <StudyTimeChart data={data.week} goal={data.daily_goal_minutes} />
            <div className="mt-3 flex items-center gap-3"><Progress value={goalPct} label="Today's goal" /><span className="shrink-0 text-xs text-muted-foreground">{Math.min(goalPct, 100)}% of today's goal</span></div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Quiz trend</CardTitle><CardDescription>Your last attempts</CardDescription></CardHeader>
          <CardContent>
            {data.recent_attempts.length ? (
              <QuizTrendChart data={data.recent_attempts.map((a, i) => ({ label: `#${i + 1}`, percent: a.percent }))} />
            ) : (
              <div className="grid h-56 place-items-center text-center text-sm text-muted-foreground"><div><BrainCircuit className="mx-auto mb-2 size-8 text-primary/60" aria-hidden />Take a quiz to see your trend.<br /><Link href="/quiz" className="font-medium text-primary underline-offset-4 hover:underline">Generate a quiz</Link></div></div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Weak topics</CardTitle><CardDescription>Below 60% - revise these first</CardDescription></CardHeader><CardContent><TopicList topics={data.weak_topics} tone="weak" empty="No weak topics yet. Quizzes and vivas will reveal them." /></CardContent></Card>
        <Card><CardHeader><CardTitle>Strong topics</CardTitle><CardDescription>75% and above</CardDescription></CardHeader><CardContent><TopicList topics={data.strong_topics} tone="strong" empty="Keep practising - strengths show up here." /></CardContent></Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Recent chats</CardTitle></CardHeader>
          <CardContent>
            {data.recent_chats.length ? (
              <ul className="space-y-1">{data.recent_chats.map((c) => (
                <li key={c.id}><Link href={`/${c.mode === "professor" ? "professor" : "chat"}?c=${c.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"><span className="truncate">{c.title}</span><span className="shrink-0 text-xs text-muted-foreground">{relativeTime(c.updated_at)}</span></Link></li>
              ))}</ul>
            ) : <p className="py-4 text-sm text-muted-foreground">No conversations yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bookmarks</CardTitle></CardHeader>
          <CardContent>
            {data.recent_bookmarks.length ? (
              <ul className="space-y-1">{data.recent_bookmarks.map((b) => (
                <li key={b.id}><Link href="/bookmarks" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted"><BookMarked className="size-4 shrink-0 text-primary" aria-hidden /><span className="truncate">{b.title}</span></Link></li>
              ))}</ul>
            ) : <p className="py-4 text-sm text-muted-foreground">Save useful answers with the Save button.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Up next</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-between"><Link href="/flashcards"><span className="flex items-center gap-2"><GalleryVerticalEnd />Flashcards due</span><span className="font-semibold text-primary">{data.flashcards_due}</span></Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/quiz"><BrainCircuit />Take a quiz</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link href="/viva"><Mic />Practise a viva</Link></Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
