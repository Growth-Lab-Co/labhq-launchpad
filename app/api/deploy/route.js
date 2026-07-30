import { NextResponse } from "next/server";
import { askClaudeStructured } from "@/lib/claude";
import { getTenant, markTenantDeployed, setHealthcareMode, updateTenant } from "@/lib/tenants";
import { CUSTOM_VALUE_KEYS } from "@/lib/questions";
import { buildHardGuardrails, classifyHealthcareBusiness } from "@/lib/guardrails";
import { runGhlProvisioning } from "@/lib/ghlProvisioning";
import { recordDeployment } from "@/lib/deployments";
import { logActivity } from "@/lib/activity";
import { createSession, setSessionCookie, cookieDomainForRequest } from "@/lib/miiaCustomerAuth";
import { sendTransactionalEmail } from "@/lib/emailFailures";

export const maxDuration = 120;

// action: "generate" -> interview answers => custom values JSON (for review screen)
// action: "deploy"   -> create GHL sub-account from snapshot + push custom values

const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const OPS_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

// booking_link is passthrough-only (see the pickUrl logic below) - never
// asked of the generation model.
const GENERATE_KEYS = CUSTOM_VALUE_KEYS.filter((k) => k !== "booking_link");

// Launch-blocker fix (2026-07-30): the generation model can reply in plain
// prose instead of calling the tool (rare, but when it happens it happens
// on every retry for the same answers - something about that specific
// answers object derails it, not random noise). This is the last-resort
// layer if askClaudeStructured's tool_choice-enforced call AND one retry
// both fail: build a usable config directly from the raw interview answers,
// no model call at all, so a paid customer is never blocked here. Every
// value is still editable on the review screen before deploy.
function deterministicConfigFromAnswers(answers, tenant) {
  const businessName = answers.business_name || tenant.name;
  return {
    business_name: businessName,
    services_summary: answers.services || "",
    service_area: answers.service_area || "",
    opening_hours: answers.opening_hours || "",
    qualification_questions: answers.ideal_lead || "",
    booking_rules: answers.booking_rules || "",
    faq_block: answers.faqs || "",
    tone_style: answers.tone || "Friendly and professional.",
    greeting_line: "",
    escalation_name: answers.escalation || "the team",
    escalation_contact: "",
    website_url: answers.website || "",
    mia_guardrails: answers.guardrails || "",
    nurture_hook: `Booking with ${businessName} means a fast reply and a team that knows what they're doing.`,
    sms_compliance_footer: `${businessName}. Reply STOP to opt out.`,
    privacy_policy_snippet: `${businessName} uses an AI assistant to help handle calls, messages and bookings. It may collect your name, contact details and the details of your enquiry to respond and to arrange bookings. Calls may be recorded. Automated systems are used in handling enquiries and booking, with a team member available to step in at any time.`,
  };
}

// Ops alert for a degraded-but-successful generation (deterministic fallback
// used) or a genuine total failure (customer sees the calm "finishing your
// setup" state) - either way, the raw captured answers are preserved in the
// email so nothing is lost and a human can finish or polish the config by
// hand. Best-effort: a failed alert must never turn into a customer-facing
// error on top of whatever already happened.
async function alertOpsGenerationIssue({ slug, businessName, answers, severity, detail }) {
  const subject = `[Miia] Config generation ${severity} - ${businessName || slug}`;
  const text = `Tenant: ${slug}\nBusiness: ${businessName || "-"}\nSeverity: ${severity}\n${detail}\n\nCaptured answers:\n${JSON.stringify(answers, null, 2)}`;
  try {
    await sendTransactionalEmail({
      context: `miia-generate-config-${severity}`,
      to: OPS_EMAIL,
      subject,
      text,
      html: `<pre style="font-family:monospace;white-space:pre-wrap;">${text}</pre>`,
      from: MIIA_FROM,
      tenantSlug: slug,
    });
  } catch (e) {
    console.error(`[GENERATE-CONFIG] ops alert itself failed tenant=${slug}:`, e.message);
  }
}

// Best-effort idempotency guard for "deploy": in-memory, per-session, per
// function instance. Not distributed-safe, but it's exactly what's needed to
// stop a double-click creating two sub-accounts. Resets on cold start.
const DEPLOY_LOCK_TTL_MS = 3 * 60 * 1000;
const deployLocks = new Map(); // sessionId -> { status: "in-progress" | "done", ts }

function claimDeployLock(sessionId) {
  if (!sessionId) return { ok: true };
  const existing = deployLocks.get(sessionId);
  if (existing) {
    const age = Date.now() - existing.ts;
    if (existing.status === "in-progress" && age < DEPLOY_LOCK_TTL_MS) {
      return { ok: false, message: "This system is already being deployed, hang tight, it'll finish shortly." };
    }
    if (existing.status === "done") {
      return { ok: false, message: "This session has already deployed a system. Refresh to start a new one." };
    }
  }
  deployLocks.set(sessionId, { status: "in-progress", ts: Date.now() });
  return { ok: true };
}

// Persists the one-deploy-per-tenant lock for product:"miia" tenants only -
// see the comment on markTenantDeployed in lib/tenants.js for why this must
// never run for agency-style tenants. Best-effort: a Blobs hiccup here must
// not turn an otherwise-successful deploy into a failure for the customer.
async function lockDeployedTenant(tenant, slug) {
  if (tenant.product !== "miia") return;
  try {
    await markTenantDeployed(slug);
  } catch (e) {
    console.error(`[DEPLOY-LOCK-FAIL] tenant=${slug}`, e.message);
  }
}

// Job 2b (2026-07-29 "simplification build") - the morning report's #1
// wince: a customer landed on a sign-in screen straight after finishing
// intake, because the dashboard's auth gate (lib/dashboardAccess.js) only
// ever recognised a magic-link session, and deploying never minted one.
//
// The fix mints the exact same session a magic-link click creates
// (lib/miiaCustomerAuth.js's createSession/setSessionCookie - same 30-day
// token, same cookie, same store) directly on this response, the moment
// intake finishes deploying. Deliberately the "boring" option: reusing the
// existing session mechanism verbatim rather than inventing a shorter-lived
// or differently-scoped token for this one moment - the trust boundary is
// identical to what a magic link already grants (whoever completes intake
// on this exact tenant's not-yet-deployed URL), so a new mechanism would
// only add complexity without changing what's actually being trusted.
//
// Cross-device is a non-issue for this specific bridge, by construction:
// the browser that calls this deploy endpoint is necessarily the same
// browser that then follows the redirect to the dashboard (Chat.jsx does
// both in one client-side flow) - there's no window where the cookie needs
// to travel to a different device. A genuinely different device visiting
// later (checked email on a different phone, say) still needs the normal
// magic link, exactly as before - this only ever smooths the one redirect
// that happens right after deploying, not future return visits.
async function attachDashboardSession(res, tenant, slug, req) {
  if (tenant.product !== "miia") return res;
  const { token, expiresAt } = await createSession({ tenantSlug: slug });
  return setSessionCookie(res, token, expiresAt, cookieDomainForRequest(req));
}

export async function POST(req) {
  try {
    const { tenant: slug, answers = {}, customValues, action, sessionId } = await req.json();
    const tenant = await getTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

    if (action === "generate") {
      const system = `You are configuring an AI-powered onboarding system for a small business, based on an intake interview.
Produce the configuration values below. Write in Australian English. Be specific to THIS business - no generic filler. Never use em dashes (—) anywhere - use a comma, a full stop, or a simple hyphen (-) instead. The assistant's name is spelled exactly "${tenant.assistantName}" (character for character) wherever you refer to it - never substitute a different or more common spelling.

Keys to produce (ALL required):
- business_name: clean business name
- services_summary: 2-3 sentences describing what they do, written for an AI receptionist to reference
- service_area: where they operate
- opening_hours: their hours, plain format
- qualification_questions: the 1-3 questions the AI receptionist should ask to qualify a caller, phrased naturally as questions
- booking_rules: appointment rules the AI must follow (length, buffers, who, constraints)
- faq_block: their top customer FAQs with answers, formatted as "Q: ... A: ..." lines
- tone_style: 1-2 sentences instructing the AI how to sound for this business
- greeting_line: the exact opening line the AI receptionist says when answering a call (include business name, warm, under 20 words)
- escalation_name: who to hand off to
- escalation_contact: their contact detail
- website_url: their website or empty string
- mia_guardrails: things the AI must never say or do, as clear instructions
- nurture_hook: one sentence used in follow-up messages describing the value of booking with this business
- sms_compliance_footer: sender identification + opt-out for outbound SMS, formatted like "[Business Name]. Reply STOP to opt out." using their actual business name
- privacy_policy_snippet: a ready-to-paste paragraph for the client's privacy policy disclosing that an AI assistant handles calls/messages, what personal information it collects, that calls may be recorded, and that automated systems are used in handling enquiries and booking - plain English, specific to this business

Interview answers:
${JSON.stringify(answers, null, 2)}`;

      const schema = {
        type: "object",
        properties: Object.fromEntries(GENERATE_KEYS.map((k) => [k, { type: "string" }])),
        required: GENERATE_KEYS,
      };
      const toolMessages = [{ role: "user", content: "Generate the configuration now." }];
      const callArgs = {
        messages: toolMessages,
        toolName: "submit_configuration",
        toolDescription: "Submit the generated onboarding configuration values for this business.",
        schema,
        maxTokens: 1800,
      };

      let values;
      let degraded = false;
      let pending = false;
      try {
        values = await askClaudeStructured({ system, ...callArgs });
      } catch (e1) {
        console.error(`[GENERATE-CONFIG] first attempt failed tenant=${slug}:`, e1.message);
        try {
          values = await askClaudeStructured({
            system: `${system}\n\nYour previous attempt did not produce a valid tool call with every required field filled in. Call the tool now, with every field filled in.`,
            ...callArgs,
          });
        } catch (e2) {
          console.error(`[GENERATE-CONFIG] retry also failed tenant=${slug}, falling back to deterministic extraction from captured answers:`, e2.message);
          try {
            values = deterministicConfigFromAnswers(answers, tenant);
            degraded = true;
          } catch (e3) {
            console.error(`[GENERATE-CONFIG] deterministic fallback itself failed tenant=${slug}:`, e3.message);
            pending = true;
          }
        }
      }

      if (pending) {
        await alertOpsGenerationIssue({
          slug,
          businessName: answers.business_name || tenant.name,
          answers,
          severity: "failed",
          detail: "Every generation layer failed (structured call, retry, and deterministic fallback). Customer is seeing the calm 'finishing your setup' state. Finish this manually from the answers below, then use the admin retry path.",
        });
        return NextResponse.json(
          { error: "Miia's finishing your setup. We'll email you within the hour.", pending: true },
          { status: 502 }
        );
      }

      // Guarantee every expected key exists so the review screen is stable.
      const complete = {};
      for (const k of CUSTOM_VALUE_KEYS) complete[k] = values[k] ?? "";

      // Australian compliance: these are enforced in code AFTER generation so a
      // creative interview answer can never strip them out. See COMPLIANCE.md.
      const businessName = complete.business_name || answers.business_name || tenant.name;
      complete.greeting_line = `Hi, you've called ${businessName}. I'm ${tenant.assistantName}, an AI assistant. This call may be recorded. How can I help?`;

      const escalationName = complete.escalation_name || "a human team member";
      complete.mia_guardrails = [complete.mia_guardrails, buildHardGuardrails({ escalationName })]
        .filter(Boolean)
        .join("\n\n");

      // Direct passthrough, not part of the "Keys to produce" prompt above -
      // a pasted URL must survive byte-for-byte, not get paraphrased by the
      // generation model. Validated, not trusted blindly: found during
      // testing that the interview model can occasionally capture an
      // unrelated later answer against this field once it's "the next
      // uncaptured one" (harmless for prose fields, but this one gets
      // offered as a live link by the bot, so garbage here is worse than
      // blank). Falls back to pulling a URL out of booking_rules, since
      // that's where a mid-conversation link mention has landed in
      // practice - blank if neither has one.
      const urlPattern = /https?:\/\/[^\s,)]+/i;
      const pickUrl = (text) => urlPattern.exec(text || "")?.[0]?.replace(/[.,;]+$/, "") || "";
      complete.booking_link = pickUrl(answers.booking_link) || pickUrl(answers.booking_rules);

      if (degraded) {
        alertOpsGenerationIssue({
          slug,
          businessName,
          answers,
          severity: "degraded",
          detail: "The AI generation step failed twice, so this config was built deterministically from the raw captured answers instead - functional but less polished than usual. Worth a manual pass to tidy tone/phrasing once deployed.",
        }).catch(() => {});
      }

      return NextResponse.json({ customValues: complete, degraded });
    }

    if (action === "deploy") {
      if (!customValues) return NextResponse.json({ error: "Missing customValues" }, { status: 400 });

      // One deploy per tenant, for life, for product:"miia" - each slug is a
      // single business that already paid via Stripe, not a reusable agency
      // portal. Closes off an unauthenticated stranger re-running the
      // interview and creating another real GHL sub-account for free against
      // someone else's paid signup.
      if (tenant.product === "miia" && tenant.deployedAt) {
        return NextResponse.json(
          { error: "This business is already set up. Contact hello@growthlabco.com.au if you need changes." },
          { status: 409 }
        );
      }

      // The "belt" healthcare trigger (see lib/guardrails.js
      // classifyHealthcareBusiness): catches a health business regardless of
      // which page it signed up through - the "braces" trigger is the
      // signup-source vertical, set at tenant creation in
      // lib/miiaProvisioning.js. Skipped once the tenant already has
      // healthcareMode on, or once an operator has made an explicit manual
      // call either way (source === "manual" is sticky - see
      // setHealthcareMode). Never blocks or fails the deploy.
      if (tenant.product === "miia" && !tenant.healthcareMode && tenant.healthcareModeSource !== "manual") {
        try {
          const isHealthcare = await classifyHealthcareBusiness({
            businessName: customValues.business_name || answers.business_name || tenant.name,
            services: answers.services || customValues.services_summary || "",
          });
          if (isHealthcare) {
            await setHealthcareMode(slug, { enabled: true, source: "intake-classifier" });
          }
        } catch (e) {
          console.error(`[HEALTHCARE-CLASSIFY-FAIL] tenant=${slug}`, e.message);
        }
      }

      // Stored on the tenant (not customValues - this isn't sent to GHL,
      // just drives which practice-software connect card the dashboard
      // emphasises - see lib/integrations/registry.js).
      if (tenant.product === "miia" && answers.practice_software) {
        const t = answers.practice_software.toLowerCase();
        const practiceSoftware = t.includes("cliniko")
          ? "cliniko"
          : t.includes("halaxy")
          ? "halaxy"
          : /\bnone\b|don'?t use|do not use|no practice software|nothing/.test(t)
          ? "none"
          : "other";
        await updateTenant(slug, { practiceSoftware }).catch((e) =>
          console.error(`[DEPLOY] failed to save practiceSoftware for ${slug}:`, e.message)
        );
      }

      const lock = claimDeployLock(sessionId);
      if (!lock.ok) return NextResponse.json({ error: lock.message }, { status: 409 });

      const businessName = customValues.business_name || answers.business_name || "New Lab HQ Client";

      // Miia Chat tier only (job 2a, 2026-07-29 "simplification build") -
      // "live in minutes": don't make the customer wait on any GHL step at
      // all. A deployment record + working widget exist immediately;
      // sub-account provisioning runs quietly afterward via a Netlify
      // Background Function and is never allowed to surface an error back
      // to this customer - see netlify/functions/ghl-provision-background.mjs.
      // Everywhere keeps the honest 48-hour framing and the full
      // synchronous path below, unchanged.
      if (tenant.product === "miia" && tenant.plan === "chat") {
        deployLocks.set(sessionId, { status: "done", ts: Date.now() });
        await lockDeployedTenant(tenant, slug);

        const deployRecord = await recordDeployment({
          tenant: slug,
          businessName,
          contactName: answers.contact_name || "",
          locationId: null,
          demo: false,
          answers,
          customValues,
          ghlStatus: "pending",
        });

        await logActivity({ tenant: slug, deploymentId: deployRecord?.id, businessName, type: "deployment", text: "System deployed" });

        const site = process.env.URL || `https://${req.headers.get("host")}`;
        fetch(`${site}/.netlify/functions/ghl-provision-background`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenantSlug: slug, answers, customValues, deploymentId: deployRecord?.id, businessName }),
        }).catch((e) => console.error(`[DEPLOY] failed to enqueue background provisioning for ${slug}:`, e.message));

        return attachDashboardSession(
          NextResponse.json({ ok: true, demo: false, instant: true, locationId: null, pushed: [], locationAuthNeeded: false }),
          tenant,
          slug,
          req
        );
      }

      try {
        const result = await runGhlProvisioning({ tenant, slug, answers, customValues });

        if (result.demo) {
          await new Promise((r) => setTimeout(r, 4000));
          deployLocks.set(sessionId, { status: "done", ts: Date.now() });
          await lockDeployedTenant(tenant, slug);
          const demoRecord = await recordDeployment({
            tenant: slug,
            businessName,
            contactName: answers.contact_name || "",
            locationId: result.locationId,
            demo: true,
            answers,
            customValues,
          });
          await logActivity({ tenant: slug, deploymentId: demoRecord?.id, businessName, type: "deployment", text: "System deployed" });
          return attachDashboardSession(
            NextResponse.json({
              ok: true,
              demo: true,
              locationId: result.locationId,
              pushed: Object.keys(customValues).map((name) => ({ name, ok: true })),
            }),
            tenant,
            slug,
            req
          );
        }

        const { locationId, pushed, failures, contactWarning, contactCreated, formEmbed, locationAuthNeeded, authorizeUrl } = result;

        if (sessionId) deployLocks.set(sessionId, { status: "done", ts: Date.now() });
        await lockDeployedTenant(tenant, slug);

        const deployRecord = await recordDeployment({
          tenant: slug,
          businessName,
          contactName: answers.contact_name || "",
          locationId,
          demo: false,
          answers,
          customValues,
          locationAuthNeeded,
          contactCreated,
          customValuesSynced: !locationAuthNeeded && failures.length === 0,
          syncFailures: failures.map((f) => f.name),
        });

        await logActivity({
          tenant: slug,
          deploymentId: deployRecord?.id,
          businessName,
          type: "deployment",
          text: "System deployed",
        });
        if (locationAuthNeeded) {
          await logActivity({
            tenant: slug,
            deploymentId: deployRecord?.id,
            businessName,
            type: "attention",
            text: "Data sync needs authorisation",
          });
        }

        return attachDashboardSession(
          NextResponse.json({
            ok: true,
            demo: false,
            locationId,
            pushed,
            warning:
              !locationAuthNeeded && failures.length
                ? `${failures.length} custom value(s) failed to push - check GHL and re-add manually: ${failures
                    .map((f) => f.name)
                    .join(", ")}`
                : null,
            contactWarning,
            formEmbed,
            locationAuthNeeded,
            authorizeUrl,
          }),
          tenant,
          slug,
          req
        );
      } catch (e) {
        // Allow a legitimate retry after a genuine failure.
        if (sessionId) deployLocks.delete(sessionId);
        console.error(
          `[DEPLOY-FAIL] tenant=${slug} sessionId=${sessionId || "-"} step=${e.path || "deploy"} status=${e.status ?? "-"}`,
          e.body ?? e.message
        );
        return NextResponse.json(
          {
            error:
              "We hit a snag creating your system. Our team has been notified and will finish your setup manually within the hour.",
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
