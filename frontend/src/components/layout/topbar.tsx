"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { initials } from "@/lib/utils";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const signOut = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-x-0 border-t-0 px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent title="Navigation" className="left-0 top-0 h-full max-h-none w-72 max-w-none translate-x-0 translate-y-0 rounded-none p-0">
          <SidebarContent onNavigate={() => setNavOpen(false)} />
        </DialogContent>
      </Dialog>

      <form onSubmit={submit} className="relative max-w-md flex-1" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, chats and bookmarks" className="h-9 pl-9" aria-label="Search" />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid size-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            {user ? initials(user.full_name) : "?"}
          </button>
          {menuOpen && (
            <div className="glass absolute right-0 top-11 w-60 rounded-xl p-2 shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium">{user?.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                <UserIcon className="size-4" aria-hidden /> Profile
              </Link>
              <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-muted">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
