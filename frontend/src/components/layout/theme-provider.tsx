"use client";
import { ThemeProvider as NextThemes } from "next-themes";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem storageKey="ostutor.theme" disableTransitionOnChange>
      {children}
      <Toaster />
    </NextThemes>
  );
}
