import { NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/adminAuth";
import { createInviteCode, listInviteCodes } from "@/lib/inviteCodes";

function authorized(req) {
  return verifyAdminKey(req.headers.get("x-mc-key"));
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const codes = await listInviteCodes();
  return NextResponse.json({ codes });
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { planLabel } = await req.json().catch(() => ({}));
  const code = await createInviteCode({ planLabel });
  return NextResponse.json({ code });
}
