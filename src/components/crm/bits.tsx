"use client";
// Piccoli componenti condivisi del CRM.
import { CalendarClock, CheckSquare, Mail, MapPin, MessageSquare, Phone, ArrowRightLeft } from "lucide-react";
import { STAGES } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { dueState, fmtDue } from "@/lib/crm/format";
import { Select } from "@/components/ui";

export const ACTIVITY_META: Record<string, { label: string; icon: typeof Phone; tone: string }> = {
  note: { label: "Nota", icon: MessageSquare, tone: "text-ink-2 bg-surface-2" },
  call: { label: "Chiamata", icon: Phone, tone: "text-info bg-info-soft" },
  email: { label: "Email", icon: Mail, tone: "text-ink-2 bg-surface-2" },
  meeting: { label: "Visita", icon: MapPin, tone: "text-success bg-success-soft" },
  task: { label: "Promemoria", icon: CheckSquare, tone: "text-warn bg-warn-soft" },
  stage: { label: "Cambio fase", icon: ArrowRightLeft, tone: "text-ink-3 bg-surface-2" },
};

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const meta = ACTIVITY_META[type] ?? ACTIVITY_META.note;
  const Icon = meta.icon;
  return (
    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", meta.tone, className)} aria-hidden>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** Data del prossimo follow-up, evidenziata se scaduta o di oggi. */
export function FollowUpBadge({ date, className, compact }: { date: string | null; className?: string; compact?: boolean }) {
  const state = dueState(date);
  if (!date || !state) return <span className={cn("text-ink-3", className)}>—</span>;
  const label = fmtDue(date);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full text-[12px] font-medium whitespace-nowrap",
        state === "overdue" && "bg-danger-soft px-2 py-0.5 text-danger",
        state === "today" && "bg-warn-soft px-2 py-0.5 text-warn",
        (state === "soon" || state === "later") && "text-ink-2",
        className,
      )}
      title={state === "overdue" ? "Follow-up scaduto" : state === "today" ? "Follow-up di oggi" : "Prossimo follow-up"}
    >
      {!compact && <CalendarClock className="h-3.5 w-3.5" aria-hidden />}
      {state === "overdue" && !compact ? `Scaduto · ${label}` : label}
    </span>
  );
}

export function StageSelect({ value, onChange, className, id, disabled, "aria-label": ariaLabel }: {
  value: string; onChange: (stage: string) => void; className?: string; id?: string; disabled?: boolean; "aria-label"?: string;
}) {
  return (
    <Select id={id} value={value} disabled={disabled} aria-label={ariaLabel ?? "Fase"} onChange={(e) => onChange(e.target.value)} className={className}>
      {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </Select>
  );
}

export function StageDot({ stage, className }: { stage: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: `var(--stage-${stage})` }} aria-hidden />;
}
