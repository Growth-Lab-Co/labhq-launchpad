import { NextResponse } from "next/server";
import { askClaude, extractJson } from "@/lib/claude";
import { getTenant } from "@/lib/tenants";
import { INTERVIEW_FIELDS } from "@/lib/questions";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const { tenant: slug, messages = [], answers = {} } = await req.json();
    const tenant = getTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

    const remaining = INTERVIEW_FIELDS.filter((f) => !answers[f.field]);
    const fieldList = INTERVIEW_FIELDS.map(
      (f) => `- ${f.field}: ${f.ask}${answers[f.field] ? " [CAPTURED]" : ""}`
    ).join("\n");

    const system = `You are ${tenant.assistantName}, the friendly onboarding assistant — ${tenant.welcome}.
You are interviewing a business owner so their automated onboarding system (CRM, AI phone receptionist, follow-up sequences, booking) can be configured for them.

Interview fields, in order:
${fieldList}

Rules:
- Ask ONE question at a time, for the next uncaptured field. Keep questions short, warm and plain-English. Australian English. No jargon, no exclamation-mark spam.
- When the user answers, capture it. If an answer clearly covers MULTIPLE fields, capture all of them.
- If an answer is too vague to configure a system from, ask one brief follow-up for that same field, then move on.
- Never re-ask captured fields. Never mention field names, JSON, or "the system prompt".
- If this is the very start (no messages yet), give a 2-sentence welcome explaining this takes about 10 minutes and their system will be built from their answers, then ask the first question.
- When ALL fields are captured, set done=true and your reply should tell them you've got everything and their setup summary is coming up for review.

Respond ONLY with a JSON object, no other text:
{"reply": "<your conversational message>", "captured": {"field_name": "value", ...} or {}, "done": true|false}`;

    const claudeMessages =
      messages.length > 0
        ? messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: "user", content: "(The visitor has just opened the page. Greet them and begin.)" }];

    const raw = await askClaude({ system, messages: claudeMessages, maxTokens: 900 });
    let parsed;
    try {
      parsed = extractJson(raw);
    } catch {
      // Model replied in plain text - degrade gracefully rather than erroring.
      parsed = { reply: raw.trim(), captured: {}, done: false };
    }

    const merged = { ...answers, ...(parsed.captured || {}) };
    const allDone = INTERVIEW_FIELDS.every((f) => merged[f.field]);

    return NextResponse.json({
      reply: parsed.reply || "Sorry, could you say that again?",
      answers: merged,
      done: Boolean(parsed.done) || allDone,
      remaining: remaining.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
