import {
  Bookmark, BookOpenCheck, BrainCircuit, FileText, GalleryVerticalEnd, GraduationCap, LayoutDashboard, LineChart, MessageSquare,
  Mic, Network, Settings, ShieldCheck, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Learn",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/professor", label: "AI Professor", icon: GraduationCap },
      { href: "/chat", label: "Ask the notes", icon: MessageSquare },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/quiz", label: "Quizzes", icon: BrainCircuit },
      { href: "/viva", label: "Viva", icon: Mic },
      { href: "/flashcards", label: "Flashcards", icon: GalleryVerticalEnd },
    ],
  },
  {
    label: "Study tools",
    items: [
      { href: "/study-guide", label: "Study guides", icon: BookOpenCheck },
      { href: "/visual-lab", label: "Visual lab", icon: Network },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/documents", label: "Course material", icon: FileText },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/progress", label: "Progress", icon: LineChart },
    ],
  },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin panel", icon: ShieldCheck, adminOnly: true },
];
