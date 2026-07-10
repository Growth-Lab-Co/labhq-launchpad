import { NextResponse } from "next/server";
import { adminConfigured, verifyAdminKey } from "@/lib/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function GET() {
  return NextResponse.json({ configured: adminConfigured() });
}

export async function POST(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({ route: "admin-auth", ip, max: MAX_ATTEMPTS, windowMs: WINDOW_MS });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
    );
  }

  const { password } = await req.json().catch(() => ({}));
  if (!verifyAdminKey(password)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
