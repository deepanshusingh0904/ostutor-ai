import { GraduationCap, Network, Quote, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const points = [
  { icon: ShieldCheck, text: "Answers come only from documents your faculty approved, with page-level citations." },
  { icon: GraduationCap, text: "A professor that teaches step by step and checks your understanding as it goes." },
  { icon: Network, text: "Flowcharts, state diagrams and trees drawn for you, and zoomable." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[hsl(172_60%_12%)] p-12 text-[hsl(150_30%_94%)] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(hsl(150 30% 94%) 1px, transparent 1px), linear-gradient(90deg, hsl(150 30% 94%) 1px, transparent 1px)", backgroundSize: "36px 36px" }}
        />
        <div className="relative [&_span]:!text-[hsl(150_30%_94%)] [&_span.bg-primary]:!bg-[hsl(168_66%_48%)] [&_span.bg-primary]:!text-[hsl(172_60%_10%)]">
          <Logo href="/login" />
        </div>
        <div className="relative max-w-md">
          <Quote className="size-8 text-[hsl(168_66%_55%)]" aria-hidden />
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight">Learn it the way a good lecture teaches it.</h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm leading-6 text-[hsl(150_20%_82%)]">
                <Icon className="mt-1 size-4 shrink-0 text-[hsl(168_66%_55%)]" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[hsl(150_15%_70%)]">Built on retrieval-augmented generation. Your instructor decides what the tutor knows.</p>
      </aside>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <div className="lg:hidden"><Logo href="/login" /></div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">{children}</div>
      </div>
    </div>
  );
}
