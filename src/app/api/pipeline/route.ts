import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { notFound, parseBody } from "@/lib/crm/api";
import { PipelineMove } from "@/lib/crm/schemas";
import { moveLead } from "@/lib/crm/server";

/** POST { leadId, stage, index, lostReason? } — sposta e riordina in transazione. */
export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  const body = await parseBody(req, PipelineMove);
  if (body instanceof NextResponse) return body;
  const res = await moveLead(user.id, body.leadId, body.stage, body.index, body.lostReason);
  if (!res) return notFound();
  return NextResponse.json(res);
}
