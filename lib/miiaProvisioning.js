// Orchestrates what happens after a Miia customer pays: create their tenant
// (own slug, own intake chat), send the welcome email, alert ops if it
// fails. Called from two places - the webhook (reliability backstop) and
// the checkout success page (fast path, better UX) - both converge here and
// it's safe to call from both/either/multiple times for the same signup.
//
// "Never strand a paid customer on an error": if tenant creation fails,
// the signup record is marked provisioningStatus "failed" (the success page
// shows the calm fallback state for this) and an alert goes to ops. Retrying
// (admin UI or automatic) just calls this again - idempotent.

import { createTenant } from "./tenants.js";
import { findOrCreateSignup, updateSignup } from "./miiaSignups.js";
import { retrieveCheckoutSession, extractSignupInputFromSession } from "./miiaStripe.js";
import { buildWelcomeEmail, buildProvisioningFailedEmail } from "./miiaEmails.js";
import { sendEmail } from "./email.js";
import { HEALTH_VERTICAL_SLUGS } from "./guardrails.js";
import { createMagicLink } from "./miiaCustomerAuth.js";
import { SITE_URL } from "@/components/miia/site";

const MIIA_ACCENT = "#A070F8";
const MIIA_ACCENT_SOFT = "#9878F0";
const MAX_SLUG_ATTEMPTS = 30;
const WELCOME_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Every email this file sends MUST pass this explicitly - lib/email.js's
// own RESEND_FROM_EMAIL default is LabHQ's (shared with its invite-email
// flow), so relying on it here would brand Miia's emails as "Lab HQ" or
// vice versa depending on which was set last.
const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";

function slugify(businessName) {
  const base = String(businessName || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "business";
}

async function claimTenantSlug({ businessName, healthcareMode }) {
  const base = slugify(businessName);
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const tenant = await createTenant({
      slug: candidate,
      name: businessName || "Your business",
      ownerAccountId: null,
      envPrefix: null, // resolves GHL_AGENCY_TOKEN/COMPANY_ID/SNAPSHOT_ID, same as growthlab - see lib/tenants.js
      assistantName: "Miia",
      product: "miia",
      welcome: "Miia is setting up your front desk",
      accent: MIIA_ACCENT,
      accentSoft: MIIA_ACCENT_SOFT,
      healthcareMode,
      healthcareModeSource: healthcareMode ? "signup" : null,
      productType: "miia",
    });
    if (tenant) return tenant;
  }
  throw new Error(`Couldn't claim a tenant slug for "${businessName}" after ${MAX_SLUG_ATTEMPTS} attempts`);
}

async function alertOps(signup, error) {
  const to = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";
  const { subject, html, text } = buildProvisioningFailedEmail({
    businessName: signup.businessName,
    email: signup.email,
    phone: signup.phone,
    plan: signup.plan,
    signupId: signup.id,
    error: error.message,
  });
  const result = await sendEmail({ to, subject, html, text, from: MIIA_FROM });
  if (result.ok) {
    await updateSignup(signup.id, { opsAlertSentAt: new Date().toISOString() });
  } else {
    console.error(`[miiaProvisioning] ops alert email failed for signup ${signup.id}:`, result.error);
  }
}

// Idempotent - safe to call repeatedly for the same signup (webhook +
// success page both call this; admin "Retry" also calls this directly).
// Tenant creation and the welcome email are tracked (and retried)
// independently: a signup can have provisioningStatus "success" with
// tenantSlug set but welcomeEmailSentAt still null (exactly what happens if
// Resend rejects the send after the tenant was already created), and a bare
// "already succeeded, return early" check would make that unrecoverable
// from the admin Retry button. So only the tenant-claim step short-circuits
// on success; the email is (re-)attempted on every call until it's sent.
export async function provisionTenantForSignup(signup) {
  let updated = signup;

  if (updated.provisioningStatus !== "success" || !updated.tenantSlug) {
    let tenant;
    try {
      tenant = await claimTenantSlug({
        businessName: updated.businessName,
        healthcareMode: HEALTH_VERTICAL_SLUGS.includes(updated.vertical),
      });
    } catch (e) {
      const failed = await updateSignup(updated.id, {
        provisioningStatus: "failed",
        provisioningError: e.message,
        provisioningAttempts: (updated.provisioningAttempts || 0) + 1,
      });
      await alertOps(failed, e).catch((emailErr) =>
        console.error(`[miiaProvisioning] alertOps itself failed for signup ${updated.id}:`, emailErr.message)
      );
      return failed;
    }

    updated = await updateSignup(updated.id, {
      tenantSlug: tenant.slug,
      provisioningStatus: "success",
      provisioningError: null,
    });
  }

  if (!updated.welcomeEmailSentAt && updated.email) {
    // The welcome email's link authenticates on click (7 days - longer than
    // the 30-minute return-visit magic link, since this is the one link a
    // customer might not open same-day) and lands on the intake chat if
    // they haven't finished it yet, or straight on their dashboard if they
    // have - app/[tenant]/page.jsx branches on deployedAt either way.
    const welcomeLinkToken = await createMagicLink({ tenantSlug: updated.tenantSlug, ttlMs: WELCOME_LINK_TTL_MS });
    const intakeLink = `${SITE_URL}/api/miia/auth/verify?token=${encodeURIComponent(welcomeLinkToken)}`;
    const firstName = (updated.contactName || "").trim().split(/\s+/)[0] || null;
    const { subject, html, text } = buildWelcomeEmail({ firstName, intakeLink });
    const result = await sendEmail({ to: updated.email, subject, html, text, from: MIIA_FROM });
    if (result.ok) {
      updated = await updateSignup(updated.id, { welcomeEmailSentAt: new Date().toISOString() });
    } else {
      console.error(`[miiaProvisioning] welcome email failed for signup ${updated.id}:`, result.error);
    }
  }

  return updated;
}

// Single entry point for "a Stripe checkout session is now paid" - called
// from both the webhook (reliability backstop) and the success page's
// synchronous path (fast UX). Always re-fetches the session from Stripe
// itself rather than trusting whatever the caller has (the webhook payload
// doesn't carry expanded line_items; a session_id from the browser could be
// anything), so this is also the auth boundary for the success page.
export async function handleCompletedCheckoutSession(sessionId) {
  const session = await retrieveCheckoutSession(sessionId);
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { status: "unpaid" };
  }

  const input = extractSignupInputFromSession(session);
  const signup = await findOrCreateSignup(input);
  const provisioned = await provisionTenantForSignup(signup);
  return { status: provisioned.provisioningStatus, signup: provisioned };
}
