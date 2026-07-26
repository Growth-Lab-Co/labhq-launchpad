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
