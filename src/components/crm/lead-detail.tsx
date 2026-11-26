"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Briefcase, CalendarClock, Euro, Globe, Mail, MapPin, MapPinned, Phone, Sparkles, Trash2, User } from "lucide-react";
import { Button, Card, Dialog, ScoreBadge, useToast } from "@/components/ui";
import { formatEuro } from "@/lib/utils";
import { dayKey, dueState, fmtDate, mapsUrl, telHref, websiteHref } from "@/lib/crm/format";
import type { LeadDTO } from "@/lib/crm/types";
import { FollowUpBadge, StageDot, StageSelect } from "./bits";
import { api } from "./client-api";
import { EditableField, TagsEditor } from "./editable";
import { LostReasonDialog } from "./lost-reason-dialog";
import { useLeadPatch } from "./use-lead";

export function LeadHeader({ lead: initial }: { lead: LeadDTO }) {
  const router = useRouter();
  const toast = useToast();
  const { lead, patch } = useLeadPatch(initial);
  const [askLost, setAskLost] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const res = await api(`/api/leads/${lead.id}`, "DELETE");
    setDeleting(false);
    if (!res.ok) return toast(res.error, "error");
    toast("Cliente eliminato");
    router.push("/app/leads");
    router.refresh();
  }

  return (
    <header className="mb-6">
      <Link href="/app/leads" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />Clienti
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            {lead.category && <span>{lead.category}</span>}
            {lead.category && lead.city && <span className="text-ink-3" aria-hidden>·</span>}
            {lead.city && <span>{lead.city}</span>}
          </div>
          <EditableName name={lead.name} onSave={(name) => patch({ name })} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Fase</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><StageDot stage={lead.stage} /></span>
              <StageSelect value={lead.stage} aria-label="Fase del cliente"
                onChange={(s) => (s === "lost" ? setAskLost(true) : patch({ stage: s }, { success: "Fase aggiornata" }))}
                className="h-8 w-auto rounded-full pl-7 text-[13px] font-medium" />
            </label>
            <ScoreBadge score={lead.score} className="h-8 px-3" />
            {lead.value != null && (
              <span className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-[13px] font-medium tabular-nums">{formatEuro(lead.value)}</span>
            )}
            {lead.stage === "lost" && lead.lostReason && (
              <span className="inline-flex h-8 items-center rounded-full bg-danger-soft px-3 text-[13px] text-danger">Motivo: {lead.lostReason}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <a href={telHref(lead.phone)}><Button variant="secondary"><Phone className="h-4 w-4" />Chiama</Button></a>
          )}
          <a href={mapsUrl(lead)} target="_blank" rel="noopener noreferrer"><Button variant="outline"><MapPinned className="h-4 w-4" /><span className="sm:hidden">Mappa</span><span className="hidden sm:inline">Apri in Google Maps</span></Button></a>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-ink-3 hover:text-danger" onClick={() => setConfirmDelete(true)} aria-label="Elimina cliente" title="Elimina cliente">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LostReasonDialog open={askLost} leadName={lead.name} onCancel={() => setAskLost(false)}
        onConfirm={(r) => { setAskLost(false); patch({ stage: "lost", lostReason: r }, { success: "Segnato come perso" }); }} />
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminare questo cliente?">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">{lead.name}</span> verrà eliminato insieme a note, attività e briefing. L&apos;operazione non si può annullare.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annulla</Button>
          <Button variant="danger" onClick={remove} loading={deleting}>Elimina definitivamente</Button>
        </div>
      </Dialog>
    </header>
  );
}

function EditableName({ name, onSave }: { name: string; onSave: (v: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  async function commit() {
    const v = draft.trim();
    if (!v || v === name) { setEditing(false); setDraft(name); return; }
    if (await onSave(v)) setEditing(false);
  }
  return editing ? (
    <input value={draft} autoFocus aria-label="Nome del cliente" maxLength={160} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(name); } }}
      className="w-full rounded-xl border border-line bg-surface px-2 font-display text-[34px] leading-tight tracking-tight focus:outline-none focus:ring-4 focus:ring-ink/5 sm:text-[40px]" />
  ) : (
    <h1 className="font-display text-[34px] leading-[1.05] tracking-tight break-words sm:text-[40px]">
      <button type="button" onClick={() => { setDraft(name); setEditing(true); }} className="text-left hover:text-ink-2" title="Clicca per rinominare">{name}</button>
    </h1>
  );
}

export function LeadInfoCard({ lead: initial }: { lead: LeadDTO }) {
  const { lead, patch } = useLeadPatch(initial);
  const save = (field: keyof LeadDTO) => (v: string | null) => patch({ [field]: v });
  const follow = dueState(lead.nextFollowUp);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Dati del cliente</h2>
        <span className="hidden text-[12px] text-ink-3 sm:inline">Clicca su un campo per modificarlo</span>
      </div>

      {/* Follow-up in evidenza */}
      <div className={`mb-5 flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${follow === "overdue" ? "border-danger/30 bg-danger-soft/60" : follow === "today" ? "border-warn/30 bg-warn-soft/60" : "border-line bg-bg/60"}`}>
        <div className="flex items-center gap-3">
          <CalendarClock className={`h-5 w-5 ${follow === "overdue" ? "text-danger" : follow === "today" ? "text-warn" : "text-ink-3"}`} aria-hidden />
          <div>
            <div className="text-[12px] font-medium text-ink-3">Prossimo follow-up</div>
            <div className="text-sm font-medium">
              {lead.nextFollowUp ? (
                <>
                  {follow !== "later" && <><FollowUpBadge date={lead.nextFollowUp} compact className="!bg-transparent !p-0" /><span className="font-normal text-ink-3"> · </span></>}
                  <span className={follow === "later" ? "" : "font-normal text-ink-2"}>{fmtDate(lead.nextFollowUp, { weekday: "long", day: "numeric", month: "long" })}</span>
                </>
              ) : <span className="text-ink-3">Nessuno programmato</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="followup" className="sr-only">Data del prossimo follow-up</label>
          <input id="followup" type="date" value={lead.nextFollowUp ? dayKey(lead.nextFollowUp) : ""}
            onChange={(e) => patch({ nextFollowUp: e.target.value || null }, { success: e.target.value ? "Follow-up programmato" : "Follow-up rimosso" })}
            className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-4 focus:ring-ink/5" />
          {[1, 7].map((d) => (
            <button key={d} type="button" onClick={() => patch({ nextFollowUp: plusDays(d) }, { success: "Follow-up programmato" })}
              className="h-9 rounded-full border border-line bg-surface px-3 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {d === 1 ? "Domani" : "Tra 1 settimana"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <EditableField label="Telefono" icon={<Phone className="h-3 w-3" />} kind="tel" value={lead.phone} onSave={save("phone")} placeholder="Aggiungi telefono"
          display={lead.phone && <a href={telHref(lead.phone)} className="font-medium hover:underline">{lead.phone}</a>} />
        <EditableField label="Email" icon={<Mail className="h-3 w-3" />} kind="email" value={lead.email} onSave={save("email")} placeholder="Aggiungi email"
          display={lead.email && <a href={`mailto:${lead.email}`} className="break-all hover:underline">{lead.email}</a>} />
        <EditableField label="Sito web" icon={<Globe className="h-3 w-3" />} kind="url" value={lead.website} onSave={save("website")} placeholder="Aggiungi sito"
          display={lead.website && <a href={websiteHref(lead.website)} target="_blank" rel="noopener noreferrer" className="break-all hover:underline">{lead.website.replace(/^https?:\/\/(www\.)?/, "")}</a>} />
        <EditableField label="Valore potenziale" icon={<Euro className="h-3 w-3" />} kind="number" value={lead.value != null ? String(lead.value) : null}
          onSave={(v) => patch({ value: v })} placeholder="Stima il valore annuo"
          display={<span className="font-medium tabular-nums">{formatEuro(lead.value)}</span>} />
        <EditableField label="Indirizzo" icon={<MapPin className="h-3 w-3" />} value={lead.address} onSave={save("address")} placeholder="Aggiungi indirizzo" />
        <EditableField label="Città" icon={<MapPin className="h-3 w-3" />} value={lead.city} onSave={save("city")} placeholder="Aggiungi città" />
        <EditableField label="Referente" icon={<User className="h-3 w-3" />} value={lead.contactName} onSave={save("contactName")} placeholder="Chi decide?" />
        <EditableField label="Ruolo" icon={<Briefcase className="h-3 w-3" />} value={lead.contactRole} onSave={save("contactRole")} placeholder="Es. Titolare" />
        <EditableField label="Categoria" value={lead.category} onSave={save("category")} placeholder="Es. Bar pasticceria" />
        <div className="sm:col-span-2"><TagsEditor tags={lead.tags} onSave={(tags) => patch({ tags })} /></div>
        <div className="border-t border-line pt-3 sm:col-span-2">
          <EditableField label="Note" kind="textarea" value={lead.notes} onSave={save("notes")} placeholder="Aggiungi note su abitudini, esigenze, concorrenza…" />
        </div>
      </div>
    </Card>
  );
}

function plusDays(n: number) {
  const d = new Date(Date.now() + n * 86_400_000);
  return dayKey(d);
}

export function LeadSideInfo({ lead }: { lead: LeadDTO }) {
  const rows: [string, React.ReactNode][] = [
    ["Fonte", { osm: "OpenStreetMap", google: "Google", demo: "Dati dimostrativi", manual: "Inserito a mano", csv: "Importato da CSV" }[lead.source] ?? lead.source],
    ...(lead.rating != null ? [["Valutazione", `${lead.rating.toLocaleString("it-IT")} ★${lead.reviewsCount ? ` · ${lead.reviewsCount.toLocaleString("it-IT")} recensioni` : ""}`] as [string, string]] : []),
    ...(lead.openingHours ? [["Orari", lead.openingHours] as [string, string]] : []),
    ["Creato il", fmtDate(lead.createdAt, { day: "numeric", month: "long", year: "numeric" })],
    ["Aggiornato", fmtDate(lead.updatedAt, { day: "numeric", month: "long", year: "numeric" })],
  ];
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold">Informazioni</h2>
      <dl className="space-y-2.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function AskAssistantCard({ leadId, name }: { leadId: string; name: string }) {
  return (
    <Link href={`/app/assistant?leadId=${leadId}`}
      className="group flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 shadow-card transition hover:border-line-strong hover:bg-surface-2/50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Sparkles className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">Chiedi all&apos;assistente su questo cliente</span>
        <span className="block truncate text-[12.5px] text-ink-3">Strategia, obiezioni, email di follow-up per {name}</span>
      </span>
    </Link>
  );
}
