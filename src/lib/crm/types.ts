// Tipi serializzabili (Server → Client) del CRM.
export type LeadDTO = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  openingHours: string | null;
  rating: number | null;
  reviewsCount: number | null;
  source: string;
  stage: string;
  position: number;
  value: number | null;
  contactName: string | null;
  contactRole: string | null;
  notes: string | null;
  tags: string[];
  nextFollowUp: string | null;
  lostReason: string | null;
  score: number | null;
  scoreReason: string | null;
  scoredAt: string | null;
  briefing: string | null;
  briefingAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityDTO = {
  id: string;
  leadId: string;
  type: string;
  content: string;
  dueAt: string | null;
  done: boolean;
  createdAt: string;
};

export type ActivityWithLeadDTO = ActivityDTO & { lead: { id: string; name: string } };

export type PipelineCard = Pick<LeadDTO, "id" | "name" | "city" | "category" | "score" | "value" | "nextFollowUp" | "stage" | "position">;
