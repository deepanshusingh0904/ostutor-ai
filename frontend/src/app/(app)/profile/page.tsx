"use client";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { errorMessage, toast } from "@/lib/toast";
import { formatDate, initials } from "@/lib/utils";

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.full_name ?? "");
  const [university, setUniversity] = useState(user?.university ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { setUser(await api.users.update({ full_name: name.trim(), university: university.trim(), bio: bio.trim() })); toast.success("Profile saved"); }
    catch (err) { toast.error("Could not save", errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Profile" />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-primary/15 font-display text-2xl font-semibold text-primary" aria-hidden>{initials(user.full_name)}</span>
            <div><CardTitle>{user.full_name}</CardTitle><p className="text-sm text-muted-foreground">{user.email}</p><div className="mt-1.5 flex gap-2"><Badge className="capitalize">{user.role}</Badge><Badge variant="outline">Joined {formatDate(user.created_at)}</Badge></div></div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="p-name">Full name</Label><Input id="p-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-uni">University</Label><Input id="p-uni" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Optional" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="p-bio">About you</Label><Textarea id="p-bio" value={bio} maxLength={1000} onChange={(e) => setBio(e.target.value)} placeholder="What are you studying, and what do you want to get better at?" /></div>
            <div><Button type="submit" loading={saving}>Save profile</Button></div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
