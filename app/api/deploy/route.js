import { NextResponse } from "next/server";
import { askClaude, extractJson } from "@/lib/claude";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { CUSTOM_VALUE_KEYS } from "@/lib/questions";
import { createSubAccount, pushAllCustomValues, createContact, getForms } from "@/lib/ghl";
import { recordDeployment } from "@/lib/deployments";

export const maxDuration = 120;

// action: "generate" -> interview answers => custom values JSON (for review screen)
// action: "deploy"   -> create GHL sub-account from snapshot + push custom values

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
      return { ok: false, message: "This system is already being deployed — hang tight, it'll finish shortly." };
    }
    if (existing.status === "done") {
      return { ok: false, message: "This session has already deployed a system. Refresh to start a new one." };
    }
  }
  deployLocks.set(sessionId, { status: "in-progress", ts: Date.now() });
  return { ok: true };
}

export async function POST(req) {
  try {
    const { tenant: slug, answers = {}, customValues, action, sessionId } = await req.json();
    const tenant = getTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

    if (action === "generate") {
      const system = `You are configuring an AI-powered onboarding system for a small business, based on an intake interview.
Produce the configuration values below. Write in Australian English. Be specific to THIS business - no generic filler.

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
${JSON.stringify(answers, null, 2)}

Respond ONLY with a JSON object of exactly those keys, string values only.`;
      const raw = await askClaude({
        system,
        messages: [{ role: "user", content: "Generate the configuration now." }],
        maxTokens: 1800,
      });
      const values = extractJson(raw);
      // Guarantee every expected key exists so the review screen is stable.
      const complete = {};
      for (const k of CUSTOM_VALUE_KEYS) complete[k] = values[k] ?? "";

      // Australian compliance: these are enforced in code AFTER generation so a
      // creative interview answer can never strip them out. See COMPLIANCE.md.
      const businessName = complete.business_name || answers.business_name || tenant.name;
      complete.greeting_line = `Hi, you've called ${businessName}. I'm ${tenant.assistantName}, an AI assistant — this call may be recorded. How can I help?`;

      const escalationName = complete.escalation_name || "a human team member";
      const hardGuardrails = [
        "If asked whether you are AI, a robot, or a real person, answer truthfully and plainly, always.",
        "Never claim to be human or imply it.",
        `Offer transfer to ${escalationName} whenever the caller asks for a human or seems uncomfortable talking to an AI.`,
        "Never collect health, financial account, or other sensitive details beyond what booking requires.",
      ].join(" ");
      complete.mia_guardrails = [complete.mia_guardrails, hardGuardrails].filter(Boolean).join("\n\n");

      return NextResponse.json({ customValues: complete });
    }

    if (action === "deploy") {
      if (!customValues) return NextResponse.json({ error: "Missing customValues" }, { status: 400 });

      const lock = claimDeployLock(sessionId);
      if (!lock.ok) return NextResponse.json({ error: lock.message }, { status: 409 });

      try {
        const creds = ghlCredsFor(tenant);

        // Demo mode: no GHL creds for this tenant -> simulate success.
        if (!creds.configured) {
          await new Promise((r) => setTimeout(r, 4000));
          if (sessionId) deployLocks.set(sessionId, { status: "done", ts: Date.now() });
          const demoLocationId = "demo-" + Math.random().toString(36).slice(2, 8);
          await recordDeployment({
            tenant: slug,
            businessName: customValues.business_name || answers.business_name || "New Lab HQ Client",
            contactName: answers.contact_name || "",
            locationId: demoLocationId,
            demo: true,
            answers,
            customValues,
          });
          return NextResponse.json({
            ok: true,
            demo: true,
            locationId: demoLocationId,
            pushed: Object.keys(customValues).map((name) => ({ name, ok: true })),
          });
        }

        const businessName = customValues.business_name || answers.business_name || "New Lab HQ Client";
        const { id: locationId } = await createSubAccount({
          token: creds.token,
          companyId: creds.companyId,
          snapshotId: creds.snapshotId,
          businessName,
          contact: { website: customValues.website_url },
        });

        const pushed = await pushAllCustomValues({
          token: creds.token,
          companyId: creds.companyId,
          locationId,
          values: customValues,
        });
        const failures = pushed.filter((p) => !p.ok);

        // Post-deploy contact: fires the snapshot's Go-Live workflow (trigger:
        // contact tagged "onboarding"). Never fails the whole deploy - surface
        // a warning instead so the operator can add it manually.
        let contactWarning = null;
        const rawName = (answers.contact_name || "").trim();
        const [firstName, ...rest] = rawName.split(/\s+/).filter(Boolean);
        try {
          await createContact({
            token: creds.token,
            locationId,
            firstName,
            lastName: rest.join(" "),
            tags: ["onboarding"],
          });
        } catch (e) {
          console.error(
            `[DEPLOY-FAIL] tenant=${slug} step=createContact locationId=${locationId} status=${e.status ?? "-"}`,
            e.body ?? e.message
          );
          contactWarning =
            "We couldn't automatically create the onboarding contact — our team has been notified and will add it manually so your Go-Live workflow fires.";
        }

        // Form embed for the client's website - best effort, skip silently on failure.
        let formEmbed = null;
        try {
          const forms = await getForms({ token: creds.token, locationId });
          const form = forms[0];
          if (form?.id) {
            const formName = form.name || "Contact form";
            formEmbed = {
              formId: form.id,
              name: formName,
              snippet: `<script src="https://link.msgsndr.com/js/form_embed.js"></script>\n<iframe src="https://api.leadconnectorhq.com/widget/form/${form.id}" style="width:100%;height:600px;border:none;border-radius:4px" id="inline-${form.id}" data-form-id="${form.id}" title="${formName}"></iframe>`,
            };
          }
        } catch (e) {
          // Forms aren't essential to a successful deploy - skip silently for the user.
          console.error(
            `[DEPLOY-FAIL] tenant=${slug} step=getForms locationId=${locationId} status=${e.status ?? "-"}`,
            e.body ?? e.message
          );
        }

        if (sessionId) deployLocks.set(sessionId, { status: "done", ts: Date.now() });

        await recordDeployment({
          tenant: slug,
          businessName,
          contactName: answers.contact_name || "",
          locationId,
          demo: false,
          answers,
          customValues,
        });

        return NextResponse.json({
          ok: true,
          demo: false,
          locationId,
          pushed,
          warning: failures.length
            ? `${failures.length} custom value(s) failed to push - check GHL and re-add manually: ${failures
                .map((f) => f.name)
                .join(", ")}`
            : null,
          contactWarning,
          formEmbed,
        });
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
              "We hit a snag creating your system — our team has been notified and will finish your setup manually within the hour.",
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
