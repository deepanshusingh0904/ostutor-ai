"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, MessageSquare, PanelLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/hooks/use-chat";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { CHAT_PROMPTS, PROFESSOR_PROMPTS } from "@/lib/constants";
import type { ChatMode, Conversation } from "@/lib/types";
import { ChatInput } from "./chat-input";
import { ConversationList } from "./conversation-list";
import { LessonTracker } from "./lesson-tracker";
import { MessageItem } from "./message-item";

export function ChatWorkspace({ mode }: { mode: ChatMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const activeId = params.get("c") ? Number(params.get("c")) : null;
  const [items, setItems] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const select = useCallback((id: number | null) => {
    router.replace(id ? `${pathname}?c=${id}` : pathname);
    setListOpen(false);
  }, [pathname, router]);

  const upsert = useCallback((c: Partial<Conversation> & { id: number }) => {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === c.id);
      const next = exists ? prev.map((p) => (p.id === c.id ? { ...p, ...c } : p)) : [{ title: "New conversation", mode, topic: "", pinned: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...c } as Conversation, ...prev];
      return next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
    });
  }, [mode]);

  const chat = useChat({ mode, conversationId: activeId, onConversationUpdate: upsert, onConversationCreated: (id) => router.replace(`${pathname}?c=${id}`) });
  const { messages, streaming, loading, error } = chat;

  useEffect(() => {
    setListLoading(true);
    api.chat.list(undefined, mode).then(setItems).catch(() => setItems([])).finally(() => setListLoading(false));
  }, [mode]);

  // Keep the view pinned to the newest token unless the reader scrolled up.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const handleSend = (text: string) => {
    stickToBottom.current = true;
    chat.send(text);
  };

  const showCitations = user?.settings?.show_citations !== false;
  const professor = mode === "professor";
  const prompts = professor ? PROFESSOR_PROMPTS : CHAT_PROMPTS;
  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const listProps = { mode, activeId, items, setItems, onSelect: select, onSearchResults: () => undefined, loading: listLoading };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card/40 md:block"><ConversationList {...listProps} /></aside>
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent title={professor ? "Lessons" : "Conversations"} className="left-0 top-0 h-full max-h-none w-80 max-w-none translate-x-0 translate-y-0 rounded-none p-0 pt-14">
          <ConversationList {...listProps} />
        </DialogContent>
      </Dialog>

      <section className="flex min-w-0 flex-1 flex-col" aria-label={professor ? "AI Professor" : "Chat"}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setListOpen(true)}><PanelLeft />History</Button>
        </div>
        <div ref={scroller} onScroll={onScroll} className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {loading ? (
              <div className="space-y-6"><Skeleton className="ml-auto h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">{professor ? <GraduationCap className="size-7" /> : <MessageSquare className="size-7" />}</span>
                <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">{professor ? "What shall we learn today?" : "Ask your course material"}</h1>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {professor ? "I'll teach one idea at a time, draw diagrams, and check your understanding as we go." : "Answers come only from the faculty-approved documents, with page citations you can open."}
                </p>
                <p className="mt-3 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden />Grounded in approved course notes</p>
                <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {prompts.map((p) => (
                    <button key={p} onClick={() => handleSend(p)} className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5">{p}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-7">
                {messages.map((m, i) => (
                  <MessageItem
                    key={`${m.id}-${i}`} message={m} conversationId={activeId} isLast={i === messages.length - 1} streaming={streaming}
                    showCitations={showCitations} onRegenerate={chat.regenerate} onContinue={chat.continueGeneration} onEdit={chat.edit}
                  />
                ))}
              </div>
            )}
            {error && (
              <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <span>{error}</span>
                <Button size="sm" variant="ghost" onClick={() => chat.setError(null)}>Dismiss</Button>
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          {professor && messages.length > 0 && <LessonTracker turns={assistantTurns} />}
          <ChatInput onSend={handleSend} onStop={chat.stop} streaming={streaming} placeholder={professor ? "Answer the professor or name a topic to learn..." : "Ask a question about your course material..."} />
          <p className="mt-2 text-center text-xs text-muted-foreground">OSTutor answers only from approved material. Check the cited sources for anything important.</p>
        </div>
      </section>
    </div>
  );
}
