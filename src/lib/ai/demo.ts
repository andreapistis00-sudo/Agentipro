// Modalità dimostrativa (nessuna ANTHROPIC_API_KEY): risposte deterministiche, plausibili e
// personalizzate con i dati reali del lead e del profilo. Funzioni pure, testabili.
import { stageLabel } from "@/lib/utils";
import { inTerritory, norm, type ActivityForAi, type LeadForAi, type SellerProfile } from "./lead-context";
import type { Briefing, ScoreFactor, ScoreOutput, Source } from "./schemas";

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

type WeightedFactor = ScoreFactor & { weight: number };

/**
 * Euristica deterministica del punteggio (0-100) per la modalità demo.
 * Stessi criteri del prompt reale: fit col profilo, raggiungibilità, segnali di salute, territorio, fase, attività.
 */
export function demoScore(lead: LeadForAi, seller: SellerProfile, activities: ActivityForAi[] = [], now = new Date()): ScoreOutput {
  const factors: WeightedFactor[] = [];
  const add = (weight: number, label: string, detail: string) =>
    factors.push({ weight, label, detail, impact: weight >= 0 ? "+" : "-" });

  let score = 42;
  const fam = familyOf(lead.category) ?? familyOf(lead.name);
  const sellerFams = sellerFamilies(seller);
  const hasProfile = Boolean(seller.sector || seller.products || seller.idealCustomer);
  const catLabel = lead.category ?? "attività";

  // 1. Coerenza con il profilo
  if (hasProfile && (directMention(lead, seller) || (fam && sellerFams.has(fam)))) {
    const w = directMention(lead, seller) ? 26 : 22;
    add(w, "In target", `${capitalize(catLabel)}: rientra nel tuo cliente ideale${seller.sector ? ` (${seller.sector})` : ""}.`);
  } else if (hasProfile && fam && sellerFams.size > 0) {
    add(-18, "Fuori target", `${capitalize(catLabel)} non è tra i segmenti che servi di solito (${[...sellerFams].map((f) => FAMILIES[f].label).slice(0, 2).join(", ")}).`);
  } else if (!hasProfile) {
    add(-2, "Profilo da completare", "Completa il profilo commerciale per valutare quanto il cliente è in target.");
  } else {
    add(4, "Target da verificare", `Categoria ${lead.category ? `«${lead.category}»` : "non indicata"}: verifica il bisogno durante il primo contatto.`);
  }

  // 2. Raggiungibilità
  const channels = [lead.phone && "telefono", lead.email && "email", lead.website && "sito"].filter(Boolean) as string[];
  if (channels.length === 0) add(-12, "Nessun recapito", "Mancano telefono, email e sito: serve una visita a freddo.");
  else if (channels.length >= 2) add(4 + channels.length * 2, "Facile da contattare", `Disponibili ${channels.join(", ")}.`);
  else add(3, "Un solo recapito", `Hai solo ${channels[0]}: prova a raccogliere anche un'email.`);
  if (lead.contactName) add(5, "Referente noto", `Conosci il referente: ${lead.contactName}${lead.contactRole ? `, ${lead.contactRole}` : ""}.`);

  // 3. Segnali di salute
  if (lead.rating != null) {
    const n = lead.reviewsCount ?? 0;
    if (lead.rating >= 4.5 && n >= 50) add(12, "Recensioni ottime", `${fmtRating(lead.rating)}/5 su ${n} recensioni: attività solida e con passaggio.`);
    else if (lead.rating >= 4.0) add(n >= 100 ? 9 : 6, "Buona reputazione", `${fmtRating(lead.rating)}/5${n ? ` su ${n} recensioni` : ""}.`);
    else if (lead.rating < 3.5) add(-7, "Reputazione debole", `${fmtRating(lead.rating)}/5: possibile attività in difficoltà, valuta la solvibilità.`);
    else add(1, "Reputazione nella media", `${fmtRating(lead.rating)}/5${n ? ` su ${n} recensioni` : ""}.`);
    if (n >= 300) add(4, "Alto volume", `${n} recensioni indicano un flusso di clienti elevato.`);
  }

  // 4. Territorio
  const terr = inTerritory(lead, seller.territory);
  if (terr === true) add(6, "Nel tuo territorio", `${lead.city ?? "La sede"} è nella tua zona (${seller.territory}).`);
  else if (terr === false) add(-12, "Fuori zona", `${lead.city ?? "La sede"} è fuori dal territorio dichiarato (${seller.territory}).`);

  // 5. Fase CRM
  const stageW: Record<string, [number, string, string] | undefined> = {
    contacted: [5, "Già contattato", "C'è già stato un primo contatto: il ghiaccio è rotto."],
    qualified: [12, "Qualificato", "Interesse confermato: è il momento di proporre un'offerta."],
    negotiation: [17, "In trattativa", "Trattativa aperta: priorità alta per chiudere."],
    won: [-12, "Già cliente", "È già tuo cliente: valuta solo upsell o riordino."],
    lost: [-22, "Perso", `Trattativa persa${lead.lostReason ? ` (${lead.lostReason})` : ""}: ricontatta solo se il motivo è superabile.`],
  };
  const st = stageW[lead.stage];
  if (st) add(st[0], st[1], st[2]);
  if (lead.value != null && lead.value >= 3000) add(5, "Valore interessante", `Potenziale stimato di ${Math.round(lead.value).toLocaleString("it-IT")} €.`);

  // 6. Attività recenti / follow-up
  const recent = activities.find((a) => now.getTime() - new Date(a.createdAt).getTime() < 14 * 86400000);
  if (recent) add(5, "Contatto recente", "Ci sono attività nelle ultime due settimane: la relazione è calda.");
  const overdue = lead.nextFollowUp && new Date(lead.nextFollowUp).getTime() < now.getTime();
  if (overdue && lead.stage !== "won" && lead.stage !== "lost") add(6, "Follow-up scaduto", "Il follow-up previsto è già passato: richiamalo al più presto.");

  for (const f of factors) score += f.weight;
  score = Math.max(3, Math.min(97, Math.round(score)));

  const sorted = [...factors].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 5);
  while (sorted.length < 3) {
    sorted.push(
      lead.rating == null
        ? { weight: 0, label: "Nessuna recensione", detail: "Non ci sono valutazioni pubbliche: verifica la reputazione di persona.", impact: "-" }
        : { weight: 0, label: "Dati essenziali", detail: "Scheda con poche informazioni: arricchiscila dopo il primo contatto.", impact: "-" },
    );
  }

  const pos = sorted.filter((f) => f.impact === "+").map((f) => f.label.toLowerCase());
  const neg = sorted.filter((f) => f.impact === "-").map((f) => f.label.toLowerCase());
  const summary = pos.length
    ? `${capitalize(pos.slice(0, 2).join(" e "))}${neg.length ? `, ma ${neg[0]}` : ""}.`
    : `Pochi segnali positivi${neg.length ? `: ${neg.slice(0, 2).join(" e ")}` : ""}.`;

  return { score, summary, factors: sorted.map(({ label, impact, detail }) => ({ label, impact, detail })) };
}

/* ---------------------------------- Briefing ---------------------------------- */

const FAMILY_PLAYBOOK: Record<Family | "generic", { moment: string; pains: string[]; objections: { objection: string; response: string }[]; questions: string[] }> = {
  horeca: {
    moment: "Evita l'ora di punta: meglio a metà mattina (10-11:30) o primo pomeriggio, quando il banco è tranquillo.",
    pains: ["continuità del servizio nei momenti di punta", "margini schiacciati dai rincari delle materie prime", "personale da formare in fretta"],
    objections: [
      { objection: "Ho già un fornitore e mi trovo bene.", response: "Ci mancherebbe, non le chiedo di cambiare domani. Le propongo di provarci in parallelo per due settimane su un solo prodotto: se non nota la differenza, nessun impegno." },
      { objection: "Adesso non ho tempo, siamo pieni.", response: "La capisco, lavoro con tanti locali e so cos'è il banco a quest'ora. Mi dice lei quando passo? Bastano dieci minuti, porto un campione da assaggiare." },
    ],
    questions: ["Quali sono i prodotti che vi danno più margine oggi?", "Cosa succede quando un fornitore vi lascia senza merce nel weekend?", "Chi decide gli acquisti, lei o il titolare?"],
  },
  hotel: {
    moment: "Chiedi della direzione o del responsabile acquisti; evita l'orario di check-out (10-12).",
    pains: ["qualità percepita della colazione nelle recensioni", "gestione dei picchi stagionali", "costi per camera occupata"],
    objections: [
      { objection: "Gli acquisti li decide la proprietà/il gruppo.", response: "Perfetto, allora le preparo una proposta scritta da girare alla proprietà con i numeri per camera: così ha già tutto in mano." },
      { objection: "Siamo a fine stagione, ne riparliamo.", response: "È proprio il momento giusto per organizzarsi: decidiamo ora con calma e partite già pronti alla prossima stagione, senza corse." },
    ],
    questions: ["Cosa scrivono gli ospiti della colazione nelle recensioni?", "Quanto cambia l'occupazione tra alta e bassa stagione?", "Con quanti fornitori lavorate oggi?"],
  },
  beauty: {
    moment: "I saloni sono più liberi a inizio settimana (lunedì è spesso chiuso: martedì mattina è ideale).",
    pains: ["fidelizzazione delle clienti", "rivendita di prodotti in negozio", "gestione degli appuntamenti"],
    objections: [
      { objection: "Uso già un marchio che le clienti conoscono.", response: "Infatti non le propongo di sostituirlo: le lascio una linea da affiancare, con materiale per la rivendita, e vediamo cosa chiedono le clienti." },
      { objection: "Il magazzino è già pieno.", response: "Per questo partiamo con un kit minimo e riassortimento rapido: niente scorte, ordina solo quello che vende." },
    ],
    questions: ["Quanto incide oggi la rivendita sul fatturato?", "Quali servizi vi chiedono di più le clienti?", "Come le richiamate per il prossimo appuntamento?"],
  },
  food: {
    moment: "Passa a metà mattina, dopo l'apertura e prima della ressa di mezzogiorno.",
    pains: ["concorrenza della grande distribuzione", "rotazione e scarti dei freschi", "distinguersi con prodotti locali"],
    objections: [
      { objection: "Al supermercato costa meno.", response: "Sul prezzo a scaffale sì, ma i suoi clienti vengono qui per la qualità e il servizio: le propongo prodotti che il supermercato non ha e che si vendono con margine." },
      { objection: "Non ho spazio a scaffale.", response: "Partiamo da un solo espositore vicino alla cassa: se non ruota in tre settimane lo ritiro io." },
    ],
    questions: ["Quali prodotti le chiedono e non trova?", "Quanto scarto ha a settimana sui freschi?", "Ogni quanto riordina?"],
  },
  retail: {
    moment: "Evita il sabato e l'apertura del lunedì: meglio martedì-giovedì a metà mattina.",
    pains: ["ingressi in calo e concorrenza online", "capitale bloccato in magazzino", "rinnovare l'offerta senza rischi"],
    objections: [
      { objection: "Con l'online è dura, non investo.", response: "Proprio per questo le propongo articoli che online non si comprano d'impulso e condizioni con reso dell'invenduto: il rischio lo condividiamo." },
      { objection: "Mi mandi un catalogo via email.", response: "Glielo mando volentieri, ma le porto anche due campioni: toccare il prodotto è un'altra cosa. Le va bene giovedì?" },
    ],
    questions: ["Quali categorie vi danno più soddisfazione quest'anno?", "Chi sono i vostri clienti più fedeli?", "Come decidete cosa riordinare?"],
  },
  health: {
    moment: "Chiedi un appuntamento: i professionisti sanitari raramente ricevono senza preavviso.",
    pains: ["tempo sottratto ai pazienti", "conformità e normative", "affidabilità delle forniture"],
    objections: [
      { objection: "Abbiamo contratti già in essere.", response: "Capisco. Mi dice quando scadono? Le preparo un confronto puntuale da valutare con calma prima del rinnovo." },
      { objection: "Non ho tempo per i rappresentanti.", response: "Le chiedo solo cinque minuti a fine giornata, oppure le lascio una scheda di una pagina con i numeri: decide lei." },
    ],
    questions: ["Cosa vi fa perdere più tempo nella gestione quotidiana?", "Chi si occupa degli ordini?", "Quando scadono i contratti attuali?"],
  },
  auto: {
    moment: "Le officine sono più libere a fine mattinata o dopo le 17; evita il lunedì mattina.",
    pains: ["tempi di consegna dei ricambi", "margini sulla manodopera", "clienti che chiedono preventivi veloci"],
    objections: [
      { objection: "Prendo tutto dal solito ricambista.", response: "Normale. Mi metta alla prova su un solo codice urgente: se arrivo prima e al prezzo giusto, ne riparliamo." },
      { objection: "Il prezzo è più alto.", response: "Guardiamo il costo totale: tempi di fermo auto e resi pesano più di qualche euro di listino. Facciamo due conti insieme?" },
    ],
    questions: ["Quante auto vi restano ferme in attesa di pezzi?", "Che cosa vi chiedono di più i clienti?", "Come gestite i preventivi?"],
  },
  office: {
    moment: "Chiama prima per fissare un appuntamento; il venerdì pomeriggio è da evitare.",
    pains: ["tempo dei professionisti", "costi fissi dell'ufficio", "affidabilità e assistenza"],
    objections: [
      { objection: "Ci pensiamo e le faremo sapere.", response: "Certo. Per aiutarla a decidere, cosa le servirebbe vedere? Fissiamo già una breve chiamata martedì per eventuali dubbi." },
      { objection: "Non è una priorità adesso.", response: "Capisco. Le lascio un confronto dei costi annui: se il risparmio è quello che stimo, diventa una priorità da solo." },
    ],
    questions: ["Chi prende le decisioni su questi acquisti?", "Cosa vi ha fatto cambiare fornitore in passato?", "Che budget avete previsto per quest'anno?"],
  },
  fitness: {
    moment: "Meglio a metà mattina o primo pomeriggio, fuori dalle fasce piene (7-9 e 18-21).",
    pains: ["fidelizzazione degli iscritti", "ricavi extra oltre l'abbonamento", "picchi di settembre e gennaio"],
    objections: [
      { objection: "Gli iscritti non comprano extra.", response: "Dipende da come viene proposto: con il nostro espositore e una promo d'ingresso i centri simili vendono già dalla prima settimana. Proviamo un mese?" },
      { objection: "Non ho personale per gestirlo.", response: "È pensato per gestirsi da solo: riassortimento e materiali li curo io." },
    ],
    questions: ["Quanti iscritti attivi avete?", "Quali servizi extra funzionano meglio?", "Quando avete il picco di nuove iscrizioni?"],
  },
  build: {
    moment: "Telefona prima: titolari e capicantiere sono spesso fuori. Primo mattino o fine giornata.",
    pains: ["consegne puntuali in cantiere", "liquidità e tempi di pagamento", "materiali certificati"],
    objections: [
      { objection: "Il magazzino edile sotto casa mi serve in giornata.", response: "Ha ragione, la velocità conta. Le propongo consegna programmata in cantiere sui materiali ricorrenti: meno viaggi e prezzi bloccati." },
      { objection: "Pago a 90 giorni con il fornitore attuale.", response: "Parliamone: posso proporle condizioni di pagamento in linea, se partiamo con un volume minimo concordato." },
    ],
    questions: ["Quanti cantieri avete aperti in questo periodo?", "Cosa vi manca più spesso in cantiere?", "Chi segue gli acquisti?"],
  },
  generic: {
    moment: "Scegli un orario tranquillo a metà mattina e presentati con un motivo concreto per passare.",
    pains: ["tempo del titolare", "costi e margini", "affidabilità dei fornitori"],
    objections: [
      { objection: "Non mi serve niente, grazie.", response: "Ci sta, non sono qui per vendere oggi. Mi bastano due domande per capire se ha senso rivederci: le va?" },
      { objection: "Costa troppo.", response: "Rispetto a cosa? Se mi dice quanto spende oggi, le faccio vedere nel concreto dove si recupera la differenza." },
    ],
    questions: ["Qual è oggi la sua priorità per l'attività?", "Cosa la convincerebbe a provare un nuovo fornitore?", "Chi altro partecipa alla decisione?"],
  },
};

function firstSentence(s: string | null | undefined, max = 140) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  const cut = t.split(/(?<=[.!?;])\s/)[0] ?? t;
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut.replace(/[.;]$/, "");
}

function productItems(products: string | null | undefined) {
  if (!products) return [];
  return products.split(/[,;.\n]| e /).map((p) => p.trim()).filter((p) => p.length > 3).slice(0, 4);
}

export function demoBriefing(lead: LeadForAi, activities: ActivityForAi[], seller: SellerProfile, now = new Date()): Briefing {
  const fam = familyOf(lead.category) ?? familyOf(lead.name);
  const pb = FAMILY_PLAYBOOK[fam ?? "generic"];
  const cat = lead.category ? lead.category.toLowerCase() : "attività";
  const where = lead.city ? ` a ${lead.city}` : "";
  const items = productItems(seller.products);
  const offerCore = items[0] ?? (seller.sector ? `la linea ${seller.sector.toLowerCase()}` : "la tua offerta");
  const lastContact = activities.find((a) => a.type !== "stage");
  const openTask = activities.find((a) => a.type === "task" && !a.done);
  const first = seller.name.split(" ")[0];
  const reviews = lead.rating != null ? `${fmtRating(lead.rating)}/5${lead.reviewsCount ? ` su ${lead.reviewsCount} recensioni` : ""}` : null;
  const channels = [lead.phone && "telefono", lead.email && "email", lead.website && "sito web"].filter(Boolean);

  const snapshot = [
    `${lead.name} è ${fam ? `un'attività del settore ${FAMILIES[fam].label}` : `un'attività`}${where}${lead.category ? ` (${lead.category})` : ""}.`,
    reviews ? `Reputazione online: ${reviews}${lead.rating != null && lead.rating >= 4.4 ? ", sopra la media della zona" : ""}.` : "Non ci sono recensioni pubbliche: la reputazione va verificata di persona.",
    `Nel CRM è in fase «${stageLabel(lead.stage)}»${lead.contactName ? `, referente ${lead.contactName}${lead.contactRole ? ` (${lead.contactRole})` : ""}` : ""}${channels.length ? `; recapiti: ${channels.join(", ")}` : "; nessun recapito salvato"}.`,
  ].join(" ");

  const overdueFollowUp = lead.nextFollowUp && new Date(lead.nextFollowUp).getTime() < now.getTime() && lead.stage !== "won" && lead.stage !== "lost";
  const whyNowBase =
    lead.stage === "negotiation" ? "C'è una trattativa aperta: ogni giorno senza risposta raffredda il cliente, questa visita serve a chiudere."
    : lead.stage === "qualified" ? "Ha già mostrato interesse: è il momento di passare dalla conversazione a una proposta concreta."
    : lastContact ? `L'ultimo contatto risale al ${fmtDay(lastContact.createdAt)}: riprendere il filo adesso mantiene viva la relazione.`
    : lead.rating != null && (lead.reviewsCount ?? 0) >= 100 ? `Con ${lead.reviewsCount} recensioni ha un passaggio importante: un fornitore affidabile per lui vale molto, e la concorrenza lo sa.`
    : `È un cliente in target ancora mai contattato: arrivare prima dei concorrenti${seller.territory ? ` in ${seller.territory}` : ""} è un vantaggio.`;
  const whyNow = overdueFollowUp ? `Il follow-up previsto per ${fmtDay(lead.nextFollowUp!)} è già passato. ${whyNowBase}` : whyNowBase;

  const talkingPoints = [
    `Parti da ciò che conta per una ${cat}: ${pb.pains[0]}.`,
    items.length ? `Presenta ${items.slice(0, 2).map((x, i) => (i ? lower(x) : x)).join(" e ")}${seller.company ? ` di ${seller.company}` : ""}, collegandoli a ${pb.pains[1]}.` : `Collega la tua offerta a ${pb.pains[1]}.`,
    reviews ? `Usa le recensioni (${reviews}) come apertura: complimentati per un punto di forza concreto prima di proporre.` : `Chiedi come si fanno conoscere: senza recensioni online il passaparola è tutto, e tu puoi aiutarli.`,
    lastContact ? `Riprendi l'ultimo contatto: «${firstSentence(lastContact.content, 110)}».` : `Racconta in 30 secondi un caso di un cliente simile${seller.territory ? ` nella tua zona` : ""} con un risultato misurabile.`,
    pb.moment,
  ];

  const offerToPropose = items.length
    ? `Proponi una prova senza impegno di ${lower(offerCore)}${items[1] ? ` (eventualmente con ${lower(items[1])})` : ""}: rischio basso per il cliente, e ti permette di dimostrare il valore sul campo prima di parlare di listino.`
    : `Proponi un ordine di prova limitato o una dimostrazione gratuita: abbassa la barriera d'ingresso e ti dà un motivo per tornare.`;

  const openingLine = lastContact
    ? `Buongiorno${lead.contactName ? ` ${lead.contactName.split(" ")[0]}` : ""}, sono ${first}: ero passato a sentire com'è andata dopo la nostra ultima chiacchierata, ha due minuti?`
    : lead.rating != null && lead.rating >= 4.3
      ? `Buongiorno, sono ${first}${seller.company ? ` di ${seller.company}` : ""}. Ho letto ottime recensioni su di voi e lavoro con diverse ${cat === "attività" ? "attività" : cat} della zona: posso rubarle due minuti?`
      : `Buongiorno, sono ${first}${seller.company ? ` di ${seller.company}` : ""}: lavoro con altre attività come la vostra${where} e ho un'idea che potrebbe interessarvi. È lei il titolare?`;

  const isOwner = /titolar|proprietar|socio/.test(norm(lead.contactRole));
  const questionsToAsk = [
    ...pb.questions.filter((q) => !(isOwner && /chi decide|chi prende|chi segue|chi si occupa/i.test(q))),
    items.length ? `Oggi come gestite ${lower(offerCore)}, e cosa cambiereste?` : "Cosa cambiereste del vostro fornitore attuale?",
  ].slice(0, 4);

  const likelyObjections = [...pb.objections, FAMILY_PLAYBOOK.generic.objections[1]].slice(0, 3);

  const nextStep = openTask
    ? `Chiudi il promemoria aperto («${firstSentence(openTask.content, 80)}») e fissa una data precisa per la prova o il preventivo.`
    : lead.stage === "negotiation"
      ? "Ottieni il sì sull'ordine di prova, oppure un appuntamento entro 7 giorni con chi firma."
      : "Esci con un appuntamento fissato entro 10 giorni per consegnare la prova o un preventivo scritto, e registralo subito nel CRM.";

  const sources: Source[] = [];
  if (lead.website) sources.push({ title: `Sito ufficiale di ${lead.name}`, url: /^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}` });
  const q = encodeURIComponent([lead.name, lead.address, lead.city].filter(Boolean).join(", "));
  sources.push({ title: `${lead.name} su Google Maps`, url: `https://www.google.com/maps/search/?api=1&query=${q}` });

  return { snapshot, whyNow, talkingPoints, likelyObjections, offerToPropose, openingLine, questionsToAsk, nextStep, sources, demo: true };
}

/* ---------------------------------- Chat ---------------------------------- */

export type DemoIntent =
  | { kind: "prioritize" }
  | { kind: "followups" }
  | { kind: "email"; target: string | null }
  | { kind: "objection"; objection: string }
  | { kind: "plan" }
  | { kind: "note"; content: string; due: string | null }
  | { kind: "stage"; stage: string }
  | { kind: "lead_advice" }
  | { kind: "generic" };

const STAGE_WORDS: [RegExp, string][] = [
  [/\b(ha firmato|vinto|chiuso il contratto|acquisito)\b/, "won"],
  [/\b(perso|non (è|e) interessat|rifiutato)\b/, "lost"],
  [/\b(trattativa|negoziazione)\b/, "negotiation"],
  [/\b(qualificat)/, "qualified"],
  [/\b(contattat)/, "contacted"],
];

/** Riconosce l'intento del messaggio (modalità demo). */
export function detectIntent(message: string, hasLead: boolean, now = new Date()): DemoIntent {
  const m = norm(message);
  if (hasLead && /\b(segna|annota|ricordami|promemoria|nota|registra)\b/.test(m)) {
    return { kind: "note", content: message.trim(), due: dueFromText(m, now) };
  }
  if (hasLead && /\b(sposta|metti|passa|aggiorna)\b.*\b(fase|in |a )/.test(m)) {
    for (const [re, stage] of STAGE_WORDS) if (re.test(m)) return { kind: "stage", stage };
  }
  if (/costa troppo|troppo car|prezzo|obiezion|ci penso|ho gia un fornitore|non mi interessa|non ho tempo/.test(m)) {
    const quoted = message.match(/[«"“']([^«»"“”']{3,80})[»"”']/)?.[1];
    return { kind: "objection", objection: quoted ?? (/costa troppo|car|prezzo/.test(m) ? "Costa troppo" : message.trim()) };
  }
  if (/\b(email|e-mail|mail|messaggio|whatsapp|scrivimi|scrivi)\b/.test(m)) {
    const target = message.match(/\bper\s+(?:il|la|lo|l'|i|le)?\s*([^,.?!\n]{3,60})/i)?.[1]?.trim() ?? null;
    return { kind: "email", target };
  }
  if (/piano|giro visite|settimana|organizza|pianifica/.test(m)) return { kind: "plan" };
  if (/richiamar|follow.?up|scadenz|cosa ho oggi|promemoria/.test(m)) return { kind: "followups" };
  if (/chi (dovrei|devo|posso)|chiamare oggi|priorit|migliori clienti|piu caldi|chi contatto/.test(m)) return { kind: "prioritize" };
  if (hasLead) return { kind: "lead_advice" };
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

export type DemoLeadRow = { id: string; name: string; category: string | null; city: string | null; stage: string; stageLabel?: string; score: number | null; nextFollowUp?: string | null; hasPhone?: boolean };
export type DemoFollowups = { followups: { leadId: string; name: string; date: string | null; overdue: boolean; stage: string; hasPhone?: boolean }[]; openTasks: { leadId: string; leadName: string; content: string; dueAt: string | null; overdue: boolean }[] };

export function demoAnswerPrioritize(leads: DemoLeadRow[], due: DemoFollowups, seller: SellerProfile) {
  if (!leads.length && !due.followups.length) {
    return `Nel tuo CRM non ci sono ancora clienti da cui partire.\n\n**Cosa ti consiglio oggi:**\n1. Vai su **Trova clienti** e cerca ${seller.idealCustomer ? `«${firstSentence(seller.idealCustomer, 60).toLowerCase()}»` : "la categoria che servi meglio"}${seller.territory ? ` in ${seller.territory}` : ""}.\n2. Importa i 10-15 risultati migliori.\n3. Torna qui e chiedimi di nuovo: li ordino per priorità.`;
  }
  const lines: string[] = ["Ecco da chi partirei oggi, in ordine:"];
  const seen = new Set<string>();
  let n = 0;
  for (const f of due.followups.filter((f) => f.overdue).slice(0, 3)) {
    seen.add(f.leadId);
    lines.push(`${++n}. **${f.name}** — follow-up scaduto${f.date ? ` dal ${fmtDay(f.date)}` : ""} (${f.stage}). ${f.hasPhone ? "Chiamalo stamattina." : "Non hai il numero: passa di persona."}`);
  }
  const boost: Record<string, number> = { negotiation: 25, qualified: 15, contacted: 5 };
  const ranked = [...leads].sort((a, b) => (b.score ?? 45) + (boost[b.stage] ?? 0) - ((a.score ?? 45) + (boost[a.stage] ?? 0)));
  for (const l of ranked) {
    if (n >= 5 || seen.has(l.id)) continue;
    seen.add(l.id);
    const why = l.score != null && l.score >= 75 ? `punteggio alto (${l.score})` : l.stage === "negotiation" ? "trattativa aperta" : l.stage === "qualified" ? "già qualificato" : l.score != null ? `punteggio ${l.score}` : "ancora da valutare";
    lines.push(`${++n}. **${l.name}**${l.category ? ` · ${l.category}` : ""}${l.city ? `, ${l.city}` : ""} — ${why}, fase ${l.stageLabel ?? stageLabel(l.stage)}.`);
  }
  lines.push("", `**Consiglio:** concentra le chiamate tra le 10 e le 11:30, prima del pranzo.${leads.some((l) => l.score == null) ? " Per i clienti senza punteggio usa **Valuta** nella scheda: così l'ordine diventa più preciso." : ""}`);
  if (due.openTasks.length) lines.push("", `Hai anche ${due.openTasks.length} ${due.openTasks.length === 1 ? "promemoria aperto" : "promemoria aperti"}: chiedimi «cosa ho in scadenza?» per vederli.`);
  return lines.join("\n");
}

export function demoAnswerFollowups(due: DemoFollowups) {
  if (!due.followups.length && !due.openTasks.length) return "Nessun follow-up o promemoria in scadenza nei prossimi 7 giorni. Buon momento per cercare nuovi clienti o richiamare chi è in fase «Contattato» da più tempo.";
  const lines = ["**In scadenza (prossimi 7 giorni):**"];
  for (const f of due.followups) lines.push(`- ${f.overdue ? "**Scaduto** · " : ""}**${f.name}** — ${f.date ? fmtDay(f.date) : "senza data"} · ${f.stage}`);
  for (const t of due.openTasks) lines.push(`- ${t.overdue ? "**Scaduto** · " : ""}${t.leadName}: ${firstSentence(t.content, 90)}${t.dueAt ? ` (${fmtDay(t.dueAt)})` : ""}`);
  lines.push("", "Parti dagli scaduti: una chiamata breve per riprendere il filo e fissare il passo successivo.");
  return lines.join("\n");
}

export function demoAnswerEmail(seller: SellerProfile, lead: { name: string; category: string | null; city: string | null; contactName: string | null } | null, target: string | null) {
  const name = lead?.name ?? target ?? "[Nome attività]";
  const contact = lead?.contactName ? `Gentile ${lead.contactName},` : "Buongiorno,";
  const fam = familyOf(lead?.category) ?? familyOf(lead?.name);
  const peers = fam ? `attività di ${FAMILIES[fam].label} come la vostra` : "attività come la vostra";
  const offer = seller.products ? lower(seller.products.replace(/\s+/g, " ").trim().replace(/[.;]$/, "")) : null;
  return [
    `Ecco una bozza di primo contatto per **${name}**, ${seller.tone ? `con tono ${seller.tone.toLowerCase()}` : "pronta da inviare"}:`,
    "",
    `**Oggetto:** Una proposta per ${name}${lead?.city ? ` — ${lead.city}` : ""}`,
    "",
    contact,
    "",
    `mi chiamo ${seller.name}${seller.company ? ` e seguo ${seller.company}` : ""}${seller.territory ? ` in ${seller.territory}` : ""}. Lavoro ogni giorno con ${peers}${seller.sector ? ` e mi occupo di ${lower(seller.sector)}` : ""}.`,
    "",
    `Le scrivo perché credo di poterle offrire qualcosa di concreto${offer ? `: ${offer}` : ": condizioni chiare, assistenza rapida e un referente sempre raggiungibile"}.`,
    "",
    "Le propongo un incontro di 15 minuti da voi, nel giorno e nell'orario che preferisce: porto qualche campione e valutiamo insieme se ha senso.",
    "",
    "Grazie per l'attenzione, resto a disposizione.",
    "",
    `${seller.name}${seller.company ? `  \n${seller.company}` : ""}  \n[Telefono]`,
    "",
    "---",
    "**Perché funziona:** è breve, parla del suo lavoro prima che del tuo, chiude con una richiesta piccola e precisa. Se non risponde, richiama dopo 3 giorni lavorativi.",
  ].join("\n");
}

export function demoAnswerObjection(objection: string, seller: SellerProfile) {
  const items = productItems(seller.products);
  const value = items[0] ?? "il servizio";
  const o = norm(objection);
  if (/car|prezzo|costa/.test(o)) {
    return [
      `**«${objection}»** è quasi sempre una richiesta di chiarezza sul valore, non un no. Tre passi:`,
      "",
      "1. **Accogli e chiedi il riferimento** — «Capisco. Rispetto a cosa le sembra caro: al fornitore attuale o al budget che aveva in mente?»",
      `2. **Sposta sul costo totale** — «Guardiamo il conto a fine mese: con ${value.toLowerCase()} risparmia [tempo/scarti/fermi]. Su un anno quanto vale per lei?»`,
      "3. **Riduci il rischio, non il prezzo** — «Facciamo così: partiamo con una prova di due settimane. Se non vede la differenza, ci salutiamo da amici.»",
      "",
      "**Da evitare:** lo sconto immediato. Se devi concedere qualcosa, scambialo: *«Posso venirle incontro sul prezzo se partiamo con l'ordine annuale.»*",
    ].join("\n");
  }
  if (/fornitore/.test(o)) {
    return `**«${objection}»** — rispondi con rispetto e curiosità:\n\n> «Ottimo, vuol dire che sa cosa cerca. Cosa le piace di più del suo fornitore? E se potesse cambiare una cosa, quale sarebbe?»\n\nDalla risposta capisci dove inserirti. Poi proponi una **prova in parallelo** su un solo prodotto: nessuno deve "tradire" il fornitore storico per provare.`;
  }
  if (/tempo/.test(o)) {
    return `**«${objection}»** — rispetta il suo tempo e ottieni un impegno piccolo:\n\n> «Ci mancherebbe, la vedo impegnatissimo. Mi dice lei un momento più tranquillo questa settimana? Mi bastano dieci minuti.»\n\nSegna subito data e ora nel CRM: un appuntamento concordato vale dieci passaggi a vuoto.`;
  }
  return `**«${objection}»** — prima di rispondere, fai una domanda per capire cosa c'è dietro:\n\n> «La capisco. Posso chiederle cosa la frena di più: il momento, le condizioni o qualcos'altro?»\n\nPoi rispondi solo al motivo vero, con un esempio concreto di un cliente simile e una proposta a basso rischio (prova, campione, ordine minimo).`;
}

export function demoAnswerPlan(leads: DemoLeadRow[], seller: SellerProfile, now = new Date()) {
  if (!leads.length) return "Non ho trovato clienti attivi nel CRM da inserire in un piano visite. Importa qualche lead da **Trova clienti** e riprova: li raggruppo per zona e priorità.";
  const byCity = new Map<string, DemoLeadRow[]>();
  for (const l of leads) {
    const c = l.city ?? "Zona non indicata";
    byCity.set(c, [...(byCity.get(c) ?? []), l]);
  }
  const groups = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length);
  const days = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"];
  const start = (now.getUTCDay() + 6) % 7; // 0 = lunedì
  const lines = [`Ecco una proposta di giro visite${seller.territory ? ` in ${seller.territory}` : ""}, raggruppata per zona per ridurre i chilometri:`, ""];
  groups.slice(0, 5).forEach(([city, ls], i) => {
    const d = days[Math.min(4, start > 4 ? i : start + i)] ?? days[i];
    const sorted = [...ls].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 4);
    lines.push(`**${d} — ${city}**`);
    for (const l of sorted) lines.push(`- ${l.name}${l.category ? ` (${l.category})` : ""} · ${l.stageLabel ?? stageLabel(l.stage)}${l.score != null ? ` · punteggio ${l.score}` : ""}`);
    lines.push("");
  });
  lines.push("**Suggerimenti:** visita prima i clienti in trattativa e qualificati, poi i nuovi con punteggio alto. Prepara il briefing di ogni visita dalla scheda cliente: ci vuole un minuto.");
  return lines.join("\n");
}

export function demoAnswerLeadAdvice(lead: { name: string; category: string | null; stage: string; score: number | null; nextFollowUp: Date | string | null }, seller: SellerProfile) {
  const fam = familyOf(lead.category) ?? familyOf(lead.name);
  const pb = FAMILY_PLAYBOOK[fam ?? "generic"];
  return [
    `Su **${lead.name}** (${stageLabel(lead.stage)}${lead.score != null ? `, punteggio ${lead.score}` : ""}) farei così:`,
    "",
    `- **Obiettivo del prossimo contatto:** ${lead.stage === "new" ? "farti conoscere e fissare una visita breve" : lead.stage === "negotiation" ? "chiudere l'ordine di prova" : "portarlo al passo successivo con una proposta concreta"}.`,
    `- **Leva principale:** ${pb.pains[0]}${productItems(seller.products)[0] ? `, collegata a ${productItems(seller.products)[0].toLowerCase()}` : ""}.`,
    `- **Quando:** ${pb.moment}`,
    `- **Domanda chiave:** «${pb.questions[0]}»`,
    "",
    lead.nextFollowUp ? `Hai un follow-up previsto per il ${fmtDay(lead.nextFollowUp)}.` : "Non c'è un follow-up in agenda: dimmi «ricordami di richiamarlo giovedì» e lo registro io.",
  ].join("\n");
}

export function demoAnswerGeneric(message: string, seller: SellerProfile) {
  return [
    `Posso aiutarti con questo. In modalità dimostrativa le mie risposte sono di esempio, ma usano i dati reali del tuo CRM${seller.sector ? ` e del tuo profilo (${seller.sector})` : ""}.`,
    "",
    "Prova a chiedermi:",
    "- **Chi dovrei chiamare oggi?** — ordino i clienti per priorità e follow-up scaduti",
    "- **Scrivimi un'email di primo contatto per** [nome cliente]",
    "- **Come rispondo a «costa troppo»?**",
    "- **Prepara un piano visite per questa settimana**",
    "",
    `Con la chiave API attiva risponderò in modo completo anche a richieste libere come: «${firstSentence(message, 80)}».`,
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

function lower(s: string) {
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
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
