// Mappatura tra parole chiave italiane e tag OpenStreetMap.

/** Un filtro OSM: chiave e valore (o valori). Senza valore = qualunque valore. */
export type OsmTag = { k: string; v?: string | string[] };

export type Category = {
  id: string;
  /** Etichetta leggibile, al singolare. */
  label: string;
  /** Parole chiave (sinonimi, plurali, forme comuni). Vengono normalizzate. */
  keywords: string[];
  tags: OsmTag[];
};

export const CATEGORIES: Category[] = [
  // --- Ristorazione e ospitalità
  { id: "bar", label: "Bar", keywords: ["bar", "caffe", "caffetteria", "caffetterie", "bar caffe", "cafe"], tags: [{ k: "amenity", v: ["bar", "cafe"] }] },
  { id: "pub", label: "Pub", keywords: ["pub", "birreria", "birrerie", "beer bar"], tags: [{ k: "amenity", v: ["pub", "biergarten"] }] },
  { id: "restaurant", label: "Ristorante", keywords: ["ristorante", "ristoranti", "trattoria", "trattorie", "osteria", "osterie", "ristorazione"], tags: [{ k: "amenity", v: "restaurant" }] },
  { id: "pizzeria", label: "Pizzeria", keywords: ["pizzeria", "pizzerie", "pizza", "pizze"], tags: [{ k: "cuisine", v: "pizza" }] },
  { id: "fast_food", label: "Fast food", keywords: ["fast food", "fastfood", "paninoteca", "paninoteche", "kebab", "rosticceria", "rosticcerie", "street food"], tags: [{ k: "amenity", v: "fast_food" }] },
  { id: "ice_cream", label: "Gelateria", keywords: ["gelateria", "gelaterie", "gelato", "gelati"], tags: [{ k: "amenity", v: "ice_cream" }, { k: "shop", v: "ice_cream" }] },
  { id: "hotel", label: "Hotel", keywords: ["hotel", "albergo", "alberghi", "b&b", "bed and breakfast", "bnb", "pensione", "pensioni", "agriturismo", "agriturismi", "ostello", "ostelli"], tags: [{ k: "tourism", v: ["hotel", "guest_house", "hostel", "motel"] }] },
  // --- Alimentari
  { id: "bakery", label: "Panetteria", keywords: ["panetteria", "panetterie", "panificio", "panifici", "forno", "forni", "fornaio"], tags: [{ k: "shop", v: "bakery" }] },
  { id: "pastry", label: "Pasticceria", keywords: ["pasticceria", "pasticcerie", "dolci", "pasticcere"], tags: [{ k: "shop", v: ["pastry", "confectionery"] }] },
  { id: "butcher", label: "Macelleria", keywords: ["macelleria", "macellerie", "macellaio", "macellai", "carne"], tags: [{ k: "shop", v: "butcher" }] },
  { id: "greengrocer", label: "Fruttivendolo", keywords: ["fruttivendolo", "fruttivendoli", "ortofrutta", "frutta e verdura", "frutta"], tags: [{ k: "shop", v: "greengrocer" }] },
  { id: "seafood", label: "Pescheria", keywords: ["pescheria", "pescherie", "pesce"], tags: [{ k: "shop", v: "seafood" }] },
  { id: "deli", label: "Gastronomia", keywords: ["gastronomia", "gastronomie", "salumeria", "salumerie", "alimentari", "negozio di alimentari", "drogheria"], tags: [{ k: "shop", v: ["deli", "convenience", "cheese"] }] },
  { id: "supermarket", label: "Supermercato", keywords: ["supermercato", "supermercati", "market", "minimarket", "discount", "ipermercato", "ipermercati"], tags: [{ k: "shop", v: "supermarket" }] },
  { id: "wine", label: "Enoteca", keywords: ["enoteca", "enoteche", "vino", "vini", "cantina", "cantine", "wine bar"], tags: [{ k: "shop", v: ["wine", "alcohol"] }, { k: "amenity", v: "wine_bar" }] },
  { id: "tobacco", label: "Tabaccheria", keywords: ["tabaccheria", "tabaccherie", "tabacchi", "tabaccaio"], tags: [{ k: "shop", v: "tobacco" }] },
  // --- Salute
  { id: "pharmacy", label: "Farmacia", keywords: ["farmacia", "farmacie", "parafarmacia", "parafarmacie"], tags: [{ k: "amenity", v: "pharmacy" }, { k: "shop", v: "chemist" }] },
  { id: "dentist", label: "Studio dentistico", keywords: ["dentista", "dentisti", "studio dentistico", "studi dentistici", "odontoiatra", "odontoiatri", "odontoiatria", "studio odontoiatrico", "studi odontoiatrici"], tags: [{ k: "amenity", v: "dentist" }, { k: "healthcare", v: "dentist" }] },
  { id: "doctor", label: "Studio medico", keywords: ["medico", "medici", "studio medico", "studi medici", "ambulatorio", "ambulatori", "poliambulatorio", "poliambulatori", "clinica", "cliniche"], tags: [{ k: "amenity", v: ["doctors", "clinic"] }, { k: "healthcare", v: ["doctor", "clinic", "centre"] }] },
  { id: "physio", label: "Fisioterapista", keywords: ["fisioterapista", "fisioterapisti", "fisioterapia", "osteopata", "osteopati"], tags: [{ k: "healthcare", v: ["physiotherapist", "alternative"] }] },
  { id: "optician", label: "Ottico", keywords: ["ottico", "ottici", "ottica", "ottiche", "occhiali"], tags: [{ k: "shop", v: "optician" }] },
  { id: "veterinary", label: "Veterinario", keywords: ["veterinario", "veterinari", "clinica veterinaria", "cliniche veterinarie", "ambulatorio veterinario"], tags: [{ k: "amenity", v: "veterinary" }] },
  // --- Cura della persona
  { id: "hairdresser", label: "Parrucchiere", keywords: ["parrucchiere", "parrucchieri", "parrucchiera", "parrucchiere donna", "acconciature", "salone", "saloni", "hair stylist"], tags: [{ k: "shop", v: "hairdresser" }] },
  { id: "barber", label: "Barbiere", keywords: ["barbiere", "barbieri", "barber", "barber shop", "barbershop"], tags: [{ k: "shop", v: "hairdresser" }] },
  { id: "beauty", label: "Centro estetico", keywords: ["estetista", "estetiste", "centro estetico", "centri estetici", "estetica", "beauty", "unghie", "nail", "solarium"], tags: [{ k: "shop", v: ["beauty", "massage"] }] },
  { id: "cosmetics", label: "Profumeria", keywords: ["profumeria", "profumerie", "cosmetici", "cosmetica"], tags: [{ k: "shop", v: ["cosmetics", "perfumery"] }] },
  { id: "gym", label: "Palestra", keywords: ["palestra", "palestre", "fitness", "centro fitness", "crossfit", "piscina", "piscine"], tags: [{ k: "leisure", v: ["fitness_centre", "sports_centre"] }] },
  // --- Negozi
  { id: "hardware", label: "Ferramenta", keywords: ["ferramenta", "ferramente", "fai da te", "bricolage", "utensileria"], tags: [{ k: "shop", v: ["hardware", "doityourself"] }] },
  { id: "clothes", label: "Abbigliamento", keywords: ["abbigliamento", "negozio di abbigliamento", "negozi di abbigliamento", "boutique", "moda", "vestiti", "intimo"], tags: [{ k: "shop", v: ["clothes", "boutique", "fashion"] }] },
  { id: "shoes", label: "Calzature", keywords: ["calzature", "calzoleria", "calzolerie", "scarpe", "negozio di scarpe"], tags: [{ k: "shop", v: "shoes" }] },
  { id: "jewelry", label: "Gioielleria", keywords: ["gioielleria", "gioiellerie", "orologeria", "orologerie", "gioielli"], tags: [{ k: "shop", v: ["jewelry", "watches"] }] },
  { id: "florist", label: "Fiorista", keywords: ["fiorista", "fioristi", "fioraio", "fiorai", "fiori", "vivaio", "vivai", "garden"], tags: [{ k: "shop", v: ["florist", "garden_centre"] }] },
  { id: "books", label: "Libreria", keywords: ["libreria", "librerie", "libri", "cartoleria", "cartolerie", "edicola", "edicole"], tags: [{ k: "shop", v: ["books", "stationery", "newsagent"] }] },
  { id: "electronics", label: "Elettronica", keywords: ["elettronica", "negozio di elettronica", "informatica", "computer", "telefonia", "cellulari"], tags: [{ k: "shop", v: ["electronics", "computer", "mobile_phone"] }] },
  { id: "appliance", label: "Elettrodomestici", keywords: ["elettrodomestici", "materiale elettrico", "illuminazione"], tags: [{ k: "shop", v: ["appliance", "electrical", "lighting"] }] },
  { id: "furniture", label: "Arredamento", keywords: ["arredamento", "arredamenti", "mobili", "mobilificio", "mobilifici", "cucine", "materassi"], tags: [{ k: "shop", v: ["furniture", "kitchen", "bed", "interior_decoration"] }] },
  { id: "pet", label: "Negozio per animali", keywords: ["animali", "negozio animali", "pet shop", "toelettatura", "acquari"], tags: [{ k: "shop", v: ["pet", "pet_grooming"] }] },
  { id: "sports", label: "Articoli sportivi", keywords: ["articoli sportivi", "negozio sportivo", "sport", "biciclette", "bici", "ciclista", "cicli"], tags: [{ k: "shop", v: ["sports", "bicycle", "outdoor"] }] },
  { id: "toys", label: "Giocattoli", keywords: ["giocattoli", "giocattolaio", "negozio di giocattoli", "prima infanzia"], tags: [{ k: "shop", v: ["toys", "baby_goods"] }] },
  { id: "paint", label: "Colorificio", keywords: ["colorificio", "colorifici", "vernici", "edilizia", "materiali edili", "piastrelle", "ceramiche"], tags: [{ k: "shop", v: ["paint", "trade", "tiles", "building_materials"] }] },
  { id: "laundry", label: "Lavanderia", keywords: ["lavanderia", "lavanderie", "tintoria", "tintorie", "lavasecco"], tags: [{ k: "shop", v: ["laundry", "dry_cleaning"] }] },
  // --- Auto e mobilità
  { id: "car_repair", label: "Officina", keywords: ["officina", "officine", "meccanico", "meccanici", "autofficina", "autofficine", "carrozzeria", "carrozzerie", "gommista", "gommisti", "elettrauto"], tags: [{ k: "shop", v: ["car_repair", "tyres"] }, { k: "craft", v: "car_repair" }] },
  { id: "car_dealer", label: "Concessionaria", keywords: ["concessionaria", "concessionarie", "autosalone", "autosaloni", "auto usate", "moto", "concessionario"], tags: [{ k: "shop", v: ["car", "motorcycle"] }] },
  { id: "car_wash", label: "Autolavaggio", keywords: ["autolavaggio", "autolavaggi", "lavaggio auto"], tags: [{ k: "amenity", v: "car_wash" }] },
  { id: "fuel", label: "Distributore", keywords: ["distributore", "distributori", "benzinaio", "benzinai", "stazione di servizio", "carburante"], tags: [{ k: "amenity", v: "fuel" }] },
  // --- Artigiani
  { id: "craft", label: "Artigiano", keywords: ["artigiano", "artigiani", "artigianato", "laboratorio", "laboratori"], tags: [{ k: "craft" }] },
  { id: "electrician", label: "Elettricista", keywords: ["elettricista", "elettricisti", "impianti elettrici"], tags: [{ k: "craft", v: "electrician" }] },
  { id: "plumber", label: "Idraulico", keywords: ["idraulico", "idraulici", "termoidraulica", "termoidraulico", "impianti idraulici"], tags: [{ k: "craft", v: ["plumber", "hvac"] }] },
  { id: "carpenter", label: "Falegnameria", keywords: ["falegname", "falegnami", "falegnameria", "falegnamerie", "serramenti", "infissi"], tags: [{ k: "craft", v: ["carpenter", "joiner", "cabinet_maker", "window_construction"] }] },
  // --- Uffici e servizi professionali
  { id: "office", label: "Ufficio", keywords: ["ufficio", "uffici", "azienda", "aziende", "impresa", "imprese", "societa"], tags: [{ k: "office" }] },
  { id: "accountant", label: "Commercialista", keywords: ["commercialista", "commercialisti", "studio commercialista", "contabilita", "consulente fiscale", "caf", "consulente del lavoro"], tags: [{ k: "office", v: ["accountant", "tax_advisor"] }] },
  { id: "lawyer", label: "Studio legale", keywords: ["avvocato", "avvocati", "studio legale", "studi legali", "notaio", "notai"], tags: [{ k: "office", v: ["lawyer", "notary"] }] },
  { id: "real_estate", label: "Agenzia immobiliare", keywords: ["agenzia immobiliare", "agenzie immobiliari", "immobiliare", "immobiliari"], tags: [{ k: "office", v: ["estate_agent"] }, { k: "shop", v: "estate_agent" }] },
  { id: "insurance", label: "Assicurazione", keywords: ["assicurazione", "assicurazioni", "agenzia assicurativa", "agenzie assicurative", "broker"], tags: [{ k: "office", v: "insurance" }] },
  { id: "architect", label: "Studio di architettura", keywords: ["architetto", "architetti", "studio di architettura", "geometra", "geometri", "ingegnere", "ingegneri"], tags: [{ k: "office", v: ["architect", "engineer", "surveyor"] }] },
  { id: "travel", label: "Agenzia di viaggi", keywords: ["agenzia di viaggi", "agenzie di viaggi", "agenzia viaggi", "viaggi"], tags: [{ k: "shop", v: "travel_agency" }, { k: "office", v: "travel_agent" }] },
  { id: "bank", label: "Banca", keywords: ["banca", "banche", "istituto di credito"], tags: [{ k: "amenity", v: "bank" }] },
  { id: "school", label: "Scuola", keywords: ["scuola", "scuole", "asilo", "asili", "asilo nido", "scuola di lingue", "autoscuola", "autoscuole"], tags: [{ k: "amenity", v: ["school", "kindergarten", "language_school", "driving_school", "childcare"] }] },
];

/** Etichette italiane per i valori di tag più comuni (per categorie non cercate esplicitamente). */
const TAG_LABELS: Record<string, string> = {
  "amenity=bar": "Bar", "amenity=cafe": "Caffetteria", "amenity=pub": "Pub", "amenity=biergarten": "Birreria",
  "amenity=restaurant": "Ristorante", "amenity=fast_food": "Fast food", "amenity=ice_cream": "Gelateria",
  "amenity=pharmacy": "Farmacia", "amenity=dentist": "Studio dentistico", "amenity=doctors": "Studio medico",
  "amenity=clinic": "Clinica", "amenity=veterinary": "Veterinario", "amenity=bank": "Banca", "amenity=fuel": "Distributore",
  "amenity=car_wash": "Autolavaggio", "amenity=school": "Scuola", "amenity=kindergarten": "Scuola dell'infanzia",
  "amenity=language_school": "Scuola di lingue", "amenity=driving_school": "Autoscuola", "amenity=childcare": "Asilo nido",
  "amenity=wine_bar": "Wine bar",
  "shop=hairdresser": "Parrucchiere", "shop=beauty": "Centro estetico", "shop=massage": "Centro massaggi",
  "shop=hardware": "Ferramenta", "shop=doityourself": "Fai da te", "shop=bakery": "Panetteria", "shop=pastry": "Pasticceria",
  "shop=confectionery": "Dolciumi", "shop=butcher": "Macelleria", "shop=greengrocer": "Fruttivendolo", "shop=seafood": "Pescheria",
  "shop=deli": "Gastronomia", "shop=convenience": "Alimentari", "shop=cheese": "Formaggi", "shop=supermarket": "Supermercato",
  "shop=wine": "Enoteca", "shop=alcohol": "Alcolici", "shop=tobacco": "Tabaccheria", "shop=chemist": "Parafarmacia",
  "shop=optician": "Ottico", "shop=cosmetics": "Profumeria", "shop=perfumery": "Profumeria", "shop=clothes": "Abbigliamento",
  "shop=boutique": "Boutique", "shop=fashion": "Moda", "shop=shoes": "Calzature", "shop=jewelry": "Gioielleria",
  "shop=watches": "Orologeria", "shop=florist": "Fiorista", "shop=garden_centre": "Vivaio", "shop=books": "Libreria",
  "shop=stationery": "Cartoleria", "shop=newsagent": "Edicola", "shop=electronics": "Elettronica", "shop=computer": "Informatica",
  "shop=mobile_phone": "Telefonia", "shop=appliance": "Elettrodomestici", "shop=electrical": "Materiale elettrico",
  "shop=lighting": "Illuminazione", "shop=furniture": "Arredamento", "shop=kitchen": "Cucine", "shop=bed": "Materassi",
  "shop=interior_decoration": "Arredo casa", "shop=pet": "Negozio per animali", "shop=pet_grooming": "Toelettatura",
  "shop=sports": "Articoli sportivi", "shop=bicycle": "Biciclette", "shop=outdoor": "Outdoor", "shop=toys": "Giocattoli",
  "shop=baby_goods": "Prima infanzia", "shop=paint": "Colorificio", "shop=trade": "Materiali edili", "shop=tiles": "Piastrelle",
  "shop=building_materials": "Materiali edili", "shop=laundry": "Lavanderia", "shop=dry_cleaning": "Tintoria",
  "shop=car_repair": "Officina", "shop=tyres": "Gommista", "shop=car": "Concessionaria", "shop=motorcycle": "Moto",
  "shop=car_parts": "Ricambi auto", "shop=travel_agency": "Agenzia di viaggi", "shop=estate_agent": "Agenzia immobiliare",
  "shop=ice_cream": "Gelateria", "shop=gift": "Articoli da regalo", "shop=variety_store": "Bazar", "shop=copyshop": "Copisteria",
  "shop=kiosk": "Chiosco", "shop=photo": "Fotografo", "shop=music": "Musica", "shop=art": "Arte", "shop=frame": "Cornici",
  "shop=bag": "Pelletteria", "shop=leather": "Pelletteria", "shop=tailor": "Sartoria", "shop=funeral_directors": "Onoranze funebri",
  "shop=hearing_aids": "Apparecchi acustici", "shop=medical_supply": "Sanitaria", "shop=herbalist": "Erboristeria",
  "shop=farm": "Prodotti agricoli", "shop=coffee": "Torrefazione", "shop=tea": "Tè", "shop=beverages": "Bevande",
  "shop=pasta": "Pastificio", "shop=general": "Emporio", "shop=department_store": "Grande magazzino", "shop=mall": "Centro commerciale",
  "craft=car_repair": "Officina", "craft=electrician": "Elettricista", "craft=plumber": "Idraulico", "craft=hvac": "Termoidraulica",
  "craft=carpenter": "Falegnameria", "craft=joiner": "Falegnameria", "craft=cabinet_maker": "Ebanisteria",
  "craft=window_construction": "Serramenti", "craft=shoemaker": "Calzolaio", "craft=tailor": "Sartoria", "craft=painter": "Imbianchino",
  "craft=builder": "Impresa edile", "craft=photographer": "Fotografo", "craft=jeweller": "Orafo", "craft=metal_construction": "Carpenteria metallica",
  "craft=locksmith": "Fabbro", "craft=key_cutter": "Duplicazione chiavi", "craft=upholsterer": "Tappezziere", "craft=winery": "Cantina",
  "craft=brewery": "Birrificio", "craft=confectionery": "Laboratorio dolciario", "craft=gardener": "Giardiniere",
  "office=accountant": "Commercialista", "office=tax_advisor": "Consulente fiscale", "office=lawyer": "Studio legale",
  "office=notary": "Notaio", "office=estate_agent": "Agenzia immobiliare", "office=insurance": "Assicurazione",
  "office=architect": "Studio di architettura", "office=engineer": "Studio di ingegneria", "office=surveyor": "Geometra",
  "office=travel_agent": "Agenzia di viaggi", "office=company": "Azienda", "office=it": "Informatica", "office=employment_agency": "Agenzia per il lavoro",
  "office=financial": "Servizi finanziari", "office=advertising_agency": "Agenzia pubblicitaria", "office=consulting": "Consulenza",
  "healthcare=dentist": "Studio dentistico", "healthcare=doctor": "Studio medico", "healthcare=clinic": "Clinica",
  "healthcare=centre": "Centro medico", "healthcare=physiotherapist": "Fisioterapista", "healthcare=alternative": "Medicina alternativa",
  "healthcare=laboratory": "Laboratorio analisi", "healthcare=psychotherapist": "Psicoterapeuta", "healthcare=optometrist": "Optometrista",
  "leisure=fitness_centre": "Palestra", "leisure=sports_centre": "Centro sportivo",
  "tourism=hotel": "Hotel", "tourism=guest_house": "B&B", "tourism=hostel": "Ostello", "tourism=motel": "Motel",
};

const GROUP_LABELS: Record<string, string> = {
  shop: "Negozio", amenity: "Attività", craft: "Artigiano", office: "Ufficio", healthcare: "Sanità", tourism: "Ospitalità", leisure: "Tempo libero",
};

/** Minuscolo, senza accenti né punteggiatura superflua. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, " ")
    .replace(/[^a-z0-9&\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KEYWORD_INDEX: Map<string, Category> = (() => {
  const m = new Map<string, Category>();
  for (const c of CATEGORIES) {
    for (const k of [c.label, ...c.keywords]) {
      const n = normalize(k);
      if (!m.has(n)) m.set(n, c);
    }
  }
  return m;
})();

const STOPWORDS = new Set(["di", "del", "della", "dei", "degli", "delle", "da", "e", "il", "lo", "la", "i", "gli", "le", "un", "una", "per", "a", "in"]);

/**
 * Trova la categoria corrispondente alla ricerca (es. "Studi dentistici" → dentist).
 * Prova la frase intera, poi senza parole vuote, poi le singole parole.
 */
export function matchCategory(query: string): Category | null {
  const n = normalize(query);
  if (!n) return null;
  const direct = KEYWORD_INDEX.get(n);
  if (direct) return direct;
  const words = n.split(" ").filter((w) => !STOPWORDS.has(w));
  const compact = words.join(" ");
  if (KEYWORD_INDEX.has(compact)) return KEYWORD_INDEX.get(compact)!;
  // Sottosequenze più lunghe prima (es. "officine meccaniche milano" → "officine")
  for (let len = words.length - 1; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const hit = KEYWORD_INDEX.get(words.slice(i, i + len).join(" "));
      if (hit) return hit;
    }
  }
  return null;
}

/** Etichetta italiana leggibile a partire dai tag OSM di un elemento. */
export function categoryLabelFromTags(tags: Record<string, string>, preferred?: Category | null): string | null {
  if (preferred?.id === "pizzeria" && tags.cuisine?.split(";").includes("pizza")) return "Pizzeria";
  if (preferred?.id === "barber" && tags.shop === "hairdresser") return "Barbiere";
  for (const key of ["amenity", "shop", "craft", "office", "healthcare", "tourism", "leisure"]) {
    const value = tags[key];
    if (!value) continue;
    const label = TAG_LABELS[`${key}=${value}`];
    if (label) return label;
    if (value === "yes") return GROUP_LABELS[key] ?? null;
    const pretty = value.replace(/_/g, " ");
    return `${GROUP_LABELS[key] ?? "Attività"} · ${pretty}`;
  }
  return preferred?.label ?? null;
}

/** Chiavi che identificano un'attività commerciale (per la ricerca per nome). */
export const POI_KEYS = ["shop", "amenity", "craft", "office", "healthcare", "tourism", "leisure"] as const;
