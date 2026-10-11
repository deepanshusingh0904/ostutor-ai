"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Database, FileText, MessagesSquare, Search, ShieldCheck, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Citations } from "@/components/chat/citations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { errorMessage, toast } from "@/lib/toast";
import type { Citation, User } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const stats = useQuery(() => api.admin.stats());
  const users = useQuery(() => api.admin.users());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Citation[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState<User | null>(null);

  useEffect(() => { if (me && me.role !== "admin") router.replace("/dashboard"); }, [me, router]);
  if (!me || me.role !== "admin") return null;

  const test = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    try { setResults((await api.admin.testRetrieval(query.trim(), 6)).results); }
    catch (err) { toast.error("Retrieval test failed", errorMessage(err)); }
    finally { setTesting(false); }
  };

  const patch = async (u: User, data: { role?: "student" | "admin"; is_active?: boolean }) => {
    try { await api.admin.updateUser(u.id, data); users.reload(); } catch (err) { toast.error("Update failed", errorMessage(err)); }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try { await api.admin.removeUser(removing.id); toast.success("User deleted"); users.reload(); stats.reload(); }
    catch (err) { toast.error("Could not delete", errorMessage(err)); }
    finally { setRemoving(null); }
  };

  const s = stats.data;
  return (
    <PageContainer>
      <PageHeader title="Admin panel" description="Manage the knowledge base, people and system health." actions={<Button asChild><Link href="/documents"><FileText />Manage documents</Link></Button>} />
      {stats.loading && !s ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div> : s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Users" value={s.users} hint={`${s.active_users_7d} active this week · ${s.admins} admin${s.admins === 1 ? "" : "s"}`} />
            <StatCard icon={FileText} tone="success" label="Documents" value={s.documents_ready} hint={`${s.documents} total · ${s.documents_failed} failed`} />
            <StatCard icon={Database} tone="accent" label="Indexed chunks" value={s.chunks.toLocaleString()} hint={s.embedding_model} />
            <StatCard icon={MessagesSquare} label="Messages" value={s.messages.toLocaleString()} hint={`${s.conversations} chats · ${s.quiz_attempts} quiz attempts · ${s.vivas} vivas`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <Activity className="size-4 text-primary" aria-hidden />
            {s.llm_configured ? <><Badge variant="success">LLM connected</Badge><span className="text-muted-foreground">Model: {s.llm_model}</span></> : <><Badge variant="warning">Offline mode</Badge><span className="text-muted-foreground">No LLM key set. Answers are assembled from retrieved passages. Add LLM_API_KEY to enable full AI teaching.</span></>}
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Retrieval inspector</CardTitle><CardDescription>Test what the tutor would retrieve for a question, including raw similarity scores.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={test} className="flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={query} onChange={(e) => setQuery(e.target.value)} required minLength={2} placeholder="e.g. what causes thrashing?" className="pl-9" aria-label="Test query" /></div><Button type="submit" loading={testing}>Retrieve</Button></form>
          {results && (results.length ? <Citations citations={results} focusIndex={1} /> : <p className="mt-4 text-sm text-muted-foreground">Nothing retrieved. Upload material that covers this topic.</p>)}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" aria-hidden />Users</CardTitle></CardHeader>
        <CardContent>
          {users.loading && !users.data ? <Skeleton className="h-32" /> : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2 pr-4 font-medium">Name</th><th className="pb-2 pr-4 font-medium">Role</th><th className="pb-2 pr-4 font-medium">Status</th><th className="pb-2 pr-4 font-medium">Joined</th><th className="pb-2 text-right font-medium">Actions</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {users.data?.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4"><p className="font-medium">{u.full_name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                      <td className="py-3 pr-4"><Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">{u.role}</Badge></td>
                      <td className="py-3 pr-4"><Badge variant={u.is_active ? "success" : "destructive"}>{u.is_active ? "Active" : "Deactivated"}</Badge></td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                      <td className="py-3 text-right">
                        {u.id !== me.id && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => patch(u, { role: u.role === "admin" ? "student" : "admin" })}>{u.role === "admin" ? "Make student" : "Make admin"}</Button>
                            <Button size="sm" variant="outline" onClick={() => patch(u, { is_active: !u.is_active })}>{u.is_active ? "Deactivate" : "Activate"}</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(u)}>Delete</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent title="Delete this user?" description={removing ? `${removing.full_name}'s chats, quizzes and progress will be permanently removed.` : undefined}>
          <div className="flex justify-end gap-2"><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button variant="destructive" onClick={confirmRemove}>Delete user</Button></div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
