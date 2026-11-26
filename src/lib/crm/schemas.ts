// Schemi zod condivisi dalle API del CRM.
import { z } from "zod";
import { STAGE_IDS } from "@/lib/utils";

export const ACTIVITY_TYPE_IDS = ["note", "call", "email", "meeting", "task", "stage"] as const;
export const USER_ACTIVITY_TYPE_IDS = ["note", "call", "email", "meeting", "task"] as const;

/** Stringa opzionale: "" → null. */
const optStr = (max: number) =>
  z.union([z.string(), z.null()]).optional().transform((v) => (v == null ? v : v.trim() || null)).pipe(z.string().max(max).nullable().optional());

const tagsField = z
  .union([z.array(z.string().trim().max(40)).max(30), z.string().max(1000), z.null()])
  .optional()
  .transform((v) => (v == null ? v : Array.isArray(v) ? v : v.split(",")));

/** "5.000" → 5000, "1.234,5" → 1234.5, "12,5" → 12.5, "12.5" → 12.5, "€ 3 000" → 3000. */
export function parseItalianNumber(raw: string) {
  const s = raw.replace(/[€\s]/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s.replace(",", "."));
}

const numOrNull = (min: number, max: number) =>
  z.union([z.number(), z.string(), z.null()]).optional().transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : parseItalianNumber(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: "Valore numerico non valido" });
      return z.NEVER;
    }
    return n;
  });

/** Data: accetta "YYYY-MM-DD" (salvata alle 12:00 UTC) o ISO completo; "" / null → null. */
const dateOrNull = z.union([z.string(), z.null()]).optional().transform((v, ctx) => {
  if (v === undefined) return undefined;
  if (v === null || v.trim() === "") return null;
  const s = v.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00.000Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Data non valida" });
    return z.NEVER;
  }
  return d;
});

const leadFields = {
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(160),
  category: optStr(120),
  address: optStr(240),
  city: optStr(120),
  lat: numOrNull(-90, 90),
  lng: numOrNull(-180, 180),
  phone: optStr(60),
  email: z.union([z.string(), z.null()]).optional().transform((v) => (v == null ? v : v.trim() || null))
    .pipe(z.email("Email non valida").max(200).nullable().optional()),
  website: optStr(300),
  openingHours: optStr(500),
  stage: z.enum(STAGE_IDS).optional(),
  value: numOrNull(0, 100_000_000),
  contactName: optStr(120),
  contactRole: optStr(120),
  notes: optStr(10_000),
  tags: tagsField,
  nextFollowUp: dateOrNull,
  lostReason: optStr(500),
};

export const LeadCreate = z.object(leadFields);
export const LeadPatch = z.object({ ...leadFields, name: leadFields.name.optional() }).strict();
export type LeadPatchInput = z.infer<typeof LeadPatch>;

export const BulkLeads = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });
export const BulkPatch = BulkLeads.extend({ stage: z.enum(STAGE_IDS), lostReason: optStr(500) });

export const SORTS = ["score", "updated", "name", "followup", "value", "created"] as const;
export type LeadSort = (typeof SORTS)[number];

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
export const LeadQuery = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(200).optional()),
  stage: z.preprocess(emptyToUndef, z.enum([...STAGE_IDS, "open"]).optional()),
  minScore: z.preprocess(emptyToUndef, z.coerce.number().int().min(0).max(100).optional()),
  tag: z.preprocess(emptyToUndef, z.string().trim().max(40).optional()),
  sort: z.preprocess(emptyToUndef, z.enum(SORTS).default("updated")),
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(10_000).default(1)),
  pageSize: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(200).default(50)),
});
export type LeadQueryInput = z.infer<typeof LeadQuery>;

export function parseLeadQuery(params: URLSearchParams | Record<string, string | string[] | undefined>) {
  const obj: Record<string, string | undefined> = {};
  if (params instanceof URLSearchParams) params.forEach((v, k) => (obj[k] = v));
  else for (const [k, v] of Object.entries(params)) obj[k] = Array.isArray(v) ? v[0] : v;
  return LeadQuery.safeParse(obj);
}

export const ActivityCreate = z.object({
  type: z.enum(USER_ACTIVITY_TYPE_IDS),
  content: z.string().trim().min(1, "Scrivi un testo").max(5000),
  dueAt: dateOrNull,
  done: z.boolean().optional(),
});

export const ActivityPatch = z
  .object({
    type: z.enum(USER_ACTIVITY_TYPE_IDS).optional(),
    content: z.string().trim().min(1).max(5000).optional(),
    dueAt: dateOrNull,
    done: z.boolean().optional(),
  })
  .strict();

export const PipelineMove = z.object({
  leadId: z.string().min(1),
  stage: z.enum(STAGE_IDS),
  index: z.number().int().min(0).max(100_000),
  lostReason: optStr(500),
});

const FIELD_LABELS: Record<string, string> = {
  name: "Nome", category: "Categoria", address: "Indirizzo", city: "Città", phone: "Telefono", email: "Email", website: "Sito web",
  stage: "Fase", value: "Valore", contactName: "Referente", contactRole: "Ruolo", notes: "Note", tags: "Tag", nextFollowUp: "Follow-up",
  lostReason: "Motivo", type: "Tipo", content: "Testo", dueAt: "Scadenza", ids: "Selezione", leadId: "Cliente", index: "Posizione",
  sort: "Ordinamento", minScore: "Punteggio minimo", page: "Pagina",
};

/** Primo errore zod in forma leggibile: i messaggi già in italiano passano così come sono. */
export function zodError(err: z.ZodError) {
  const issue = err.issues[0];
  if (!issue) return "Dati non validi";
  const field = FIELD_LABELS[String(issue.path[0] ?? "")];
  if (issue.code === "custom" || /[àèéìòù]|obbligatorio|non valid|Scrivi/i.test(issue.message)) return issue.message;
  if (issue.code === "unrecognized_keys") return "Campo non modificabile";
  return field ? `${field}: valore non valido` : "Dati non validi";
}
