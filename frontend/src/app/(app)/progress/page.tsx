"use client";
import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { QuizTrendChart, StudyTimeChart } from "@/components/dashboard/study-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { cn, formatMinutes, relativeTime } from "@/lib/utils";

export default function ProgressPage() {
  const { data, loading, error } = useQuery(() => api.progress.dashboard());
  if (loading) return <PageContainer><Skeleton className="h-10 w-64" /><Skeleton className="mt-6 h-80 rounded-2xl" /></PageContainer>;
  if (error || !data) return <PageContainer><p role="alert" className="text-destructive">{error}</p></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Learning progress" description="Every quiz, viva and lesson feeds this picture of what you know." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Study time</CardTitle><CardDescription>{formatMinutes(data.total_minutes)} in total · {data.streak}-day streak</CardDescription></CardHeader><CardContent><StudyTimeChart data={data.week} goal={data.daily_goal_minutes} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Quiz scores</CardTitle><CardDescription>Most recent attempts</CardDescription></CardHeader><CardContent>
          {data.recent_attempts.length ? <QuizTrendChart data={data.recent_attempts.map((a, i) => ({ label: `#${i + 1}`, percent: a.percent }))} /> : <p className="grid h-56 place-items-center text-sm text-muted-foreground">No quiz attempts yet.</p>}
        </CardContent></Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Topic mastery</CardTitle><CardDescription>Accuracy across quizzes and vivas. Under 60% is weak, 75% and above is strong.</CardDescription></CardHeader>
        <CardContent>
          {data.topics.length ? (
            <ul className="divide-y divide-border">
              {data.topics.map((t) => (
                <li key={t.topic} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-48"><p className="truncate font-medium">{t.topic}</p><p className="text-xs text-muted-foreground">{t.attempts} question{t.attempts === 1 ? "" : "s"} · {relativeTime(t.last_studied)}</p></div>
                  <Progress value={t.accuracy} label={`${t.topic} mastery`} className={cn("basis-48 flex-1", t.accuracy < 60 ? "[&>div]:bg-destructive" : t.accuracy >= 75 ? "[&>div]:bg-success" : "[&>div]:bg-accent")} />
                  <Badge variant={t.accuracy < 60 ? "destructive" : t.accuracy >= 75 ? "success" : "warning"} className="w-14 justify-center">{t.accuracy}%</Badge>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={LineChart} title="No mastery data yet" description="Take a quiz or a viva and your topics will appear here." />}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
