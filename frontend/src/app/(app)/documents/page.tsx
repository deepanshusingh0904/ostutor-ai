"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { errorMessage, toast } from "@/lib/toast";
import type { DocumentItem } from "@/lib/types";
import { cn, formatBytes, relativeTime } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.txt,.pptx,.md,.markdown";

function StatusBadge({ doc }: { doc: DocumentItem }) {
  if (doc.status === "ready") return <Badge variant="success"><CheckCircle2 className="size-3" aria-hidden />Ready</Badge>;
  if (doc.status === "failed") return <Badge variant="destructive"><AlertTriangle className="size-3" aria-hidden />Failed</Badge>;
  return <Badge variant="warning"><Loader2 className="size-3 animate-spin" aria-hidden />Indexing</Badge>;
}

export default function DocumentsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const { data, loading, reload } = useQuery(() => api.documents.list());
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processing = data?.some((d) => d.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const id = setInterval(reload, 2500);
    return () => clearInterval(id);
  }, [processing, reload]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      await api.documents.upload(file, title, subject);
      toast.success("Uploaded", "Indexing has started. This usually takes a few seconds.");
      setFile(null); setTitle(""); setSubject(""); if (inputRef.current) inputRef.current.value = "";
      reload();
    } catch (err) { toast.error("Upload failed", errorMessage(err)); }
    finally { setUploading(false); }
  };

  const reindex = async (d: DocumentItem) => {
    try { await api.documents.reindex(d.id); reload(); } catch (err) { toast.error("Could not re-index", errorMessage(err)); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try { await api.documents.remove(deleting.id); toast.success("Document removed from the knowledge base"); reload(); }
    catch (err) { toast.error("Could not delete", errorMessage(err)); }
    finally { setDeleting(null); }
  };

  return (
    <PageContainer>
      <PageHeader title="Course material" description={isAdmin ? "Only documents uploaded here are used by the tutor. Supported: PDF, DOCX, PPTX, TXT and Markdown." : "These faculty-approved documents are the only sources the tutor uses."} />
      <div className={cn("grid gap-6", isAdmin && "lg:grid-cols-[360px_1fr]")}>
        {isAdmin && (
          <Card className="h-fit">
            <CardHeader><CardTitle>Upload a document</CardTitle><CardDescription>It is cleaned, chunked, embedded and added to the vector store.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={upload} className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
                  className={cn("rounded-xl border-2 border-dashed p-6 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "border-border")}
                >
                  <UploadCloud className="mx-auto size-8 text-primary/70" aria-hidden />
                  <p className="mt-2 text-sm">{file ? <span className="font-medium">{file.name} <span className="text-muted-foreground">({formatBytes(file.size)})</span></span> : "Drag a file here or"}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>Browse files</Button>
                  <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a document" />
                </div>
                <div className="space-y-1.5"><Label htmlFor="d-title">Title</Label><Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shown in citations" /></div>
                <div className="space-y-1.5"><Label htmlFor="d-subject">Subject (optional)</Label><Input id="d-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Operating Systems" /></div>
                <Button type="submit" className="w-full" disabled={!file} loading={uploading}>Upload and index</Button>
              </form>
            </CardContent>
          </Card>
        )}
        <div className="space-y-3">
          {loading && !data ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />) : data?.length ? data.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center gap-4 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><FileText aria-hidden /></span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">{d.filename} · {formatBytes(d.size_bytes)}{d.status === "ready" && ` · ${d.page_count} pages · ${d.chunk_count} chunks`} · {relativeTime(d.created_at)}</p>
                {d.status === "failed" && <p className="mt-1 text-xs text-destructive">{d.error}</p>}
              </div>
              {d.subject && <Badge variant="outline">{d.subject}</Badge>}
              <StatusBadge doc={d} />
              {isAdmin && (
                <div className="flex">
                  <Button variant="ghost" size="icon" onClick={() => reindex(d)} aria-label={`Re-index ${d.title}`} title="Re-index"><RefreshCw /></Button>
                  <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => setDeleting(d)} aria-label={`Delete ${d.title}`}><Trash2 /></Button>
                </div>
              )}
            </Card>
          )) : <EmptyState icon={FileText} title="No course material yet" description={isAdmin ? "Upload your first document to power the tutor." : "Your instructor has not published any documents yet."} />}
        </div>
      </div>
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent title="Delete this document?" description="Its chunks are removed from the knowledge base, so the tutor can no longer cite it.">
          <div className="flex justify-end gap-2"><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button variant="destructive" onClick={confirmDelete}>Delete</Button></div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
