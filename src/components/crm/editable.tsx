"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Textarea } from "@/components/ui";

type Kind = "text" | "tel" | "email" | "url" | "number" | "textarea" | "date";

/** Campo modificabile inline: clic per modificare, Invio/blur per salvare, Esc per annullare. */
export function EditableField({ label, value, onSave, kind = "text", placeholder, display, icon, className, inputMode }: {
  label: string;
  value: string | null;
  onSave: (value: string | null) => Promise<boolean> | boolean;
  kind?: Kind;
  placeholder?: string;
  display?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function start() {
    setDraft(value ?? "");
    setEditing(true);
  }
  async function commit() {
    const next = draft.trim() === "" ? null : draft.trim();
    if (next === (value ?? null)) return setEditing(false);
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setEditing(false);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
    if (e.key === "Enter" && (kind !== "textarea" || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
  }

  return (
    <div className={cn("group min-w-0", className)}>
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
        {icon}{label}
      </label>
      {editing ? (
        <div className="flex items-start gap-1.5">
          {kind === "textarea" ? (
            <Textarea id={id} ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} rows={5} placeholder={placeholder} disabled={saving} className="text-sm" />
          ) : (
            <Input id={id} ref={ref} type={kind === "number" ? "text" : kind} inputMode={inputMode ?? (kind === "number" ? "decimal" : undefined)}
              value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} disabled={saving} className="h-9" />
          )}
          <button type="button" onClick={commit} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-bg hover:bg-ink/85" aria-label="Salva">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Annulla">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex min-h-9 items-start gap-1">
          <div className={cn("min-w-0 flex-1 py-1.5 text-sm", kind === "textarea" && "whitespace-pre-wrap leading-relaxed")}>
            {value ? (display ?? <span className="break-words">{value}</span>) : (
              <button id={id} type="button" onClick={start} className="text-left text-ink-3 hover:text-ink-2">{placeholder ?? "Aggiungi"}</button>
            )}
          </div>
          <button id={value ? id : undefined} type="button" onClick={start}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 opacity-100 transition hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Modifica ${label.toLowerCase()}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Editor dei tag a "chip". */
export function TagsEditor({ tags, onSave }: { tags: string[]; onSave: (tags: string[]) => Promise<boolean> | boolean }) {
  const [draft, setDraft] = useState("");
  async function add() {
    const items = draft.split(",").map((t) => t.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...tags];
    for (const t of items) if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    if (await onSave(next)) setDraft("");
  }
  return (
    <div>
      <label htmlFor="tag-input" className="mb-1 block text-[12px] font-medium text-ink-3">Tag</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-[12.5px] text-ink-2">
            {t}
            <button type="button" onClick={() => onSave(tags.filter((x) => x !== t))} className="rounded-full p-0.5 text-ink-3 hover:bg-line hover:text-ink" aria-label={`Rimuovi tag ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input id="tag-input" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          onBlur={add}
          placeholder={tags.length ? "Aggiungi…" : "Aggiungi un tag e premi Invio"}
          className="h-7 min-w-[8rem] flex-1 rounded-full bg-transparent px-2 text-[13px] text-ink placeholder:text-ink-3 focus:bg-surface-2 focus:outline-none" />
      </div>
    </div>
  );
}
