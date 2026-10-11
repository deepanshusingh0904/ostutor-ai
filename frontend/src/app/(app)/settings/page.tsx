"use client";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { errorMessage, toast } from "@/lib/toast";
import type { Difficulty, UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { setTheme } = useTheme();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  if (!user) return null;
  const s = user.settings;

  const update = async (patch: Partial<UserSettings>) => {
    const previous = user;
    setUser({ ...user, settings: { ...user.settings, ...patch } });
    if (patch.theme) setTheme(patch.theme);
    try { await api.users.updateSettings(patch); }
    catch (e) { setUser(previous); toast.error("Could not save the setting", errorMessage(e)); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await api.users.changePassword(current, next); toast.success("Password updated"); setCurrent(""); setNext(""); }
    catch (err) { toast.error("Could not change password", errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Settings" description="Preferences are saved to your account and follow you across devices." />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Your choice is remembered on this device and your account.</CardDescription></CardHeader>
          <CardContent>
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button key={value} role="radio" aria-checked={s.theme === value} onClick={() => update({ theme: value })} className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium", s.theme === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}>
                  <Icon className="size-5" aria-hidden />{label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Learning</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="pstyle">Professor style</Label>
                <Select id="pstyle" value={s.professor_style} onChange={(e) => update({ professor_style: e.target.value as UserSettings["professor_style"] })}>
                  <option value="balanced">Balanced - explain and ask</option><option value="socratic">Socratic - lots of guiding questions</option><option value="concise">Concise - short and tight</option>
                </Select></div>
              <div className="space-y-1.5"><Label htmlFor="diff">Default quiz difficulty</Label>
                <Select id="diff" value={s.default_difficulty} onChange={(e) => update({ default_difficulty: e.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="goal">Daily study goal: {s.daily_goal_minutes} minutes</Label>
              <input id="goal" type="range" min={10} max={240} step={5} value={s.daily_goal_minutes} onChange={(e) => setUser({ ...user, settings: { ...s, daily_goal_minutes: Number(e.target.value) } })} onMouseUp={(e) => update({ daily_goal_minutes: Number((e.target as HTMLInputElement).value) })} onTouchEnd={(e) => update({ daily_goal_minutes: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => update({ daily_goal_minutes: Number((e.target as HTMLInputElement).value) })} className="w-full accent-[hsl(var(--primary))]" /></div>
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Show sources under answers</p><p className="text-sm text-muted-foreground">Document, page, similarity score and the retrieved passage.</p></div>
              <Switch checked={s.show_citations} onCheckedChange={(v) => update({ show_citations: v })} label="Show sources under answers" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="new">New password</Label><Input id="new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></div>
              <div className="sm:col-span-2"><Button type="submit" loading={saving}>Update password</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
