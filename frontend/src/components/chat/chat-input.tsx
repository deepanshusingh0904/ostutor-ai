"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  placeholder: string;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, streaming, placeholder, disabled }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    if (!value.trim() || streaming || disabled) return;
    onSend(value);
    setValue("");
  };

  return (
    <div className="glass rounded-2xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label="Message"
          disabled={disabled}
          className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {streaming ? (
          <Button size="icon" variant="secondary" onClick={onStop} aria-label="Stop generating" className="size-10 rounded-xl"><Square className="fill-current" /></Button>
        ) : (
          <Button size="icon" onClick={submit} disabled={!value.trim() || disabled} aria-label="Send message" className="size-10 rounded-xl"><ArrowUp /></Button>
        )}
      </div>
    </div>
  );
}
