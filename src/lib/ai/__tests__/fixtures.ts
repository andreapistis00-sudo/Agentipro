import type { LeadForAi, SellerProfile } from "../lead-context";

export const seller: SellerProfile = {
  name: "Marco Rossi",
  company: "Caffè Aurora S.r.l.",
  sector: "Forniture Horeca",
  products: "Caffè in grani e capsule, macchine in comodato d'uso gratuito, assistenza tecnica in 24h",
  idealCustomer: "Bar e pasticcerie con buon passaggio, aperti a colazione",
  territory: "Milano e provincia",
  tone: "Professionale e cordiale",
};

export function makeLead(over: Partial<LeadForAi> = {}): LeadForAi {
  return {
    id: "lead_1",
    name: "Bar Centrale",
    category: "Bar",
    address: "Via Roma 1",
    city: "Milano",
    lat: null, lng: null,
    phone: "+39 02 1234567",
    email: "info@barcentrale.it",
    website: "barcentrale.it",
    openingHours: null,
    rating: 4.6,
    reviewsCount: 320,
    source: "demo",
    stage: "new",
    value: null,
    contactName: null,
    contactRole: null,
    notes: null,
    tags: null,
    nextFollowUp: null,
    lostReason: null,
    score: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    ...over,
  };
}
