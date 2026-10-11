"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api";
import { errorMessage, toast } from "@/lib/toast";
import type { ChatMode, Conversation } from "@/lib/types";
import { cn, groupByRecency } from "@/lib/utils";

interface Props {
  mode: ChatMode;
  activeId: number | null;
  items: Conversation[];
  setItems: React.Dispatch<React.SetStateAction<Conversation[]>>;
  onSelect: (id: number | null) => void;
  onSearchResults: (items: Conversation[] | null) => void;
  loading: boolean;
}

export function ConversationList({ mode, activeId, items, setItems, onSelect, onSearchResults, loading }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [searchItems, setSearchItems] = useState<Conversation[] | null>(null);

  useEffect(() => {
    if (!debounced.trim()) {
      setSearchItems(null);
      onSearchResults(null);
      return;
    }
    api.chat.list(debounced.trim(), mode).then((res) => {
      setSearchItems(res);
      onSearchResults(res);
    }).catch(() => undefined);
  }, [debounced, mode, onSearchResults]);

  const visible = searchItems ?? items;
  const groups = useMemo(() => groupByRecency(visible), [visible]);

  const patch = async (item: Conversation, data: { title?: string; pinned?: boolean }) => {
    try {
      const updated = await api.chat.update(item.id, data);
      setItems((prev) => prev.map((c) => (c.id === item.id ? updated : c)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)));
    } catch (e) {
      toast.error("Could not update chat", errorMessage(e));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api.chat.remove(deleting.id);
      setItems((prev) => prev.filter((c) => c.id !== deleting.id));
      if (activeId === deleting.id) onSelect(null);
      toast.success("Conversation deleted");
    } catch (e) {
      toast.error("Could not delete", errorMessage(e));
    } finally {
      setDeleting(null);
    }
  };

  const commitRename = (item: Conversation) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (title && title !== item.title) patch(item, { title });
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Button onClick={() => onSelect(null)} className="w-full justify-start"><Plus />{mode === "professor" ? "New lesson" : "New chat"}</Button>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="h-9 pl-9" aria-label="Search conversations" />
      </div>
      <div className="scroll-thin -mx-1 flex-1 space-y-4 overflow-y-auto px-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
        ) : groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{query ? "No conversations match your search." : "Nothing here yet. Start your first one!"}</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground/80">{group.label}</h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id} className={cn("group relative rounded-lg", activeId === item.id ? "bg-primary/12" : "hover:bg-muted")}>
                    {renamingId === item.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); commitRename(item); }} className="flex items-center gap-1 p-1">
                        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-7 text-sm" autoFocus aria-label="Conversation title" onKeyDown={(e) => e.key === "Escape" && setRenamingId(null)} />
                        <Button type="submit" variant="ghost" size="icon" className="size-7" aria-label="Save title"><Check /></Button>
                        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setRenamingId(null)} aria-label="Cancel rename"><X /></Button>
                      </form>
                    ) : (
                      <>
                        <button onClick={() => onSelect(item.id)} className={cn("flex w-full items-center gap-2 px-3 py-2 pr-20 text-left text-sm", activeId === item.id ? "font-medium text-primary" : "text-foreground/90")} aria-current={activeId === item.id ? "true" : undefined}>
                          {item.pinned && <Pin className="size-3 shrink-0 text-primary" aria-label="Pinned" />}
                          <span className="truncate">{item.title}</span>
                        </button>
                        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => patch(item, { pinned: !item.pinned })} aria-label={item.pinned ? "Unpin" : "Pin"}>{item.pinned ? <PinOff /> : <Pin />}</Button>
                          <Button variant="ghost" size="icon" className="size-7" onClick={() => { setRenamingId(item.id); setRenameValue(item.title); }} aria-label="Rename"><Pencil /></Button>
                          <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => setDeleting(item)} aria-label="Delete"><Trash2 /></Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent title="Delete conversation?" description={deleting ? `"${deleting.title}" and all its messages will be removed.` : undefined}>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
