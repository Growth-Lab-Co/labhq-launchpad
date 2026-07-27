import { NextResponse } from "next/server";
import { handleCompletedCheckoutSession } from "@/lib/miiaProvisioning";

// Polled by the checkout success page. Drives provisioning synchronously
// (see lib/miiaProvisioning) for a fast redirect into the intake chat -
// the webhook is the reliability backstop, not the primary path. Safe to
// call repeatedly for the same session_id (idempotent all the way down).
export async function POST(req) {
  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  try {
    const result = await handleCompletedCheckoutSession(sessionId);
    if (result.status === "unpaid") {
      return NextResponse.json({ status: "unpaid" });
    }
    return NextResponse.json({
      status: result.status, // "success" | "failed" | "pending"
      tenantSlug: result.signup?.tenantSlug || null,
    });
  } catch (e) {
    console.error("[miia-checkout-status] failed:", e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't verify checkout." }, { status: 500 });
  }
}
