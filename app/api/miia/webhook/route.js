import { NextResponse } from "next/server";
import { blobStore } from "@/lib/blobsFetch";
import { verifyMiiaWebhookSignature, planForPriceId } from "@/lib/miiaStripe";
import { handleCompletedCheckoutSession } from "@/lib/miiaProvisioning";
import { setJSONAtomic } from "@/lib/blobsAtomic";
import { getSignupByStripeCustomerId, updateSignup } from "@/lib/miiaSignups";
import { updateTenant } from "@/lib/tenants";

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

  // Backstop for whatever changed the subscription's price outside the
  // dashboard's own "Upgrade" button (app/api/miia/dashboard/upgrade-plan),
  // which already syncs tenant/signup.plan synchronously on that path - a
  // plan change made directly in Stripe (support, dunning recovery, a
  // future portal-driven change) would otherwise leave our own records
  // showing the old plan indefinitely.
  if (event.type === "customer.subscription.updated") {
    try {
      const subscription = event.data.object;
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const plan = planForPriceId(priceId);
      if (plan) {
        const signup = await getSignupByStripeCustomerId(subscription.customer);
        if (signup && signup.plan !== plan) {
          await updateSignup(signup.id, { plan });
          if (signup.tenantSlug) await updateTenant(signup.tenantSlug, { plan }).catch(() => {});
          console.log(`[miia-webhook] synced plan=${plan} for tenant=${signup.tenantSlug || signup.id} from subscription.updated`);
        }
      }
    } catch (e) {
      console.error("[miia-webhook] subscription.updated sync failed:", e.message);
    }
  }

  // Deletion/dunning: received + acknowledged so Stripe doesn't retry them
  // and future billing-status handling has a landing spot - no action taken
  // yet, unchanged from before.
  if (event.type === "customer.subscription.deleted" || event.type === "invoice.payment_failed") {
    console.log(`[miia-webhook] received ${event.type} for ${event.data.object.id} - no handler yet`);
  }

  return NextResponse.json({ ok: true });
}
