import { Suspense } from "react";
import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata: Metadata = { title: "AI Professor" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChatWorkspace mode="professor" />
    </Suspense>
  );
}
