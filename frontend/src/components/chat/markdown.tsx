"use client";
import { Children, isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "./code-block";
import { MermaidDiagram } from "./mermaid-diagram";

export function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children);
  return "";
}

/** Turn [1] style citations into links, leaving fenced code untouched. */
export function linkCitations(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?(?:```|$))/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/(?<![\w\]\)`])\[(\d{1,2})\](?!\()/g, "[$1](#cite-$1)")))
    .join("");
}

interface MarkdownProps {
  content: string;
  streaming?: boolean;
  onCite?: (index: number) => void;
}

function MarkdownImpl({ content, streaming = false, onCite }: MarkdownProps) {
  const components: Components = {
    pre({ children }) {
      const child = Children.toArray(children)[0];
      if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
        const language = /language-([\w-]+)/.exec(child.props.className ?? "")?.[1] ?? "";
        const text = extractText(child.props.children).replace(/\n$/, "");
        if (language === "mermaid") return <MermaidDiagram code={text} streaming={streaming} />;
        return <CodeBlock language={language} text={text}>{child}</CodeBlock>;
      }
      return <pre>{children}</pre>;
    },
    a({ href, children }) {
      const cite = href?.match(/^#cite-(\d+)$/);
      if (cite) {
        const index = Number(cite[1]);
        return (
          <button
            type="button"
            onClick={() => onCite?.(index)}
            className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-0.5 items-center justify-center rounded-md bg-primary/15 px-1 align-middle text-[11px] font-semibold text-primary hover:bg-primary/25"
            aria-label={`Open source ${index}`}
          >
            {index}
          </button>
        );
      }
      return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>;
    },
    table({ children }) {
      return <div className="scroll-thin my-4 overflow-x-auto rounded-lg border border-border"><table>{children}</table></div>;
    },
  };

  return (
    <div className="prose-ostutor break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
        urlTransform={(url) => url}
      >
        {linkCitations(content)}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
