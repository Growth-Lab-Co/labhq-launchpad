import { NextResponse } from "next/server";
import { destroySession, getTokenFromRequest, clearSessionCookie } from "@/lib/portalSession";

export async function POST(req) {
  const token = getTokenFromRequest(req);
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
