import { NextResponse } from "next/server";
import { blobStore } from "@/lib/blobsFetch";
import { verifyMiiaWebhookSignature } from "@/lib/miiaStripe";
import { handleCompletedCheckoutSession } from "@/lib/miiaProvisioning";
import { setJSONAtomic } from "@/lib/blobsAtomic";

function eventsStore() {
  return blobStore({ name: "miia-stripe-events", consistency: "strong" });
}

// Reliability backstop for Miia checkout - the success page also drives
// provisioning synchronously for a fast redirect, but that depends on the
// customer's browser actually reaching the success page. This webhook is
// the path that fires regardless (closed tab, network drop, etc), so a paid
// customer is never stranded on provisioning failure without an alert going
// out. Idempotent the same way app/api/stripe/webhook is: a Blobs record
// written before any side effect, so a retried delivery can't double-fire.
export async function POST(req) {
  if (!process.env.MIIA_STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Miia Stripe isn't configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const valid = await verifyMiiaWebhookSignature(rawBody, sig);
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
    try {
      await handleCompletedCheckoutSession(event.data.object.id);
    } catch (e) {
      console.error("[miia-webhook] provisioning failed:", e.message);
      // Don't 500 - that would make Stripe retry the whole event forever.
      // provisionTenantForSignup already recorded the failure + alerted ops.
    }
  }

  // Subscription lifecycle events: no activation logic needed today (the
  // subscription's existence isn't what gates provisioning - payment is),
  // but received + acknowledged so Stripe doesn't retry them and future
  // billing-status handling (e.g. dunning, cancellation) has a landing spot.
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed"
  ) {
    console.log(`[miia-webhook] received ${event.type} for ${event.data.object.id} - no handler yet`);
  }

  return NextResponse.json({ ok: true });
}
