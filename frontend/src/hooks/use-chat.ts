"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/toast";
import { streamChat, type StreamBody } from "@/lib/stream";
import type { ChatMode, Citation, Conversation, Message } from "@/lib/types";

const TEMP_ID = -1;

interface Options {
  mode: ChatMode;
  conversationId: number | null;
  /** Called when a conversation is created or its title/metadata changes, so the list can refresh. */
  onConversationUpdate: (conversation: Partial<Conversation> & { id: number }) => void;
  onConversationCreated: (id: number) => void;
}

export function useChat({ mode, conversationId, onConversationUpdate, onConversationCreated }: Options) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipLoadFor = useRef<number | null>(null);
  const bufferRef = useRef("");
  const frameRef = useRef<number | null>(null);

  // Load an existing conversation whenever the selected id changes.
  useEffect(() => {
    // A conversation we just created is already streaming into local state: don't abort or reload it.
    if (conversationId !== null && skipLoadFor.current === conversationId) {
      skipLoadFor.current = null;
      return;
    }
    abortRef.current?.abort();
    setError(null);
    if (conversationId === null) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.chat
      .get(conversationId)
      .then((detail) => !cancelled && setMessages(detail.messages))
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const flush = useCallback((append: boolean) => {
    const text = bufferRef.current;
    bufferRef.current = "";
    frameRef.current = null;
    if (!text) return;
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, content: append ? last.content + text : text };
      return copy;
    });
  }, []);

  const run = useCallback(
    async (cid: number, body: StreamBody, prepare: (prev: Message[]) => Message[]) => {
      setError(null);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const continuing = body.action === "continue";
      setMessages((prev) => {
        const next = prepare(prev);
        return continuing ? next : [...next, { id: TEMP_ID, role: "assistant", content: "", citations: [], created_at: new Date().toISOString() }];
      });
      try {
        await streamChat(
          cid,
          body,
          (event) => {
            switch (event.type) {
              case "meta":
                onConversationUpdate({ id: event.conversation_id, title: event.title, updated_at: new Date().toISOString() });
                break;
              case "citations":
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant" && !continuing) copy[copy.length - 1] = { ...last, citations: event.citations as Citation[] };
                  return copy;
                });
                break;
              case "token":
                bufferRef.current += event.content;
                if (frameRef.current === null) frameRef.current = requestAnimationFrame(() => flush(true));
                break;
              case "error":
                setError(event.message);
                break;
              case "done":
                if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
                flush(true);
                onConversationUpdate({ id: cid, title: event.title, updated_at: new Date().toISOString() });
                break;
            }
          },
          controller.signal,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(errorMessage(e));
      } finally {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        flush(true);
        setStreaming(false);
        abortRef.current = null;
        // Re-sync with the server so message ids (needed for edit/bookmark) are real.
        try {
          const detail = await api.chat.get(cid);
          setMessages(detail.messages);
        } catch {
          /* keep local state */
        }
      }
    },
    [flush, onConversationUpdate],
  );

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (conversationId !== null) return conversationId;
    const created = await api.chat.create(mode);
    skipLoadFor.current = created.id;
    onConversationUpdate(created);
    onConversationCreated(created.id);
    return created.id;
  }, [conversationId, mode, onConversationCreated, onConversationUpdate]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || streaming) return;
      try {
        const cid = await ensureConversation();
        await run(cid, { action: "send", content: text }, (prev) => [
          ...prev,
          { id: 0, role: "user", content: text, citations: [], created_at: new Date().toISOString() },
        ]);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [ensureConversation, run, streaming],
  );

  const regenerate = useCallback(async () => {
    if (conversationId === null || streaming) return;
    await run(conversationId, { action: "regenerate" }, (prev) => {
      const copy = [...prev];
      while (copy.length && copy[copy.length - 1].role === "assistant") copy.pop();
      return copy;
    });
  }, [conversationId, run, streaming]);

  const edit = useCallback(
    async (messageId: number, content: string) => {
      if (conversationId === null || streaming || !content.trim()) return;
      await run(conversationId, { action: "edit", message_id: messageId, content: content.trim() }, (prev) => {
        const index = prev.findIndex((m) => m.id === messageId);
        if (index === -1) return prev;
        return [...prev.slice(0, index), { ...prev[index], content: content.trim() }];
      });
    },
    [conversationId, run, streaming],
  );

  const continueGeneration = useCallback(async () => {
    if (conversationId === null || streaming) return;
    await run(conversationId, { action: "continue" }, (prev) => prev);
  }, [conversationId, run, streaming]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, loading, streaming, error, setError, send, regenerate, edit, continueGeneration, stop };
}
