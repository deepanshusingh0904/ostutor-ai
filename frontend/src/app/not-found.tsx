import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-6xl font-semibold text-primary">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">This page isn't on the syllabus</h1>
        <p className="mt-1 text-sm text-muted-foreground">The link may be old, or the page was moved.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
