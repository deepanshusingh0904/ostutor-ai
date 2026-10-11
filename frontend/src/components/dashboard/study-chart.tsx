"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
const tooltip = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 };

export function StudyTimeChart({ data, goal }: { data: { label: string; minutes: number }[]; goal: number }) {
  return (
    <div className="h-56" role="img" aria-label="Minutes studied in the last seven days">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (max: number) => Math.max(max, goal)]} />
          <Tooltip contentStyle={tooltip} cursor={{ fill: "hsl(var(--muted))" }} formatter={(v: number) => [`${v} min`, "Studied"]} />
          <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QuizTrendChart({ data }: { data: { label: string; percent: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label="Quiz score trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip contentStyle={tooltip} formatter={(v: number) => [`${v}%`, "Score"]} />
          <Line type="monotone" dataKey="percent" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--accent))" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
