import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getDashboard } from "@/lib/crm/dashboard";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await getDashboard(user.id));
}
