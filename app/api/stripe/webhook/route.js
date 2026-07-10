import { NextResponse } from "next/server";
import { blobStore } from "@/lib/blobsFetch";
import { verifyWebhookSignature } from "@/lib/stripe";
import { updateOnboarding, maybeCompleteOnboarding } from "@/lib/accounts";
import { setJSONAtomic } from "@/lib/blobsAtomic";

function eventsStore() {
  return blobStore({ name: "stripe-events", consistency: "strong" });
}

// Inert until STRIPE_WEBHOOK_SECRET is set - never processes an unverified
// payload as an activation. Must read the RAW body for signature
// verification, not parsed JSON. Idempotent via a Blobs record written
// before any side effect, so a retried delivery after a cold start can't
// double-activate an account.
export async function POST(req) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe isn't configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const valid = await verifyWebhookSignature(rawBody, sig);
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { modified } = await setJSONAtomic(eventsStore(), event.id, { receivedAt: new Date().toISOString() }, { onlyIfNew: true });
  if (!modified) return NextResponse.json({ ok: true, duplicate: true });

  if (event.type === "checkout.session.completed") {
    const accountId = event.data?.object?.metadata?.accountId || event.data?.object?.client_reference_id;
    if (accountId) {
      await updateOnboarding(accountId, { activated: true, planLabel: "Founding partner" });
      await maybeCompleteOnboarding(accountId);
    }
  }

  return NextResponse.json({ ok: true });
}
