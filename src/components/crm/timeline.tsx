"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button, Card, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/lib/utils";
import { dueState, fmtDate, fmtDateTime, fmtDue, fmtTime } from "@/lib/crm/format";
import type { ActivityDTO } from "@/lib/crm/types";
import { ACTIVITY_META, ActivityIcon } from "./bits";
import { api } from "./client-api";
import { useSynced } from "./use-lead";

const PLACEHOLDER: Record<string, string> = {
  note: "Scrivi una nota…",
  call: "Com'è andata la chiamata?",
  email: "Cosa hai scritto o ricevuto?",
  meeting: "Cosa è emerso durante la visita?",
  task: "Cosa devi fare? Es. Portare i campioni",
};

/** Valore di default per <input type="datetime-local">: domani alle 9:00 (ora locale). */
function tomorrowAtNine() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

export function Timeline({ leadId, activities: initial }: { leadId: string; activities: ActivityDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useSynced(initial);
  const [type, setType] = useState<string>("note");
  const [content, setContent] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const open = useMemo(() => items.filter((a) => !a.done && a.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!)), [items]);
  const history = useMemo(() => items.filter((a) => !open.includes(a)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [items, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const dueAt = type === "task" ? (due ? new Date(due).toISOString() : new Date(tomorrowAtNine()).toISOString()) : null;
    setSaving(true);
    const res = await api<{ activity: ActivityDTO }>(`/api/leads/${leadId}/activities`, "POST", { type, content, dueAt });
    setSaving(false);
    if (!res.ok) return toast(res.error, "error");
    setItems((list) => [res.data.activity, ...list]);
    setContent("");
    setDue("");
    toast(type === "task" ? "Promemoria aggiunto" : "Attività registrata");
    router.refresh();
  }

  async function update(id: string, data: Partial<ActivityDTO>) {
    const before = items;
    setItems((list) => list.map((a) => (a.id === id ? { ...a, ...data } : a)));
    const res = await api<{ activity: ActivityDTO }>(`/api/activities/${id}`, "PATCH", data);
    if (!res.ok) {
      setItems(before);
      toast(res.error, "error");
      return false;
    }
    router.refresh();
    return true;
  }

  async function remove(id: string) {
    const before = items;
    setItems((list) => list.filter((a) => a.id !== id));
    const res = await api(`/api/activities/${id}`, "DELETE");
    if (!res.ok) {
      setItems(before);
      return toast(res.error, "error");
    }
    toast("Attività eliminata", "info");
    router.refresh();
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">Attività</h2>

      <form onSubmit={submit} className="rounded-xl border border-line bg-bg/60 p-3">
        <div className="mb-2 flex gap-1 overflow-x-auto pb-1" role="radiogroup" aria-label="Tipo di attività">
          {ACTIVITY_TYPES.map((t) => {
            const Icon = ACTIVITY_META[t.id].icon;
            const active = type === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={active} onClick={() => setType(t.id)}
                className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition",
                  active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                <Icon className="h-3.5 w-3.5" aria-hidden />{t.label}
              </button>
            );
          })}
        </div>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={PLACEHOLDER[type]} rows={2} maxLength={5000}
          aria-label="Testo dell'attività" className="min-h-[64px] bg-surface"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }} />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {type === "task" ? (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Scadenza
              <input type="datetime-local" value={due || tomorrowAtNine()} onChange={(e) => setDue(e.target.value)}
                className="h-8 rounded-full border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
            </label>
          ) : <span className="hidden text-[12px] text-ink-3 sm:block">Ctrl + Invio per salvare</span>}
          <Button type="submit" size="sm" loading={saving} disabled={!content.trim()} className="self-end sm:self-auto">
            {type === "task" ? "Aggiungi promemoria" : "Registra"}
          </Button>
        </div>
      </form>

      {open.length > 0 && (
        <section className="mt-6" aria-labelledby="todo-h">
          <h3 id="todo-h" className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Da fare</h3>
          <ul className="space-y-1">
            {open.map((a) => <ActivityItem key={a.id} a={a} onUpdate={update} onRemove={remove} />)}
          </ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="hist-h">
        <h3 id="hist-h" className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Cronologia</h3>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
            Nessuna attività ancora. Registra la prima chiamata o visita qui sopra.
          </p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[13.5px] before:top-3 before:w-px before:bg-line">
            {history.map((a) => <ActivityItem key={a.id} a={a} onUpdate={update} onRemove={remove} />)}
          </ol>
        )}
      </section>
    </Card>
  );
}

function ActivityItem({ a, onUpdate, onRemove }: {
  a: ActivityDTO; onUpdate: (id: string, d: Partial<ActivityDTO>) => Promise<boolean>; onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.content);
  const [menu, setMenu] = useState(false);
  const isTask = a.type === "task" || a.dueAt != null;
  const state = !a.done ? dueState(a.dueAt) : null;

  if (a.type === "stage") {
    return (
      <li className="relative flex items-center gap-3 py-1.5">
        <ActivityIcon type="stage" className="h-7 w-7 bg-bg ring-4 ring-surface" />
        <span className="text-[13px] text-ink-2">{a.content}</span>
        <time className="ml-auto shrink-0 text-[12px] text-ink-3" dateTime={a.createdAt}>{fmtDate(a.createdAt)}</time>
      </li>
    );
  }

  return (
    <li className="group relative flex gap-3 rounded-xl py-2 pr-1">
      {isTask ? (
        <button type="button" onClick={() => onUpdate(a.id, { done: !a.done })} role="checkbox" aria-checked={a.done}
          aria-label={a.done ? "Segna come da fare" : "Segna come fatto"}
          className={cn("relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ring-4 ring-surface transition",
            a.done ? "border-success bg-success text-white" : state === "overdue" ? "border-danger bg-surface hover:bg-danger-soft" : "border-line-strong bg-surface hover:border-ink-3")}>
          {a.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>
      ) : (
        <ActivityIcon type={a.type} className="relative ring-4 ring-surface" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
          <span className="font-semibold text-ink-2">{ACTIVITY_META[a.type]?.label ?? a.type}</span>
          {a.dueAt && (
            <span className={cn("font-medium", a.done ? "text-ink-3" : state === "overdue" ? "text-danger" : state === "today" ? "text-warn" : "text-ink-3")}>
              {a.done ? "Completato" : state === "overdue" ? "Scaduto" : "Scadenza"} · {fmtDue(a.dueAt)}, {fmtTime(a.dueAt)}
            </span>
          )}
          <time className="text-ink-3" dateTime={a.createdAt}>{a.dueAt ? "" : fmtDateTime(a.createdAt)}</time>
        </div>
        {editing ? (
          <form className="mt-1.5" onSubmit={async (e) => { e.preventDefault(); if (draft.trim() && (await onUpdate(a.id, { content: draft.trim() }))) setEditing(false); }}>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus aria-label="Modifica attività"
              onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Annulla</Button>
              <Button type="submit" size="sm">Salva</Button>
            </div>
          </form>
        ) : (
          <p className={cn("mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed", a.done && isTask && "text-ink-3 line-through")}>{a.content}</p>
        )}
      </div>
      {!editing && (
        <div className="relative shrink-0">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Altre azioni" aria-expanded={menu}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition hover:bg-surface-2 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 aria-expanded:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
              <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop" role="menu">
                <button role="menuitem" type="button" onClick={() => { setMenu(false); setDraft(a.content); setEditing(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" />Modifica</button>
                <button role="menuitem" type="button" onClick={() => { setMenu(false); onRemove(a.id); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"><Trash2 className="h-3.5 w-3.5" />Elimina</button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
