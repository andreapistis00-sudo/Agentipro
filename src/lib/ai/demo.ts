// Modalità dimostrativa (nessuna ANTHROPIC_API_KEY): risposte deterministiche e fattuali,
// costruite solo con i dati reali del lead e del profilo (nessuna ricerca web). Funzioni pure, testabili.
import { stageLabel } from "@/lib/utils";
import { inTerritory, norm, type ActivityForAi, type LeadForAi, type SellerProfile } from "./lead-context";
import { researchOf, type Research, type ScoreFactor, type ScoreOutput, type Source } from "./schemas";
import { SCORE_DIMENSIONS, type Confidence, type DimensionId } from "./scoring";

/* ------------------------------ Famiglie di attività ------------------------------ */

type Family = "horeca" | "beauty" | "retail" | "food" | "health" | "auto" | "office" | "fitness" | "hotel" | "build";

const FAMILIES: Record<Family, { label: string; words: string[] }> = {
  horeca: { label: "bar e ristorazione", words: ["bar", "caffe", "caffetteria", "ristorante", "ristorazione", "pizzeria", "trattoria", "osteria", "pub", "bistrot", "enoteca", "gelateria", "pasticceria", "horeca", "locale", "locali", "aperitivo", "cocktail", "paninoteca", "tavola calda", "sushi", "birreria", "cafe"] },
  hotel: { label: "ospitalità", words: ["hotel", "albergo", "b&b", "bed and breakfast", "agriturismo", "ostello", "resort", "affittacamere", "residence", "ospitalita", "strutture ricettive"] },
  beauty: { label: "bellezza e benessere", words: ["parrucchiere", "parrucchieri", "acconciature", "barbiere", "barber", "estetista", "estetica", "centro estetico", "beauty", "spa", "nail", "unghie", "saloni", "salone", "cosmetici", "cosmetica"] },
  food: { label: "alimentari", words: ["alimentari", "panetteria", "panificio", "forno", "macelleria", "salumeria", "gastronomia", "ortofrutta", "fruttivendolo", "pescheria", "supermercato", "minimarket", "drogheria", "latteria", "caseificio"] },
  retail: { label: "negozi al dettaglio", words: ["negozio", "negozi", "abbigliamento", "boutique", "calzature", "scarpe", "ferramenta", "cartoleria", "libreria", "edicola", "tabaccheria", "tabacchi", "fiorista", "fiori", "gioielleria", "ottica", "profumeria", "elettronica", "casalinghi", "giocattoli", "retail", "dettaglio", "commercianti"] },
  health: { label: "salute", words: ["farmacia", "parafarmacia", "dentista", "odontoiatrico", "studio medico", "poliambulatorio", "fisioterapia", "veterinario", "clinica", "sanitaria", "ortopedia"] },
  auto: { label: "auto e officine", words: ["officina", "carrozzeria", "gommista", "autofficina", "concessionaria", "autolavaggio", "meccanico", "elettrauto", "ricambi", "moto", "auto"] },
  office: { label: "studi e uffici", words: ["studio", "commercialista", "avvocato", "notaio", "agenzia", "ufficio", "uffici", "consulenza", "assicurazioni", "immobiliare", "architetto", "ingegnere", "coworking", "professionisti", "aziende", "pmi"] },
  fitness: { label: "sport e fitness", words: ["palestra", "fitness", "crossfit", "piscina", "yoga", "pilates", "centro sportivo", "danza", "sport"] },
  build: { label: "edilizia e impianti", words: ["edile", "edilizia", "impresa", "idraulico", "elettricista", "impianti", "serramenti", "falegnameria", "imbianchino", "costruzioni", "termoidraulica"] },
};

const FAMILY_ORDER: Family[] = ["hotel", "horeca", "beauty", "food", "health", "auto", "fitness", "build", "retail", "office"];

function wordHit(text: string, w: string) {
  return new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}([^a-z0-9]|$)`).test(text);
}

export function familyOf(text: string | null | undefined): Family | null {
  const t = norm(text);
  if (!t) return null;
  for (const f of FAMILY_ORDER) if (FAMILIES[f].words.some((w) => wordHit(t, w))) return f;
  return null;
}

/** Famiglie citate dal profilo del venditore (settore, prodotti, cliente ideale). */
export function sellerFamilies(u: Pick<SellerProfile, "sector" | "products" | "idealCustomer">): Set<Family> {
  const t = norm([u.sector, u.products, u.idealCustomer].filter(Boolean).join(" "));
  const out = new Set<Family>();
  for (const f of FAMILY_ORDER) if (FAMILIES[f].words.some((w) => wordHit(t, w))) out.add(f);
  // Un fornitore Horeca serve di solito anche gli hotel (colazioni) e viceversa.
  if (out.has("horeca")) out.add("hotel");
  return out;
}

/** Corrispondenza diretta tra categoria del lead e parole del profilo (es. "pasticceria" citata). */
function directMention(lead: LeadForAi, u: SellerProfile) {
  const cat = norm(lead.category);
  if (!cat) return false;
  const t = norm([u.idealCustomer, u.sector, u.products].filter(Boolean).join(" "));
  return cat.split(/[^a-z0-9]+/).some((w) => w.length > 3 && t.includes(w.replace(/i$|e$/, "")));
}

/* ---------------------------------- Lead score ---------------------------------- */


/** Il profilo o i criteri dell'agente citano parole della categoria/nome del lead (es. "gelato" ↔ "gelateria"). */
function criteriaHit(lead: LeadForAi, criteria: string | null | undefined): boolean {
  const c = norm(criteria);
  if (!c) return false;
  const target = norm([lead.category, lead.name].filter(Boolean).join(" "));
  return c.split(/[^a-z0-9]+/).filter((w) => w.length > 4).some((w) => target.includes(w.slice(0, 5)));
}

/* ---------------------------------- Lead score ---------------------------------- */

type Dim = { score: number; reason: string; factor?: { label: string; detail: string } };

/**
 * Euristica deterministica dei sotto-punteggi (0-100) per la modalità demo, con gli stessi criteri del prompt reale.
 * Il totale lo calcola il chiamante con i pesi dell'agente.
 */
export function demoScore(
  lead: LeadForAi,
  seller: SellerProfile & { scoringCriteria?: string | null },
  activities: ActivityForAi[] = [],
  now = new Date(),
): ScoreOutput {
  void activities; void now;
  const research = researchOf(lead.briefing ?? null);
  const fam = familyOf(lead.category) ?? familyOf(lead.name);
  const sellerFams = sellerFamilies(seller);
  const hasProfile = Boolean(seller.sector || seller.products || seller.idealCustomer);
  const catLabel = capitalize(lead.category ?? "Attività");
  const rating = lead.rating ?? research?.online.googleRating ?? null;
  const reviews = lead.reviewsCount ?? research?.online.reviewsCount ?? null;
  const website = lead.website ?? research?.online.website ?? null;
  const phone = lead.phone ?? research?.online.phone ?? null;
  const email = lead.email ?? research?.online.email ?? null;
  const contact = lead.contactName ?? research?.people[0]?.name ?? null;

  // fit
  let fit: Dim;
  const direct = hasProfile && directMention(lead, seller);
  if (!hasProfile) fit = { score: 50, reason: "Profilo commerciale incompleto: aderenza non valutabile.", factor: { label: "Profilo da completare", detail: "Senza cosa vendi e cliente ideale l'aderenza resta neutra." } };
  else if (direct || (fam && sellerFams.has(fam))) fit = { score: direct ? 88 : 80, reason: `${catLabel} rientra nel cliente ideale indicato${seller.sector ? ` (${seller.sector})` : ""}.`, factor: { label: "In target", detail: `${catLabel}: corrisponde al tuo cliente ideale.` } };
  else if (fam && sellerFams.size > 0) fit = { score: 22, reason: `${catLabel} non è tra i segmenti del profilo (${[...sellerFams].map((f) => FAMILIES[f].label).slice(0, 2).join(", ")}).`, factor: { label: "Fuori target", detail: `${catLabel} non rientra nei segmenti che servi.` } };
  else fit = { score: 50, reason: `Categoria ${lead.category ? `«${lead.category}»` : "non indicata"}: aderenza non deducibile dai dati.` };
  if (criteriaHit(lead, seller.scoringCriteria)) {
    fit = { score: Math.min(100, fit.score + 8), reason: `${fit.reason} Corrisponde anche ai tuoi criteri di valutazione.`, factor: fit.factor ?? { label: "Nei tuoi criteri", detail: "Corrisponde ai criteri che hai indicato nel profilo." } };
  }

  // size
  const size: Dim =
    reviews == null ? { score: 45, reason: "Nessun indicatore di volume disponibile (recensioni, sedi, coperti)." }
    : reviews >= 500 ? { score: 88, reason: `${reviews} recensioni: volume di clientela molto alto.`, factor: { label: "Alto volume", detail: `${reviews} recensioni indicano un flusso di clienti elevato.` } }
    : reviews >= 200 ? { score: 75, reason: `${reviews} recensioni: volume di clientela alto.`, factor: { label: "Alto volume", detail: `${reviews} recensioni indicano molto passaggio.` } }
    : reviews >= 80 ? { score: 62, reason: `${reviews} recensioni: volume medio.` }
    : reviews >= 20 ? { score: 50, reason: `${reviews} recensioni: volume contenuto.` }
    : { score: 38, reason: `Solo ${reviews} recensioni: attività piccola o poco recensita.` };

  // reputation
  let reputation: Dim;
  if (rating == null) reputation = { score: 45, reason: "Nessuna valutazione pubblica disponibile.", factor: { label: "Nessuna recensione", detail: "Non ci sono valutazioni pubbliche nei dati." } };
  else {
    const r = fmtRating(rating);
    const base = rating >= 4.6 ? 90 : rating >= 4.3 ? 80 : rating >= 4.0 ? 68 : rating >= 3.5 ? 52 : 30;
    const few = (reviews ?? 0) < 15;
    const score = few ? Math.round((base + 60) / 2) : base;
    reputation = {
      score,
      reason: `${r}/5${reviews ? ` su ${reviews} recensioni` : ""}${few ? ", su un numero ridotto di recensioni" : ""}.`,
      factor: base >= 80 ? { label: "Recensioni ottime", detail: `${r}/5${reviews ? ` su ${reviews} recensioni` : ""}.` }
        : base < 52 ? { label: "Reputazione debole", detail: `${r}/5: valutazione sotto la media.` } : undefined,
    };
  }

  // presence
  const pres = (phone ? 25 : 0) + (email ? 20 : 0) + (website ? 30 : 0) + (contact ? 15 : 0) + (lead.openingHours || research?.business.openingHours ? 10 : 0)
    + Math.min(10, (research?.online.socials.length ?? 0) * 5);
  const channels = [phone && "telefono", email && "email", website && "sito"].filter(Boolean) as string[];
  const presence: Dim = {
    score: Math.max(5, Math.min(100, pres)),
    reason: channels.length ? `Disponibili ${channels.join(", ")}${contact ? `, referente ${contact}` : ""}.` : "Nessun recapito né sito disponibili.",
    factor: channels.length === 0 ? { label: "Nessun recapito", detail: "Mancano telefono, email e sito." }
      : channels.length >= 2 ? { label: "Facile da raggiungere", detail: `Disponibili ${channels.join(", ")}.` } : undefined,
  };

  // proximity
  const terr = inTerritory(lead, seller.territory);
  const proximity: Dim =
    terr === true ? { score: 90, reason: `${lead.city ?? "La sede"} è nel tuo territorio (${seller.territory}).`, factor: { label: "Nel tuo territorio", detail: `${lead.city ?? "La sede"} è nella tua zona.` } }
    : terr === false ? { score: 20, reason: `${lead.city ?? "La sede"} è fuori dal territorio dichiarato (${seller.territory}).`, factor: { label: "Fuori zona", detail: `${lead.city ?? "La sede"} è fuori dal territorio dichiarato.` } }
    : seller.territory ? { score: 60, reason: `Non è possibile stabilire se ${lead.city ?? "la sede"} rientra in «${seller.territory}».` }
    : { score: 55, reason: "Territorio non indicato nel profilo." };

  // data
  const filled = [lead.category, lead.address || lead.city, phone, email, website, lead.openingHours, rating, contact, lead.notes].filter((x) => x != null && x !== "").length;
  const dataScore = Math.min(100, Math.round((filled / 9) * 80) + (research ? 20 : 0));
  const data: Dim = {
    score: dataScore,
    reason: `${filled} dati su 9 presenti nella scheda${research ? ", più la Scheda AI" : ""}.`,
    factor: dataScore < 35 ? { label: "Dati scarsi", detail: "La scheda ha poche informazioni sul cliente." } : undefined,
  };

  const dims: Record<DimensionId, Dim> = { fit, size, reputation, presence, proximity, data };
  const confidence: Confidence = dataScore >= 70 ? "alta" : dataScore >= 40 ? "media" : "bassa";

  const factors: (ScoreFactor & { w: number })[] = SCORE_DIMENSIONS.flatMap((d) => {
    const x = dims[d.id];
    return x.factor ? [{ ...x.factor, impact: x.score >= 55 ? "+" as const : "-" as const, w: Math.abs(x.score - 50) }] : [];
  }).sort((a, b) => b.w - a.w).slice(0, 5);
  for (const d of SCORE_DIMENSIONS) {
    if (factors.length >= 3) break;
    if (factors.some((f) => f.detail === dims[d.id].reason)) continue;
    factors.push({ label: d.label, detail: dims[d.id].reason, impact: dims[d.id].score >= 55 ? "+" : "-", w: 0 });
  }

  const pos = factors.filter((f) => f.impact === "+").map((f) => f.label.toLowerCase());
  const neg = factors.filter((f) => f.impact === "-").map((f) => f.label.toLowerCase());
  const summary = pos.length
    ? `${capitalize(pos.slice(0, 2).join(" e "))}${neg.length ? `; ${neg[0]}` : ""}.`
    : `Pochi elementi a favore${neg.length ? `: ${neg.slice(0, 2).join(" e ")}` : ""}.`;

  return {
    dimensions: Object.fromEntries(SCORE_DIMENSIONS.map((d) => [d.id, { score: dims[d.id].score, reason: dims[d.id].reason }])) as ScoreOutput["dimensions"],
    confidence,
    summary,
    factors: factors.map(({ label, impact, detail }) => ({ label, impact, detail })),
  };
}

/* ---------------------------------- Scheda AI ---------------------------------- */

const ALL_WEEK = /(mo-su|lun-dom|lunedi-domenica|24\/7|tutti i giorni|7 giorni su 7)/;

/**
 * Scheda AI dimostrativa: in demo non si fa ricerca web, quindi la scheda riordina solo i dati già presenti
 * nel CRM e dichiara in "unknowns" cosa resta da verificare. Nessun fatto inventato.
 */
export function demoResearch(lead: LeadForAi, activities: ActivityForAi[] = [], now = new Date()): Research {
  void now;
  const fam = familyOf(lead.category) ?? familyOf(lead.name);
  const where = lead.city ? ` a ${lead.city}` : "";
  const reviews = lead.rating != null ? `${fmtRating(lead.rating)}/5${lead.reviewsCount ? ` su ${lead.reviewsCount} recensioni` : ""}` : null;
  const website = lead.website ? (/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`) : null;
  const hours = norm(lead.openingHours);

  const summary = [
    `${lead.name} è ${lead.category ? `un'attività della categoria «${lead.category}»` : "un'attività"}${where}${fam ? ` (settore ${FAMILIES[fam].label})` : ""}.`,
    reviews ? `Su Google ha una valutazione di ${reviews}.` : "Non risultano valutazioni pubbliche nei dati disponibili.",
    "Scheda dimostrativa: riassume i dati già presenti nel CRM, senza ricerca web.",
  ].join(" ");

  const signals: Research["signals"] = [];
  if (lead.rating != null && lead.rating >= 4.5 && (lead.reviewsCount ?? 0) >= 50) signals.push({ label: "Valutazione molto alta", detail: `${reviews}, sopra 4,5 con un numero significativo di recensioni.` });
  else if (lead.rating != null && lead.rating < 3.5) signals.push({ label: "Valutazione bassa", detail: `${reviews}.` });
  if ((lead.reviewsCount ?? 0) >= 300) signals.push({ label: "Molte recensioni", detail: `${lead.reviewsCount} recensioni: indicano un flusso di clienti elevato.` });
  if (hours && ALL_WEEK.test(hours)) signals.push({ label: "Aperto 7 giorni su 7", detail: `Orari: ${lead.openingHours}.` });
  if (!lead.website) signals.push({ label: "Nessun sito nei dati", detail: "Nella scheda non risulta un sito web." });
  if (lead.contactName) signals.push({ label: "Referente noto", detail: `${lead.contactName}${lead.contactRole ? `, ${lead.contactRole}` : ""} (dal CRM).` });
  const lastContact = activities.find((a) => a.type === "call" || a.type === "email" || a.type === "meeting");
  if (lastContact) signals.push({ label: "Ultimo contatto registrato", detail: `${fmtDay(lastContact.createdAt)}: ${firstSentence(lastContact.content, 100)}.` });

  const unknowns = [
    "Titolari e referenti citati pubblicamente",
    "Contenuto delle recensioni (aspetti apprezzati e critiche)",
    "Notizie recenti, aperture o cambi di gestione",
    ...(lead.openingHours ? [] : ["Orari di apertura"]),
    ...(lead.phone ? [] : ["Telefono"]),
    ...(lead.email ? [] : ["Email"]),
  ];

  const facts: Research["facts"] = [];
  if (lead.source === "osm") facts.push({ text: "Attività censita su OpenStreetMap.", sourceUrl: null });
  if (lead.source === "google") facts.push({ text: "Attività presente su Google Maps.", sourceUrl: null });

  const sources: Source[] = [];
  if (website) sources.push({ title: `Sito ufficiale di ${lead.name}`, url: website });
  const q = encodeURIComponent([lead.name, lead.address, lead.city].filter(Boolean).join(", "));
  sources.push({ title: `${lead.name} su Google Maps`, url: `https://www.google.com/maps/search/?api=1&query=${q}` });

  return {
    v: 2,
    summary,
    business: {
      type: lead.category, offering: null, openingHours: lead.openingHours, priceLevel: null, foundedOrSince: null, size: null,
      locations: [[lead.address, lead.city].filter(Boolean).join(", ")].filter(Boolean),
    },
    people: lead.contactName ? [{ name: lead.contactName, role: lead.contactRole, source: "Dati inseriti nel CRM" }] : [],
    online: {
      website, phone: lead.phone, email: lead.email, socials: [],
      googleRating: lead.rating, reviewsCount: lead.reviewsCount, otherListings: [],
    },
    reputation: {
      overall: reviews ? `Valutazione media ${reviews}. In modalità dimostrativa il testo delle recensioni non viene letto.` : null,
      positives: [], negatives: [],
    },
    facts,
    signals: signals.slice(0, 6),
    unknowns,
    confidence: lead.rating != null && (lead.phone || lead.website) ? "media" : "bassa",
    sources,
    demo: true,
  };
}

/* ---------------------------------- Chat ---------------------------------- */

export type DemoIntent =
  | { kind: "followups" }
  | { kind: "stale"; days: number; stage: string | null }
  | { kind: "compare" }
  | { kind: "lead_info"; target: string | null }
  | { kind: "web"; target: string | null }
  | { kind: "summary" }
  | { kind: "email"; target: string | null }
  | { kind: "note"; content: string; due: string | null }
  | { kind: "stage"; stage: string }
  | { kind: "generic" };

const STAGE_WORDS: [RegExp, string][] = [
  [/\b(ha firmato|vint|chiuso il contratto|acquisit)/, "won"],
  [/\b(pers[oi]|non (è|e) interessat|rifiutato)\b/, "lost"],
  [/\b(trattativa|trattative|negoziazione)\b/, "negotiation"],
  [/\b(qualificat)/, "qualified"],
  [/\b(contattat)/, "contacted"],
  [/\b(nuov[oi])\b/, "new"],
];

const NUM_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6 };

function staleDays(m: string): number {
  const x = m.match(/\bda\s+(\d+|un|una|uno|due|tre|quattro|cinque|sei)\s+(giorn|settiman|mes)/);
  if (!x) return 14;
  const n = Number(x[1]) || NUM_WORDS[x[1]] || 1;
  return x[2] === "giorn" ? n : x[2] === "settiman" ? n * 7 : n * 30;
}

function targetName(message: string): string | null {
  const t = message.match(/\b(?:sai di|su|di|per)\s+(?:il |la |lo |l'|i |le )?([A-ZÀ-Ý0-9«"][^?!.\n]{2,60})/)?.[1]?.trim();
  return t ? t.replace(/[«»"]/g, "").trim() : null;
}

/** Riconosce l'intento del messaggio (modalità demo). */
export function detectIntent(message: string, hasLead: boolean, now = new Date()): DemoIntent {
  const m = norm(message);
  if (hasLead && /\b(segna|annota|ricordami|promemoria|nota|registra)\b/.test(m)) {
    return { kind: "note", content: message.trim(), due: dueFromText(m, now) };
  }
  if (hasLead && /\b(sposta|metti|passa|aggiorna)\b.*\b(fase|in |a )/.test(m)) {
    for (const [re, stage] of STAGE_WORDS) if (re.test(m)) return { kind: "stage", stage };
  }
  if (/\b(scrivi|scrivimi|bozza|prepara(mi)?|redigi)\b.*\b(email|e-mail|mail|messaggio|whatsapp)\b/.test(m)) {
    return { kind: "email", target: message.match(/\bper\s+(?:il|la|lo|l'|i|le)?\s*([^,.?!\n]{3,60})/i)?.[1]?.trim() ?? null };
  }
  if (/non (li |la |lo |le )?(sento|sentiamo|sentito|contatto|contattato|chiamo|chiamato|vedo)|da (\d+|un|una|due|tre|quattro|cinque|sei) (giorni|settiman|mes)|da tempo/.test(m)) {
    const st = m.match(/\b(?:in|fase)\s+(trattativ|qualificat|contattat|nuov|vint|pers)/)?.[1];
    const stage = st ? ({ trattativ: "negotiation", qualificat: "qualified", contattat: "contacted", nuov: "new", vint: "won", pers: "lost" } as Record<string, string>)[st] : null;
    return { kind: "stale", days: staleDays(m), stage };
  }
  if (/richiamar|follow.?up|scadenz|cosa ho oggi|in scadenza/.test(m)) return { kind: "followups" };
  if (/confront|paragon|punteggio piu alto|punteggi piu alti|migliori|piu caldi|classifica|chi (dovrei|devo|posso)|priorit/.test(m)) return { kind: "compare" };
  if (/cerca (online|sul web|su internet|in rete)|informazioni online|sul web|su internet|trova informazioni/.test(m)) return { kind: "web", target: hasLead ? null : targetName(message) };
  if (hasLead && /riassum|riepilog|riassunto|sintesi delle note/.test(m)) return { kind: "summary" };
  if (/cosa sai|chi e |dimmi (tutto|qualcosa)|informazioni su|parlami di/.test(m) || hasLead) return { kind: "lead_info", target: hasLead ? null : targetName(message) };
  return { kind: "generic" };
}

function dueFromText(m: string, now: Date): string | null {
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (n: number) => key(new Date(now.getTime() + n * 86400000));
  if (/\bdopodomani\b/.test(m)) return plus(2);
  if (/\bdomani\b/.test(m)) return plus(1);
  if (/\boggi\b/.test(m)) return plus(0);
  if (/settimana prossima|prossima settimana/.test(m)) return plus(7);
  const days = ["domenica", "lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"];
  const idx = days.findIndex((d) => m.includes(d));
  if (idx >= 0) {
    const diff = ((idx - now.getUTCDay() + 7) % 7) || 7;
    return plus(diff);
  }
  const iso = m.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;
  const dm = m.match(/\b(\d{1,2})[/.](\d{1,2})\b/);
  if (dm) return `${now.getUTCFullYear()}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  return /ricordami|promemoria/.test(m) ? plus(3) : null;
}

export type DemoLeadRow = {
  id: string; name: string; category: string | null; city: string | null; stage: string; stageLabel?: string; score: number | null;
  scoreDimensions?: Record<string, number> | null; nextFollowUp?: string | null; lastContactAt?: string | null; hasPhone?: boolean;
};
export type DemoFollowups = { followups: { leadId: string; name: string; date: string | null; overdue: boolean; stage: string; hasPhone?: boolean }[]; openTasks: { leadId: string; leadName: string; content: string; dueAt: string | null; overdue: boolean }[] };
export type DemoLeadDetails = {
  id: string; name: string; category: string | null; city: string | null; address: string | null; phone: string | null; email: string | null;
  website: string | null; rating: number | null; reviewsCount: number | null; stage: string; score: number | null; value: number | null;
  contactName: string | null; contactRole: string | null; notes: string | null; nextFollowUp: string | null;
  scoreReason: { summary?: string } | null;
  research: (Research & { updatedAt: string | null }) | null;
  activities: { type: string; content: string; createdAt: string; dueAt: string | null; done: boolean }[];
};

const ACT: Record<string, string> = { note: "Nota", call: "Chiamata", email: "Email", meeting: "Visita", task: "Promemoria", stage: "Fase" };

export function demoAnswerCompare(leads: DemoLeadRow[]) {
  if (!leads.length) return "Nel tuo CRM non ci sono ancora clienti. Puoi aggiungerne da **Trova clienti**.";
  const scored = leads.filter((l) => l.score != null);
  const lines = [scored.length ? `Ecco i tuoi ${leads.length === 1 ? "cliente" : `${leads.length} clienti`} con il punteggio più alto:` : "Nessuno di questi clienti ha ancora un punteggio. Ecco i più recenti:", ""];
  lines.push("| Cliente | Punteggio | Fase | Dimensioni |", "|---|---|---|---|");
  for (const l of leads) {
    const dims = l.scoreDimensions ? Object.entries(l.scoreDimensions).map(([k, v]) => `${k} ${v}`).join(", ") : "—";
    lines.push(`| **${l.name}**${l.city ? ` (${l.city})` : ""} | ${l.score ?? "—"} | ${l.stageLabel ?? stageLabel(l.stage)} | ${dims} |`);
  }
  const unscored = leads.length - scored.length;
  if (unscored) lines.push("", `${unscored === 1 ? "Un cliente non ha" : `${unscored} clienti non hanno`} ancora un punteggio: si calcola con **Valuta** dalla scheda o dalla lista.`);
  return lines.join("\n");
}

export function demoAnswerStale(leads: DemoLeadRow[], days: number, stage: string | null) {
  const what = stage ? `in fase «${stageLabel(stage)}»` : "";
  const span = days % 7 === 0 ? `${days / 7} ${days === 7 ? "settimana" : "settimane"}` : `${days} giorni`;
  if (!leads.length) return `Nessun cliente ${what} senza contatti da più di ${span}.`.replace("  ", " ");
  const lines = [`Clienti ${what} senza chiamate, email o visite registrate da più di ${span}:`.replace("  ", " "), ""];
  for (const l of leads) {
    lines.push(`- **${l.name}**${l.city ? ` · ${l.city}` : ""} — ${l.lastContactAt ? `ultimo contatto ${fmtDay(l.lastContactAt)}` : "nessun contatto registrato"}${l.score != null ? ` · punteggio ${l.score}` : ""}${!stage ? ` · ${l.stageLabel ?? stageLabel(l.stage)}` : ""}`);
  }
  return lines.join("\n");
}

export function demoAnswerFollowups(due: DemoFollowups) {
  if (!due.followups.length && !due.openTasks.length) return "Nessun follow-up o promemoria in scadenza nei prossimi 7 giorni.";
  const lines = ["**In scadenza (prossimi 7 giorni):**"];
  for (const f of due.followups) lines.push(`- ${f.overdue ? "**Scaduto** · " : ""}**${f.name}** — ${f.date ? fmtDay(f.date) : "senza data"} · ${f.stage}`);
  for (const t of due.openTasks) lines.push(`- ${t.overdue ? "**Scaduto** · " : ""}${t.leadName}: ${firstSentence(t.content, 90)}${t.dueAt ? ` (${fmtDay(t.dueAt)})` : ""}`);
  return lines.join("\n");
}

/** Cosa sa l'app di un cliente: dati del CRM, punteggio e Scheda AI. */
export function demoAnswerLeadInfo(d: DemoLeadDetails) {
  const L = [`Ecco cosa c'è su **${d.name}**${d.category ? ` (${d.category}${d.city ? `, ${d.city}` : ""})` : d.city ? ` (${d.city})` : ""}:`, ""];
  L.push("**Dal CRM**");
  const contacts = [d.phone && `tel. ${d.phone}`, d.email, d.website].filter(Boolean).join(" · ");
  L.push(`- Fase: ${stageLabel(d.stage)}${d.value != null ? ` · valore stimato ${Math.round(d.value).toLocaleString("it-IT")} €` : ""}`);
  if (d.address) L.push(`- Indirizzo: ${d.address}${d.city ? `, ${d.city}` : ""}`);
  L.push(`- Recapiti: ${contacts || "nessuno salvato"}`);
  if (d.contactName) L.push(`- Referente: ${d.contactName}${d.contactRole ? ` (${d.contactRole})` : ""}`);
  if (d.rating != null) L.push(`- Valutazione: ${fmtRating(d.rating)}/5${d.reviewsCount ? ` su ${d.reviewsCount} recensioni` : ""}`);
  if (d.score != null) L.push(`- Punteggio AI: ${d.score}/100${d.scoreReason?.summary ? ` — ${d.scoreReason.summary}` : ""}`);
  if (d.notes) L.push(`- Note: ${firstSentence(d.notes, 160)}`);
  if (d.nextFollowUp) L.push(`- Prossimo follow-up: ${fmtDay(d.nextFollowUp)}`);
  const acts = d.activities.filter((a) => a.type !== "stage").slice(0, 3);
  if (acts.length) {
    L.push("", "**Ultime attività**");
    for (const a of acts) L.push(`- ${fmtDay(a.createdAt)} · ${ACT[a.type] ?? a.type}: ${firstSentence(a.content, 110)}`);
  }
  if (d.research) {
    L.push("", `**Scheda AI**${d.research.updatedAt ? ` (aggiornata ${fmtDay(d.research.updatedAt)})` : ""}`, d.research.summary);
    for (const s of d.research.signals.slice(0, 3)) L.push(`- ${s.label}: ${s.detail}`);
  } else {
    L.push("", "Non c'è ancora una **Scheda AI** con le informazioni pubbliche: si compila dalla scheda del cliente con **Cerca informazioni**.");
  }
  return L.join("\n");
}

export function demoAnswerWeb(d: DemoLeadDetails | null, target: string | null) {
  const intro = "In modalità dimostrativa non eseguo ricerche sul web: con la chiave API attiva cerco sito, schede, recensioni, persone e notizie e cito le fonti.";
  if (!d) return `${intro}\n\n${target ? `Non ho trovato «${target}» nel tuo CRM.` : "Dimmi il nome dell'attività che ti interessa."}`;
  return `${intro}\n\nNel frattempo, ecco i dati che ho già su **${d.name}**:\n\n${demoAnswerLeadInfo(d).split("\n").slice(2).join("\n")}`;
}

export function demoAnswerSummary(d: DemoLeadDetails) {
  const acts = d.activities.filter((a) => a.type !== "stage");
  if (!acts.length && !d.notes) return `Su **${d.name}** non ci sono ancora note o attività registrate.`;
  const L = [`Riepilogo di note e attività su **${d.name}**:`, ""];
  if (d.notes) L.push(`- **Note:** ${firstSentence(d.notes, 200)}`);
  for (const a of acts.slice(0, 8)) L.push(`- ${fmtDay(a.createdAt)} · ${ACT[a.type] ?? a.type}: ${firstSentence(a.content, 120)}${a.type === "task" ? (a.done ? " (fatto)" : " (da fare)") : ""}`);
  const open = acts.filter((a) => a.type === "task" && !a.done).length;
  L.push("", `${acts.length} ${acts.length === 1 ? "attività" : "attività"} in totale${open ? `, ${open} ${open === 1 ? "promemoria aperto" : "promemoria aperti"}` : ""}.`);
  return L.join("\n");
}

/** Bozza di messaggio, solo su richiesta esplicita: testo neutro, senza tattiche. */
export function demoAnswerEmail(seller: SellerProfile, lead: { name: string; city: string | null; contactName: string | null } | null, target: string | null) {
  const name = lead?.name ?? target ?? "[Nome attività]";
  return [
    `Ecco una bozza per **${name}**:`,
    "",
    `**Oggetto:** ${seller.company ?? seller.name} — ${name}`,
    "",
    lead?.contactName ? `Gentile ${lead.contactName},` : "Buongiorno,",
    "",
    `sono ${seller.name}${seller.company ? ` di ${seller.company}` : ""}${seller.territory ? ` e lavoro in ${seller.territory}` : ""}. [Motivo del messaggio]`,
    "",
    "Resto a disposizione per qualsiasi informazione.",
    "",
    `${seller.name}${seller.company ? `  \n${seller.company}` : ""}  \n[Telefono]`,
  ].join("\n");
}

export function demoAnswerGeneric(message: string, seller: SellerProfile) {
  return [
    `In modalità dimostrativa le mie risposte sono di esempio, ma usano i dati reali del tuo CRM${seller.sector ? ` e del tuo profilo (${seller.sector})` : ""}.`,
    "",
    "Prova a chiedermi:",
    "- **Cosa sai di** [nome cliente]?",
    "- **Quali clienti in Trattativa non sento da 2 settimane?**",
    "- **Confronta i miei 5 clienti con punteggio più alto**",
    "- **Trova informazioni online su** [nome attività]",
    "",
    `Con la chiave API attiva rispondo anche a richieste libere come: «${firstSentence(message, 80)}».`,
  ].join("\n");
}

/** Spezza un testo in chunk di poche parole per simulare lo streaming. */
export function chunkText(text: string, wordsPerChunk = 3): string[] {
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  let buf = "";
  let words = 0;
  for (const p of parts) {
    buf += p;
    if (p.trim()) words++;
    if (words >= wordsPerChunk && /\s/.test(p) === false) {
      out.push(buf);
      buf = "";
      words = 0;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function demoTitle(message: string) {
  const t = message.replace(/\s+/g, " ").trim().replace(/[?!.]+$/, "");
  return t.length > 48 ? `${t.slice(0, 47).trimEnd()}…` : t || "Nuova conversazione";
}

/* ---------------------------------- util ---------------------------------- */

function firstSentence(s: string | null | undefined, max = 140) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  const cut = t.split(/(?<=[.!?;])\s/)[0] ?? t;
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut.replace(/[.;]$/, "");
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtRating(r: number) {
  return r.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}
function fmtDay(d: Date | string) {
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`) : new Date(d);
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short" }).format(date);
}
