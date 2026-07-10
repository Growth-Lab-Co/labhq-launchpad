import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { createInviteCode, listInviteCodes } from "@/lib/inviteCodes";

function denyResponse({ rateLimited, retryAfterSeconds }) {
  if (rateLimited) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) return denyResponse(auth);
  const codes = await listInviteCodes();
  return NextResponse.json({ codes });
}

export async function POST(req) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) return denyResponse(auth);
  const { planLabel } = await req.json().catch(() => ({}));
  const code = await createInviteCode({ planLabel });
  return NextResponse.json({ code });
}
