"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { Logo } from "./logo";
import { FOOTER_NAV, NAV_GROUPS, type NavItem } from "./nav";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Logo className="px-1" />
      <nav aria-label="Main" className="scroll-thin flex-1 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-xs font-medium text-muted-foreground/80">{group.label}</p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-border pt-3">
        {FOOTER_NAV.filter((i) => !i.adminOnly || user?.role === "admin").map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 border-y-0 border-l-0 lg:block">
      <SidebarContent />
    </aside>
  );
}
