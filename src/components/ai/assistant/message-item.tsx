"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Database, ExternalLink, Globe, RotateCcw } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { hostOf, type ChatAction, type ChatMessageView, type Source } from "@/lib/ai/schemas";
import { copyText } from "../ndjson";
import { RechargeLink } from "@/components/credits/no-credits";

export type UiMessage = ChatMessageView & { streaming?: boolean; status?: string | null; error?: string | null; noCredits?: boolean };

export function AssistantMark({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-bg", className)} aria-hidden>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="var(--accent)" /></svg>
    </div>
  );
}

function ActionChip({ action }: { action: ChatAction }) {
  if (action.write) {
    return (
      <div className={cn(
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[13px]",
        action.ok ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger",
      )}>
        {action.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{action.ok ? "Azione eseguita" : "Azione non riuscita"}</span>
          <span className="text-ink-2"> · {action.label}</span>
        </span>
        {action.ok && action.leadId && (
          <Link href={`/app/leads/${action.leadId}`} className="shrink-0 font-medium underline-offset-2 hover:underline">Apri</Link>
        )}
      </div>
    );
  }
  return (
    <span className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-2",
      !action.ok && "border-danger/30 text-danger",
    )}>
      <Database className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{action.label}</span>
    </span>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Fonti</div>
      <ul className="flex flex-wrap gap-1.5">
        {sources.slice(0, 8).map((s, i) => (
          <li key={s.url} className="max-w-full">
            <a
              href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}
              className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-2 transition hover:border-line-strong hover:text-ink"
            >
              <span className="font-mono text-[10.5px] text-ink-3">{i + 1}</span>
              <Globe className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{s.title || hostOf(s.url)}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-ink-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MessageItem({ message: m, onRetry }: { message: UiMessage; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[14.5px] leading-relaxed text-bg sm:max-w-[75%]">
          {m.content}
        </div>
      </div>
    );
  }

  const reads = (m.actions ?? []).filter((a) => !a.write);
  const writes = (m.actions ?? []).filter((a) => a.write);
  const empty = !m.content.trim();

  return (
    <div className="flex gap-3">
      <AssistantMark className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {reads.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">{reads.map((a, i) => <ActionChip key={i} action={a} />)}</div>
        )}
        {writes.length > 0 && (
          <div className="mb-3 space-y-1.5">{writes.map((a, i) => <ActionChip key={i} action={a} />)}</div>
        )}

        {empty && m.streaming ? (
          <div className="flex h-7 items-center gap-2 text-sm text-ink-2" role="status">
            {m.status ? <><Spinner className="h-3.5 w-3.5" /> {m.status}</> : <TypingDots />}
          </div>
        ) : (
          !empty && <Markdown className="text-ink">{m.content}</Markdown>
        )}

        {m.streaming && !empty && m.status && (
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-2" role="status"><Spinner className="h-3.5 w-3.5" /> {m.status}</div>
        )}

        {m.error && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{m.error}</span>
            {m.noCredits && <RechargeLink />}
            {onRetry && !m.noCredits && (
              <button onClick={onRetry} className="inline-flex items-center gap-1 font-medium hover:underline">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />Riprova
              </button>
            )}
          </div>
        )}

        {(m.sources?.length ?? 0) > 0 && <Sources sources={m.sources!} />}

        {!m.streaming && !empty && (
          <div className="mt-2 flex items-center gap-1 text-ink-3">
            <button
              onClick={async () => {
                if (await copyText(m.content)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-surface-2 hover:text-ink"
              aria-label="Copia risposta"
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? "Copiato" : "Copia"}
            </button>
            {m.demo && <span className="ml-1 text-[11px]">Risposta dimostrativa</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Sto scrivendo">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
  );
}
