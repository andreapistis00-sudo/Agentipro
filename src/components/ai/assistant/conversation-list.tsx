"use client";
import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Plus, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/ai/schemas";

type Props = {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  touch?: boolean;
};

function bucket(iso: string, now: Date) {
  const d = new Date(iso);
  const key = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(x);
  if (key(d) === key(now)) return "Oggi";
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return "Ultimi 7 giorni";
  if (diff < 30) return "Ultimi 30 giorni";
  return "Meno recenti";
}

export function ConversationList({ conversations, activeId, onSelect, onNew, onRename, onDelete, touch }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const now = new Date();
  const groups: { label: string; items: ConversationSummary[] }[] = [];
  for (const c of conversations) {
    const label = bucket(c.updatedAt, now);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(c);
    else groups.push({ label, items: [c] });
  }

  function commit(id: string) {
    const t = draft.trim();
    if (t) onRename(id, t);
    setEditing(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <Button variant="outline" className="w-full justify-start" onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden />Nuova conversazione
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Conversazioni">
        {conversations.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-3">Le tue conversazioni appariranno qui.</p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{g.label}</div>
            <ul className="space-y-0.5">
              {g.items.map((c) => {
                const active = c.id === activeId;
                if (editing === c.id) {
                  return (
                    <li key={c.id} className="flex items-center gap-1 rounded-xl bg-surface px-2 py-1.5 shadow-card">
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit(c.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        maxLength={120}
                        aria-label="Nuovo titolo"
                        className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm outline-none"
                      />
                      <button onClick={() => commit(c.id)} className="rounded-md p-1 text-ink-2 hover:bg-surface-2" aria-label="Salva titolo"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditing(null)} className="rounded-md p-1 text-ink-3 hover:bg-surface-2" aria-label="Annulla"><X className="h-4 w-4" /></button>
                    </li>
                  );
                }
                return (
                  <li key={c.id} className="group relative">
                    <button
                      onClick={() => onSelect(c.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition",
                        active ? "bg-surface shadow-card" : "hover:bg-surface-2",
                        touch ? "pr-[4.5rem]" : "pr-3 group-hover:pr-[4.5rem] group-focus-within:pr-[4.5rem]",
                      )}
                    >
                      {c.lead ? <User className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> : <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />}
                      <span className="min-w-0">
                        <span className={cn("block truncate text-[13.5px]", active ? "font-medium text-ink" : "text-ink-2")}>{c.title}</span>
                        {c.lead && <span className="block truncate text-[11.5px] text-ink-3">{c.lead.name}</span>}
                      </span>
                    </button>
                    <div className={cn(
                      "absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center",
                      touch ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                    )}>
                      <button
                        onClick={() => { setDraft(c.title); setEditing(c.id); }}
                        className="rounded-lg p-1.5 text-ink-3 hover:bg-bg hover:text-ink"
                        aria-label={`Rinomina «${c.title}»`}
                      ><Pencil className="h-3.5 w-3.5" /></button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
                        aria-label={`Elimina «${c.title}»`}
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
