import { NextResponse } from "next/server";

// POST /api/app-webhook - stub receiver for GHL Marketplace app webhooks.
// Nothing in Launchpad depends on this yet; it just logs and acks so the
// marketplace app listing can register a webhook URL.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  console.log(`[APP-WEBHOOK] type=${body?.type || "unknown"}`, body);
  return NextResponse.json({ ok: true });
}
