"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Phone } from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dueState, fmtDue, fmtTime } from "@/lib/crm/format";
import { ACTIVITY_META } from "@/components/crm/bits";
import { api } from "@/components/crm/client-api";
import { telHref } from "@/lib/crm/format";
import type { DashboardData } from "@/lib/crm/dashboard";

type Todo = DashboardData["todos"][number];

/** "Da fare oggi": attività scadute/di oggi e follow-up, spuntabili inline (ottimistico). */
export function TodoList({ todos }: { todos: Todo[] }) {
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  // Le righe spuntate restano visibili (barrate) anche dopo il refresh dei dati dal server.
  const [kept, setKept] = useState<Map<string, Todo>>(new Map());
  const keyOf = (t: Todo) => `${t.kind}:${t.id}`;
  const live = new Set(todos.map(keyOf));
  const list = [...todos, ...[...kept.entries()].filter(([k]) => !live.has(k)).map(([, t]) => t)].sort((a, b) => a.due.localeCompare(b.due));

  async function toggle(t: Todo) {
    const key = keyOf(t);
    const wasDone = done.has(key);
    setKept((m) => new Map(m).set(key, t));
    setDone((s) => { const n = new Set(s); if (wasDone) n.delete(key); else n.add(key); return n; });
    const res = t.kind === "activity"
      ? await api(`/api/activities/${t.id}`, "PATCH", { done: !wasDone })
      : await api(`/api/leads/${t.id}`, "PATCH", { nextFollowUp: wasDone ? t.due : null });
    if (!res.ok) {
      setDone((s) => { const n = new Set(s); if (wasDone) n.add(key); else n.delete(key); return n; });
      return toast(res.error, "error");
    }
    if (!wasDone) toast(t.kind === "followup" ? "Follow-up completato" : "Fatto!");
    router.refresh(); // aggiorna KPI e attività recenti
  }

  return (
    <ul className="divide-y divide-line">
      {list.map((t) => {
        const key = keyOf(t);
        const isDone = done.has(key);
        const state = dueState(t.due);
        const label = t.kind === "followup" ? "Follow-up" : ACTIVITY_META[t.type]?.label ?? "Attività";
        return (
          <li key={key} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
            <button type="button" role="checkbox" aria-checked={isDone} onClick={() => toggle(t)}
              aria-label={isDone ? `Segna come da fare: ${t.content}` : `Segna come fatto: ${t.content}`}
              className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition",
                isDone ? "border-success bg-success text-white" : state === "overdue" ? "border-danger/70 hover:bg-danger-soft" : "border-line-strong hover:border-ink-3")}>
              {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm leading-snug", isDone && "text-ink-3 line-through")}>
                {t.kind === "followup" ? <>Ricontatta <span className="font-medium">{t.lead.name}</span></> : t.content}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-3">
                <span className={cn("font-medium", !isDone && state === "overdue" && "text-danger", !isDone && state === "today" && "text-warn")}>
                  {state === "overdue" ? `Scaduto · ${fmtDue(t.due)}` : t.kind === "activity" ? `Oggi, ${fmtTime(t.due)}` : "Oggi"}
                </span>
                <span aria-hidden>·</span>
                <span>{label}</span>
                {t.kind === "activity" && (
                  <>
                    <span aria-hidden>·</span>
                    <Link href={`/app/leads/${t.lead.id}`} className="truncate text-ink-2 hover:text-ink hover:underline">{t.lead.name}</Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {t.lead.phone && (
                <a href={telHref(t.lead.phone)} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Chiama ${t.lead.name}`}>
                  <Phone className="h-4 w-4" />
                </a>
              )}
              {t.kind === "followup" && (
                <Link href={`/app/leads/${t.lead.id}`} className="rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">Apri</Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
