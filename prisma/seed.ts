// Seed dimostrativo: utente demo@agentipro.it / demo1234 con ~25 clienti di Milano.
// Idempotente: cancella e ricrea i dati dell'utente demo. Esegui con `npm run db:seed`.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_EMAIL = "demo@agentipro.it";

const DAY = 86_400_000;
const now = new Date();
/** Data "solo giorno" (follow-up) a N giorni da oggi, salvata alle 12:00 UTC. */
const dayOffset = (n: number) => {
  const d = new Date(now.getTime() + n * DAY);
  return new Date(`${d.toISOString().slice(0, 10)}T12:00:00.000Z`);
};
/** Istante a N giorni (frazionari) da adesso. */
const at = (days: number, hour?: number) => {
  const d = new Date(now.getTime() + days * DAY);
  if (hour != null) d.setUTCHours(hour - 1, 0, 0, 0); // ora italiana (CET) approssimata
  return d;
};

type Act = { type: "note" | "call" | "email" | "meeting" | "task"; content: string; ago?: number; due?: number; dueHour?: number; done?: boolean };
type SeedLead = {
  name: string; category: string; address: string; lat: number; lng: number; phone?: string; email?: string; website?: string;
  rating?: number; reviews?: number; stage: string; score?: number; reason?: string; value?: number; contact?: [string, string];
  tags?: string[]; notes?: string; followUp?: number; lostReason?: string; activities?: Act[]; createdAgo: number;
};

const LEADS: SeedLead[] = [
  {
    name: "Bar Pasticceria Ambrosiana", category: "Bar pasticceria", address: "Corso Buenos Aires 54", lat: 45.4812, lng: 9.2105,
    phone: "+39 02 2940 1182", email: "info@ambrosiana-pasticceria.it", rating: 4.5, reviews: 812, stage: "negotiation", score: 91,
    reason: "Alto passaggio a colazione, fornitore attuale in scadenza a fine anno, titolare interessato al comodato.", value: 9600,
    contact: ["Giulia Ferri", "Titolare"], tags: ["colazioni", "comodato", "priorità"], followUp: 0, createdAgo: 34,
    notes: "Consumo stimato 9 kg/settimana. Vuole una macchina 3 gruppi e formazione baristi per due nuovi assunti.",
    activities: [
      { type: "meeting", content: "Prima visita con degustazione: piaciuto molto il blend Aurora 80/20.", ago: 20 },
      { type: "email", content: "Inviata proposta economica con comodato macchina 3 gruppi.", ago: 9 },
      { type: "call", content: "Chiede sconto del 5% sul primo ordine. Mi riservo di sentire l'azienda.", ago: 3 },
      { type: "task", content: "Richiamare con la risposta sullo sconto", due: 0, dueHour: 10 },
    ],
  },
  {
    name: "Caffè Brera 21", category: "Caffetteria", address: "Via Fiori Chiari 21", lat: 45.4718, lng: 9.1867,
    phone: "+39 02 8646 3390", website: "caffebrera21.it", rating: 4.3, reviews: 455, stage: "qualified", score: 84,
    reason: "Zona turistica, clientela alto spendente, attenzione alla qualità della tazzina.", value: 7200,
    contact: ["Marco Riva", "Gestore"], tags: ["specialty", "turistico"], followUp: -2, createdAgo: 26,
    notes: "Interessato a una linea specialty monorigine per l'espresso del pomeriggio.",
    activities: [
      { type: "call", content: "Telefonata conoscitiva: vuole provare campioni di monorigine Etiopia.", ago: 12 },
      { type: "task", content: "Portare campioni Etiopia Sidamo e Brasile Cerrado", due: -2, dueHour: 15 },
    ],
  },
  {
    name: "Trattoria Da Gino ai Navigli", category: "Trattoria", address: "Ripa di Porta Ticinese 33", lat: 45.4513, lng: 9.1745,
    phone: "+39 02 8940 2271", rating: 4.4, reviews: 1290, stage: "contacted", score: 72,
    reason: "Ristorante con buon volume a pranzo e cena; il caffè oggi è un costo, non un'opportunità.", value: 4200,
    contact: ["Luigi Bassi", "Titolare"], tags: ["ristorazione", "navigli"], followUp: 1, createdAgo: 15,
    activities: [{ type: "call", content: "Parlato con il titolare: disponibile a un incontro la prossima settimana, dopo le 15.", ago: 4 }],
  },
  {
    name: "Hotel Repubblica Milano", category: "Hotel 4 stelle", address: "Piazza della Repubblica 12", lat: 45.4802, lng: 9.2003,
    phone: "+39 02 6230 9100", email: "fb@hotelrepubblica.example", website: "hotelrepubblica.example", rating: 4.2, reviews: 2104,
    stage: "negotiation", score: 88, reason: "Colazione a buffet per 140 camere e bar lounge: volumi elevati e contratto annuale.", value: 18500,
    contact: ["Sara Colombo", "F&B Manager"], tags: ["hotel", "contratto annuale", "priorità"], followUp: 3, createdAgo: 48,
    notes: "Gara interna con altri due fornitori. Decisione entro metà mese. Punto chiave: assistenza in 24h.",
    activities: [
      { type: "meeting", content: "Incontro con F&B manager e direttore: richiesta di capsule per le camere + grani per il bar.", ago: 30 },
      { type: "email", content: "Inviato capitolato tecnico e referenze di altri hotel.", ago: 18 },
      { type: "meeting", content: "Test di degustazione con lo staff del bar: feedback molto positivo.", ago: 6 },
    ],
  },
  {
    name: "Panificio Sant'Ambrogio", category: "Panetteria caffetteria", address: "Via San Vittore 8", lat: 45.4625, lng: 9.1739,
    phone: "+39 02 4801 5523", rating: 4.6, reviews: 389, stage: "new", score: 79,
    reason: "Panetteria con angolo caffetteria in crescita, oggi usa capsule della GDO.", value: 3000,
    tags: ["colazioni"], createdAgo: 3,
  },
  {
    name: "Bistrot Isola", category: "Bistrot", address: "Via Pastrengo 14", lat: 45.4874, lng: 9.1893,
    phone: "+39 02 3656 7740", website: "bistrotisola.example", rating: 4.5, reviews: 640, stage: "new", score: 82,
    reason: "Quartiere Isola in forte crescita, brunch nel weekend, pubblico giovane attento alla qualità.", value: 4800,
    tags: ["brunch", "specialty"], createdAgo: 2,
  },
  {
    name: "Bar Duomo Express", category: "Bar", address: "Via Torino 2", lat: 45.4627, lng: 9.1871,
    phone: "+39 02 7201 8890", rating: 3.9, reviews: 1780, stage: "new", score: 76,
    reason: "Passaggio altissimo ma margini bassi: decide il prezzo al kg.", value: 6000,
    tags: ["alto passaggio"], createdAgo: 5,
  },
  {
    name: "Pasticceria Cucchi Porta Romana", category: "Pasticceria", address: "Corso di Porta Romana 61", lat: 45.4562, lng: 9.1975,
    phone: "+39 02 5830 2216", rating: 4.7, reviews: 920, stage: "won", score: 93,
    reason: "Cliente storico della zona, clientela fidelizzata, consumo elevato.", value: 11200,
    contact: ["Elena Cucchi", "Titolare"], tags: ["colazioni", "comodato"], followUp: 21, createdAgo: 90,
    notes: "Contratto firmato: 24 mesi, macchina 3 gruppi in comodato, consegna quindicinale.",
    activities: [
      { type: "meeting", content: "Firma del contratto e definizione calendario consegne.", ago: 14 },
      { type: "note", content: "Installazione macchina completata, formazione baristi fatta.", ago: 10 },
      { type: "task", content: "Controllo soddisfazione dopo il primo mese", due: 21, dueHour: 11 },
    ],
  },
  {
    name: "Osteria del Castello", category: "Osteria", address: "Via Legnano 18", lat: 45.4757, lng: 9.1815,
    phone: "+39 02 8058 4471", rating: 4.1, reviews: 310, stage: "lost", score: 58,
    reason: "Volumi contenuti e forte legame con il fornitore attuale.", value: 2400,
    contact: ["Paolo Neri", "Titolare"], tags: ["ristorazione"], lostReason: "Ha rinnovato per 2 anni con il fornitore attuale", createdAgo: 60,
    activities: [{ type: "call", content: "Il titolare ha rinnovato con il fornitore attuale. Ricontattare tra 18 mesi.", ago: 22 }],
  },
  {
    name: "Caffetteria Città Studi", category: "Caffetteria", address: "Via Celoria 6", lat: 45.4764, lng: 9.2314,
    phone: "+39 02 7063 1150", rating: 4.0, reviews: 540, stage: "contacted", score: 67,
    reason: "Bacino universitario: volumi alti nei mesi di lezione, sensibile al prezzo.", value: 5400,
    contact: ["Andrea Galli", "Socio"], tags: ["università", "alto passaggio"], followUp: -1, createdAgo: 19,
    activities: [
      { type: "email", content: "Inviata presentazione e listino studenti.", ago: 8 },
      { type: "task", content: "Sollecitare risposta alla presentazione", due: -1, dueHour: 9 },
    ],
  },
  {
    name: "Ristorante La Brughiera", category: "Ristorante", address: "Viale Monza 140", lat: 45.5075, lng: 9.2254,
    phone: "+39 02 2610 4498", rating: 4.2, reviews: 280, stage: "qualified", score: 70, value: 3600,
    reason: "Ristorante con sala eventi: picchi di consumo nei weekend.", contact: ["Francesca Villa", "Responsabile sala"],
    tags: ["eventi", "ristorazione"], followUp: 5, createdAgo: 22,
    activities: [{ type: "meeting", content: "Visita: interessati anche al servizio tè e tisane per gli eventi.", ago: 7 }],
  },
  {
    name: "Bar Tabacchi Lorenteggio", category: "Bar tabacchi", address: "Via Lorenteggio 201", lat: 45.4515, lng: 9.1302,
    phone: "+39 02 4152 6603", rating: 3.8, reviews: 140, stage: "new", score: 48,
    reason: "Bar di quartiere con volumi medi, poca attenzione alla qualità.", value: 2200, tags: ["quartiere"], createdAgo: 7,
  },
  {
    name: "Gelateria Vanilla Moscova", category: "Gelateria caffetteria", address: "Via della Moscova 29", lat: 45.4791, lng: 9.1877,
    phone: "+39 02 6599 2310", rating: 4.6, reviews: 700, stage: "new", score: 63,
    reason: "Stagionalità marcata: interessante per affogati e caffè freddo in estate.", value: 2600,
    tags: ["stagionale"], createdAgo: 4,
  },
  {
    name: "Coworking Talent Garden Bar", category: "Caffetteria aziendale", address: "Via Arcivescovo Calabiana 6", lat: 45.4455, lng: 9.2181,
    email: "community@coworking.example", stage: "contacted", score: 74, value: 6800,
    reason: "Caffetteria interna per 400 coworker: volume costante tutto l'anno.", contact: ["Davide Sala", "Community manager"],
    tags: ["ufficio", "vending"], followUp: 0, createdAgo: 11,
    activities: [{ type: "email", content: "Inviata proposta per macchina superautomatica + capsule per le sale riunioni.", ago: 5 }],
  },
  {
    name: "Enoteca Bottega Ticinese", category: "Enoteca bar", address: "Corso di Porta Ticinese 70", lat: 45.4540, lng: 9.1814,
    phone: "+39 02 8392 4410", rating: 4.4, reviews: 360, stage: "new", value: 1800, tags: ["aperitivi"], createdAgo: 1,
  },
  {
    name: "Bar Centrale Stazione Garibaldi", category: "Bar", address: "Piazza Sigmund Freud 1", lat: 45.4849, lng: 9.1878,
    phone: "+39 02 2900 1180", rating: 3.7, reviews: 2300, stage: "qualified", score: 77, value: 8400,
    reason: "Bar di stazione con flusso di pendolari dalle 6 alle 21.", contact: ["Roberto Fontana", "Direttore punto vendita"],
    tags: ["alto passaggio", "pendolari"], followUp: -4, createdAgo: 28,
    activities: [
      { type: "meeting", content: "Sopralluogo: banco lungo 8 metri, servono due macchine.", ago: 16 },
      { type: "task", content: "Preparare offerta per due macchine 2 gruppi", due: -4, dueHour: 12 },
    ],
  },
  {
    name: "Pasticceria Martesana", category: "Pasticceria", address: "Via Padova 44", lat: 45.4945, lng: 9.2205,
    phone: "+39 02 2682 3315", rating: 4.5, reviews: 510, stage: "won", score: 86, value: 6400,
    contact: ["Antonio Russo", "Titolare"], tags: ["colazioni"], createdAgo: 75,
    reason: "Pasticceria di quartiere con forte clientela a colazione.",
    activities: [{ type: "note", content: "Primo ordine consegnato: 20 kg blend Aurora + 2 kg decaffeinato.", ago: 35 }],
  },
  {
    name: "Bar Sport Lambrate", category: "Bar", address: "Via Conte Rosso 9", lat: 45.4851, lng: 9.2392,
    phone: "+39 02 2159 8870", rating: 4.0, reviews: 190, stage: "lost", score: 41, value: 1900,
    tags: ["quartiere"], lostReason: "Prezzo al kg troppo alto per il locale", createdAgo: 40,
    activities: [{ type: "call", content: "Non interessato: cerca solo il prezzo più basso.", ago: 25 }],
  },
  {
    name: "Ristorante Sakura Fusion", category: "Ristorante giapponese", address: "Via Paolo Sarpi 27", lat: 45.4813, lng: 9.1735,
    phone: "+39 02 3310 5562", rating: 4.3, reviews: 870, stage: "new", score: 55,
    reason: "Consumo di caffè limitato a fine pasto; possibile interesse per tè giapponesi premium.", value: 1500,
    tags: ["ristorazione"], createdAgo: 6,
  },
  {
    name: "Libreria Caffè Porta Venezia", category: "Caffè letterario", address: "Via Lecco 3", lat: 45.4777, lng: 9.2071,
    phone: "+39 02 2952 0045", website: "libreriacaffe.example", rating: 4.7, reviews: 420, stage: "negotiation", score: 80,
    reason: "Locale con identità forte, cerca un caffè di qualità da raccontare ai clienti.", value: 5200,
    contact: ["Chiara Monti", "Titolare"], tags: ["specialty"], followUp: 2, createdAgo: 31,
    notes: "Vorrebbe co-branding sul menu e un evento di presentazione del nuovo blend.",
    activities: [
      { type: "meeting", content: "Degustazione con la titolare: scelto il monorigine Guatemala per il filtro.", ago: 13 },
      { type: "email", content: "Inviata bozza di contratto annuale con evento di lancio incluso.", ago: 2 },
    ],
  },
  {
    name: "Bar Gelateria Parco Sempione", category: "Chiosco bar", address: "Viale Gadio 2", lat: 45.4729, lng: 9.1770,
    phone: "+39 02 8901 2203", rating: 4.1, reviews: 980, stage: "contacted", score: 61, value: 2800,
    reason: "Chiosco nel parco: picco estivo molto forte, inverno debole.", tags: ["stagionale", "turistico"], followUp: 9, createdAgo: 17,
    activities: [{ type: "call", content: "Richiamare a febbraio per la stagione estiva.", ago: 9 }],
  },
  {
    name: "Mensa Aziendale Bicocca Tech", category: "Ristorazione collettiva", address: "Viale Sarca 336", lat: 45.5179, lng: 9.2132,
    email: "acquisti@bicoccatech.example", stage: "qualified", score: 69, value: 12000,
    reason: "800 pasti al giorno: grande volume ma decisione lenta via ufficio acquisti.", contact: ["Laura De Santis", "Ufficio acquisti"],
    tags: ["ufficio", "contratto annuale"], followUp: 7, createdAgo: 37,
    activities: [{ type: "email", content: "Inviata documentazione per l'albo fornitori.", ago: 11 }],
  },
  {
    name: "Caffè Navigli 1930", category: "Bar storico", address: "Alzaia Naviglio Grande 4", lat: 45.4520, lng: 9.1770,
    phone: "+39 02 5810 3392", rating: 4.2, reviews: 1560, stage: "new", score: 87,
    reason: "Locale storico molto frequentato, ha appena cambiato gestione: momento ideale per proporsi.", value: 7800,
    tags: ["navigli", "priorità"], createdAgo: 1,
  },
  {
    name: "Forno Crosta Wagner", category: "Forno caffetteria", address: "Piazza Wagner 5", lat: 45.4680, lng: 9.1601,
    phone: "+39 02 4800 7714", rating: 4.4, reviews: 300, stage: "new", score: 71, value: 3200,
    reason: "Forno artigianale con caffetteria: clientela fidelizzata del quartiere.", tags: ["colazioni"], createdAgo: 8,
  },
  {
    name: "Hotel Navigli Boutique", category: "Hotel 3 stelle", address: "Via Vigevano 12", lat: 45.4560, lng: 9.1745,
    phone: "+39 02 8942 1188", email: "info@navigliboutique.example", rating: 4.0, reviews: 640, stage: "won", score: 78, value: 5600,
    contact: ["Federico Leone", "Direttore"], tags: ["hotel"], createdAgo: 55,
    reason: "Colazione per 40 camere, richiede assistenza rapida.",
    activities: [{ type: "meeting", content: "Contratto firmato per 12 mesi con capsule in camera.", ago: 4 }],
  },
];

async function main() {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  const profile = {
    name: "Luca Bianchi",
    company: "Caffè Aurora S.r.l.",
    sector: "Forniture caffè e attrezzature per bar, pasticcerie e Horeca",
    products:
      "Caffè in grani (blend Aurora 80/20 arabica-robusta, linea specialty monorigine), capsule compatibili, decaffeinato e orzo. Macchine espresso professionali 2 e 3 gruppi in comodato d'uso gratuito con consumo minimo di 4 kg/settimana, macinadosatori, assistenza tecnica in 24h, formazione baristi inclusa. Prezzi da 17 a 26 €/kg in base a volumi e durata del contratto.",
    idealCustomer:
      "Bar, pasticcerie e caffetterie di Milano con buon passaggio a colazione (oltre 200 caffè al giorno), hotel con colazione a buffet e locali che puntano sulla qualità e oggi usano un fornitore della grande distribuzione.",
    territory: "Milano città e prima cintura",
    tone: "Professionale e cordiale",
  };
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: profile })
    : await db.user.create({ data: { ...profile, email: DEMO_EMAIL, passwordHash: await bcrypt.hash("demo1234", 10) } });

  // Reset dei dati dell'utente demo (le attività e i lead vanno via in cascata).
  await db.activity.deleteMany({ where: { userId: user.id } });
  await db.lead.deleteMany({ where: { userId: user.id } });
  await db.conversation.deleteMany({ where: { userId: user.id } });
  await db.savedSearch.deleteMany({ where: { userId: user.id } });
  if (existing) await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash("demo1234", 10) } });

  const positions = new Map<string, number>();
  for (const l of LEADS) {
    const position = positions.get(l.stage) ?? 0;
    positions.set(l.stage, position + 1);
    const created = at(-l.createdAgo);
    const agos = (l.activities ?? []).flatMap((a) => (a.ago != null ? [a.ago] : []));
    const lastTouch = agos.length ? Math.min(...agos) : l.createdAgo;
    const lead = await db.lead.create({
      data: {
        userId: user.id, name: l.name, category: l.category, address: l.address, city: "Milano", lat: l.lat, lng: l.lng,
        phone: l.phone, email: l.email, website: l.website, rating: l.rating, reviewsCount: l.reviews,
        source: "demo", sourceId: `seed-${l.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        stage: l.stage, position, value: l.value, contactName: l.contact?.[0], contactRole: l.contact?.[1], notes: l.notes,
        tags: l.tags?.join(","), nextFollowUp: l.followUp != null ? dayOffset(l.followUp) : null, lostReason: l.lostReason,
        score: l.score,
        scoreReason: l.score != null && l.reason ? JSON.stringify({ summary: l.reason, factors: [] }) : null,
        scoredAt: l.score != null ? at(-Math.min(l.createdAgo, 2)) : null,
        createdAt: created, updatedAt: at(-lastTouch),
      },
    });
    if (l.stage !== "new") {
      const reason = l.stage === "lost" && l.lostReason ? `. Motivo: ${l.lostReason}` : "";
      await db.activity.create({
        data: { userId: user.id, leadId: lead.id, type: "stage", content: `Spostato da Nuovo a ${stageName(l.stage)}${reason}`, done: true, createdAt: at(-Math.max((l.createdAgo + lastTouch) / 2, 0.2)) },
      });
    }
    for (const a of l.activities ?? []) {
      const isTask = a.type === "task" || a.due != null;
      await db.activity.create({
        data: {
          userId: user.id, leadId: lead.id, type: a.type, content: a.content,
          dueAt: a.due != null ? at(a.due, a.dueHour) : null,
          done: a.done ?? !isTask,
          createdAt: at(-(a.ago ?? (a.due != null ? Math.max(1, -a.due + 2) : 0))),
        },
      });
    }
  }

  const count = await db.lead.count({ where: { userId: user.id } });
  console.log(`✔ Utente demo pronto: ${DEMO_EMAIL} / demo1234 — ${count} clienti`);
}

function stageName(s: string) {
  return ({ contacted: "Contattato", qualified: "Qualificato", negotiation: "Trattativa", won: "Vinto", lost: "Perso" } as Record<string, string>)[s] ?? s;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
