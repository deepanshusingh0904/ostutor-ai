"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { persistToken, useAuthStore } from "@/lib/auth-store";
import { errorMessage } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const setUser = useAuthStore((s) => s.setUser);
  const setReady = useAuthStore((s) => s.setReady);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isLogin && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    try {
      const res = isLogin ? await api.auth.login(email, password) : await api.auth.register(email, password, fullName);
      persistToken(res.access_token);
      setUser(res.user);
      setReady(true);
      if (res.user.settings?.theme) setTheme(res.user.settings.theme);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isLogin ? "Sign in to continue learning." : "Join your course and start learning with your AI professor."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {!isLogin && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"} aria-describedby={error ? "auth-error" : undefined}
          />
        </div>
        {error && (
          <p id="auth-error" role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={loading}>
          {isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {isLogin ? "New here? " : "Already registered? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
