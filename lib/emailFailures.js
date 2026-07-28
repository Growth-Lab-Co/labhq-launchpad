// Makes transactional email failures loud, permanently - see the 2026-07-28
// "welcome emails silently failing" incident. Every Miia transactional send
// (welcome email, magic-link request, provisioning-failed alert) logs here
// on failure via logEmailFailure(), which:
//   1. Persists the failure (visible as a badge in /admin/miia-signups and
//      a site-wide red banner in /admin).
//   2. Immediately tries to alert a human by email - deliberately WITHOUT
//      the caller's own `from` override, so this alert doesn't depend on
//      the same sender/domain that might be the reason the original send
//      failed (see lib/email.js's sendEmail - omitting `from` falls back
//      to RESEND_FROM_EMAIL or Resend's own sandbox address, neither of
//      which needs meetmiia.com's domain verification).
// Never throws - a failure to log a failure must not take down the caller.

import { blobStore } from "./blobsFetch.js";
import { randomUUID } from "crypto";
import { sendEmail } from "./email.js";

// Resend's actual wording for an unverified sending domain (confirmed
// 2026-07-28 - see the incident this file backs). Matched loosely since
// providers reword these messages over time.
const DOMAIN_NOT_VERIFIED_RE = /domain.*(not verified|is not verified|isn.t verified)/i;

const STORE_NAME = "email-failures";
const MAX_ENTRIES = 200;
const OPS_ALERT_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

export async function logEmailFailure({ context, to, subject, error, signupId, tenantSlug }) {
  const entry = {
    id: randomUUID(),
    context, // e.g. "welcome-email", "magic-link", "provisioning-alert"
    to: to || null,
    subject: subject || null,
    error: error || "Unknown error",
    signupId: signupId || null,
    tenantSlug: tenantSlug || null,
    createdAt: new Date().toISOString(),
  };

  try {
    const record = (await store().get("log", { type: "json" })) || { entries: [] };
    record.entries = [entry, ...record.entries].slice(0, MAX_ENTRIES);
    await store().setJSON("log", record);
  } catch (e) {
    console.error("[email-failures] failed to persist failure record:", e.message);
  }

  console.error(`[EMAIL-FAIL] context=${context} to=${to || "-"} signupId=${signupId || "-"}`, error);

  // Best-effort alert - if this ALSO fails, it's logged but not retried
  // infinitely (the red banner in /admin is the true fallback, since it
  // doesn't depend on email working at all).
  try {
    await sendEmail({
      to: OPS_ALERT_EMAIL,
      subject: `[Miia] Email send failed - ${context}`,
      text: `A transactional email failed to send.\n\nContext: ${context}\nTo: ${to || "-"}\nSubject: ${subject || "-"}\nSignup: ${signupId || "-"}\nTenant: ${tenantSlug || "-"}\nError: ${error}\n\nCheck /admin/miia-signups - there's a resend button on the affected row.`,
      html: `<pre style="font-family:monospace;white-space:pre-wrap;">Context: ${context}\nTo: ${to || "-"}\nSubject: ${subject || "-"}\nSignup: ${signupId || "-"}\nTenant: ${tenantSlug || "-"}\nError: ${error}</pre>`,
    });
  } catch (e) {
    console.error("[email-failures] alert email itself failed:", e.message);
  }

  return entry;
}

// Wraps sendEmail with the domain-verification fallback + permanent
// failure logging every Miia transactional send should go through.
// If the primary `from` fails specifically because its sending domain
// isn't verified in Resend, retries once with no `from` override (falls
// back to RESEND_FROM_EMAIL or Resend's sandbox address - see
// lib/email.js) so the customer still gets the email today, while
// logging a lower-severity entry so ops knows the real domain needs
// fixing. Any other failure (or a failed fallback) logs at full severity
// via logEmailFailure, including the ops alert attempt.
export async function sendTransactionalEmail({ context, to, subject, html, text, from, signupId, tenantSlug }) {
  const primary = await sendEmail({ to, subject, html, text, from });
  if (primary.ok) return primary;

  if (from && DOMAIN_NOT_VERIFIED_RE.test(primary.error || "")) {
    const fallback = await sendEmail({ to, subject, html, text }); // no `from` - uses the working default
    if (fallback.ok) {
      await logEmailFailure({
        context: `${context}-fallback-sender-used`,
        to,
        subject,
        error: `Primary sender failed (${primary.error}) - delivered via fallback sender instead. Fix the sending domain's verification in Resend.`,
        signupId,
        tenantSlug,
      });
      return fallback;
    }
    await logEmailFailure({ context, to, subject, error: `Primary: ${primary.error}. Fallback also failed: ${fallback.error}`, signupId, tenantSlug });
    return fallback;
  }

  await logEmailFailure({ context, to, subject, error: primary.error, signupId, tenantSlug });
  return primary;
}

export async function listEmailFailures({ sinceMs } = {}) {
  const record = await store().get("log", { type: "json" });
  const entries = record?.entries || [];
  if (!sinceMs) return entries;
  const cutoff = Date.now() - sinceMs;
  return entries.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
}
