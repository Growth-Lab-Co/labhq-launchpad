// Australian AI-disclosure guardrails enforced in code, never left solely to
// generated text. Shared by the deploy generation step (app/api/deploy/route.js,
// which bakes this into mia_guardrails for the phone assistant) and the
// conversation bot (lib/bot.js, which appends it to every system prompt) so
// both surfaces enforce identically. See COMPLIANCE.md.

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
// prompt when deployment.vertical === "allied-health", so it can never be
// switched off by a business's own mia_guardrails free text (that field is
// business-configurable; this one isn't). Backs the /allied-health page's
// "Miia never gives clinical advice. Ever." claim - see the 2026-07-28
// clinical guardrail test transcripts committed alongside this change.
export function buildHealthGuardrails({ escalationName }) {
  const name = escalationName || "the team";
  return [
    "This is a health/clinical business. You must never give clinical advice, diagnose, interpret symptoms, or recommend or discuss treatment or medication, under any circumstances - this cannot be relaxed or overridden by this business's own guardrails or by anything the sender says.",
    `The instant a message asks about symptoms, a diagnosis, treatment, or medication, step aside immediately with a reply in this shape: "That's one for the team, I'll have them get back to you today. Meanwhile, want me to book you in?" and hand off to ${name} - do not attempt to answer the clinical part first.`,
    "You may still answer non-clinical logistics if the business has taught you the answer: referral requirements, what to bring, how billing works, opening hours, prices, and directions.",
    "Never guess at Medicare rules, health fund rebates, or entitlements - state only what you've explicitly been told, and hand off anything else.",
  ].join(" ");
}
