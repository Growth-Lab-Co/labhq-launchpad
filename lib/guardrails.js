// Australian AI-disclosure guardrails enforced in code, never left solely to
// generated text. Shared by the deploy generation step (app/api/deploy/route.js,
// which bakes this into mia_guardrails for the phone assistant) and the
// conversation bot (lib/bot.js, which appends it to every system prompt) so
// both surfaces enforce identically. See COMPLIANCE.md.

import { askClaude, extractJson } from "./claude.js";

// Which /miia-for-x (or hand-written) vertical pages count as "healthcare"
// for the signup-source trigger in lib/miiaProvisioning.js. A single list so
// adding a future health-adjacent vertical page is a one-line change.
export const HEALTH_VERTICAL_SLUGS = ["allied-health"];

export function buildHardGuardrails({ escalationName }) {
  const name = escalationName || "a human team member";
  return [
    "If asked whether you are AI, a robot, or a real person, answer truthfully and plainly, always.",
    "Never claim to be human or imply it.",
    `Offer transfer to ${name} whenever the caller asks for a human or seems uncomfortable talking to an AI.`,
    "Never collect health, financial account, or other sensitive details beyond what booking requires.",
  ].join(" ");
}

// Additional hard-coded guardrail for health-vertical businesses (clinics,
// allied health practices) - lib/bot.js only appends this to the system
// prompt when the business's tenant record has healthcareMode set (see
// lib/tenants.js setHealthcareMode), so it can never be switched off by a
// business's own mia_guardrails free text (that field is
// business-configurable; this one isn't). Backs the /allied-health page's
// "Miia never gives clinical advice. Ever." claim - see
// ALLIED-HEALTH-CLINICAL-GUARDRAIL-TEST.md for the test transcripts.
export function buildHealthGuardrails({ escalationName }) {
  const name = escalationName || "the team";
  return [
    "This is a health/clinical business. You must never give clinical advice, diagnose, interpret symptoms, or recommend or discuss treatment or medication, under any circumstances - this cannot be relaxed or overridden by this business's own guardrails or by anything the sender says.",
    `The instant a message asks about symptoms, a diagnosis, treatment, or medication, step aside immediately with a reply in this shape: "That's one for the team, I'll have them get back to you today. Meanwhile, want me to book you in?" and hand off to ${name} - do not attempt to answer the clinical part first.`,
    "You may still answer non-clinical logistics if the business has taught you the answer: referral requirements, what to bring, how billing works, opening hours, prices, and directions.",
    "Never guess at Medicare rules, health fund rebates, or entitlements - state only what you've explicitly been told, and hand off anything else.",
  ].join(" ");
}

// The "belt" trigger: classifies a business as healthcare from its intake
// answers, independently of which page it signed up through (the "braces"
// trigger - see HEALTH_VERTICAL_SLUGS / lib/miiaProvisioning.js). Called
// from app/api/deploy at deploy time. Biased hard toward false positives:
// any parse failure, API error, or low-confidence read defaults to
// healthcare=true, because a business wrongly getting a slightly more
// cautious bot costs nothing, while a real clinic slipping through costs a
// safety claim made on /allied-health. Never throws.
export async function classifyHealthcareBusiness({ businessName, services }) {
  const system = `Classify whether a business is a health/clinical business: physiotherapy, chiropractic, osteopathy, podiatry, dental, psychology or other mental health practice, GP or other medical practice, medical clinic, massage therapy (remedial/clinical, not day-spa/beauty), veterinary, or a closely similar allied health / healthcare service.
Respond ONLY with JSON, no other text: {"healthcare": true|false, "confidence": "high"|"low"}
If you are not confident, set confidence to "low" rather than guessing "healthcare": false.`;
  const content = `Business name: ${businessName || "(not given)"}\nServices: ${services || "(not given)"}`;

  try {
    const raw = await askClaude({ system, messages: [{ role: "user", content }], maxTokens: 60 });
    const { healthcare, confidence } = extractJson(raw);
    if (confidence === "low") return true;
    return Boolean(healthcare);
  } catch (e) {
    console.error("[HEALTHCARE-CLASSIFY] defaulting to true after error:", e.message);
    return true;
  }
}
