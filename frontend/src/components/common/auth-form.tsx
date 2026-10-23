"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { persistToken, useAuthStore } from "@/lib/auth-store";
import { errorMessage } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

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
  const googleRef = useRef<HTMLDivElement>(null);
  const [googleId, setGoogleId] = useState("");

  const finish = (res: Awaited<ReturnType<typeof api.auth.login>>) => {
    persistToken(res.access_token);
    setUser(res.user);
    setReady(true);
    if (res.user.settings?.theme) setTheme(res.user.settings.theme);
    router.replace("/dashboard");
  };

  // Google sign-in is optional: the button only appears if the server has a client id.
  useEffect(() => {
    let cancelled = false;
    api.auth.config().then((c) => !cancelled && setGoogleId(c.google_client_id || "")).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!googleId) return;
    const render = () => {
      if (!window.google || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleId,
        callback: async ({ credential }) => {
          setError("");
          try { finish(await api.auth.google(credential)); } catch (err) { setError(errorMessage(err)); }
        },
      });
      window.google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", width: 320, text: "continue_with" });
    };
    if (window.google) { render(); return; }
    const tag = document.createElement("script");
    tag.src = "https://accounts.google.com/gsi/client";
    tag.async = true;
    tag.onload = render;
    document.head.appendChild(tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleId]);

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
      finish(res);
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
      {googleId && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>
          <div ref={googleRef} className="flex justify-center" />
        </div>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        {isLogin ? "New here? " : "Already registered? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
