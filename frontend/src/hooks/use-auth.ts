"use client";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { getToken, useAuthStore } from "@/lib/auth-store";

/** Loads the current user once from the stored token and syncs the saved theme preference. */
export function useAuthBootstrap() {
  const { user, ready, setUser, setReady, logout } = useAuthStore();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (ready) return;
    if (!getToken()) {
      setReady(true);
      return;
    }
    api.auth
      .me()
      .then((me) => {
        setUser(me);
        if (me.settings?.theme) setTheme(me.settings.theme);
      })
      .catch(() => logout())
      .finally(() => setReady(true));
  }, [ready, setReady, setUser, logout, setTheme]);

  return { user, ready };
}
