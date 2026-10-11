import { Suspense } from "react";
import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata: Metadata = { title: "Ask the notes" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChatWorkspace mode="chat" />
    </Suspense>
  );
}
