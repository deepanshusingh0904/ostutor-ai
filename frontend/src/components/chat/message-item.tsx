"use client";
import { memo, useState } from "react";
import { Bookmark, BookmarkCheck, Check, Copy, GraduationCap, Pencil, RefreshCw, StepForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage, toast } from "@/lib/toast";
import type { Message } from "@/lib/types";
import { truncate } from "@/lib/utils";
import { Citations } from "./citations";
import { Markdown } from "./markdown";

interface Props {
  message: Message;
  conversationId: number | null;
  isLast: boolean;
  streaming: boolean;
  showCitations: boolean;
  onRegenerate: () => void;
  onContinue: () => void;
  onEdit: (id: number, content: string) => void;
}

function ActionButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled} className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" aria-label={label} title={label}>
      {children}
    </Button>
  );
}

function MessageItemImpl({ message, conversationId, isLast, streaming, showCitations, onRegenerate, onContinue, onEdit }: Props) {
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [focusCitation, setFocusCitation] = useState<number | null>(null);
  const isUser = message.role === "user";
  const live = streaming && isLast && !isUser;

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const bookmark = async () => {
    if (bookmarked || message.id <= 0) return;
    try {
      const firstLine = message.content.replace(/^#+\s*/gm, "").split("\n").find((l) => l.trim()) ?? "Saved answer";
      await api.bookmarks.create({ kind: "message", title: truncate(firstLine, 80), content: message.content, ref_id: message.id, conversation_id: conversationId });
      setBookmarked(true);
      toast.success("Saved to bookmarks");
    } catch (e) {
      toast.error("Could not bookmark", errorMessage(e));
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="group max-w-[85%]">
          {editing ? (
            <div className="w-[min(36rem,80vw)] space-y-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[96px]" aria-label="Edit your message" autoFocus />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(message.content); }}>Cancel</Button>
                <Button size="sm" onClick={() => { setEditing(false); onEdit(message.id, draft); }} disabled={!draft.trim()}>Save and regenerate</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-[15px] leading-7 text-primary-foreground">{message.content}</div>
              {!streaming && message.id > 0 && (
                <div className="mt-1 flex justify-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <ActionButton label="Edit prompt" onClick={() => { setDraft(message.content); setEditing(true); }}><Pencil className="size-3.5" />Edit</ActionButton>
                  <ActionButton label="Copy prompt" onClick={copy}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</ActionButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary" aria-hidden>
        <GraduationCap className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        {message.content ? (
          <Markdown content={message.content} streaming={live} onCite={(i) => setFocusCitation(i)} />
        ) : (
          <div className="flex items-center gap-1.5 py-2" role="status" aria-label="Professor is thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
        {live && message.content && <span className="inline-block h-4 w-0.5 animate-caret bg-primary align-middle" aria-hidden />}
        {showCitations && !live && <Citations citations={message.citations ?? []} focusIndex={focusCitation} />}
        {!live && message.content && (
          <div className="mt-2 flex flex-wrap items-center gap-0.5">
            <ActionButton label="Copy answer" onClick={copy}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}</ActionButton>
            <ActionButton label="Bookmark answer" onClick={bookmark} disabled={message.id <= 0}>
              {bookmarked ? <BookmarkCheck className="size-3.5 text-primary" /> : <Bookmark className="size-3.5" />}Save
            </ActionButton>
            {isLast && !streaming && (
              <>
                <ActionButton label="Regenerate answer" onClick={onRegenerate}><RefreshCw className="size-3.5" />Regenerate</ActionButton>
                <ActionButton label="Continue generating" onClick={onContinue}><StepForward className="size-3.5" />Continue</ActionButton>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageItem = memo(MessageItemImpl);
