"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Rendering sicuro del markdown prodotto dall'AI (niente HTML grezzo). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-ai", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // Niente immagini remote: un contenuto web iniettato potrebbe usarle per esfiltrare dati (URL con parametri).
        disallowedElements={["img"]}
        unwrapDisallowed
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
