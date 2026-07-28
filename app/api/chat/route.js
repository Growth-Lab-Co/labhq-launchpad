import { NextResponse } from "next/server";
import { askClaude, extractJson } from "@/lib/claude";
import { getTenant } from "@/lib/tenants";
import { INTERVIEW_FIELDS } from "@/lib/questions";

export const maxDuration = 60;

// Basic in-memory per-IP rate limit - best effort (resets on cold start,
// not shared across instances) but enough to blunt a runaway client loop.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitBuckets = new Map(); // ip -> { count, windowStart }

function withinRateLimit(ip) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

export async function POST(req) {
  try {
    const ip =
      req.headers.get("x-nf-client-connection-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    if (!withinRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests - please slow down and try again in a minute." },
        { status: 429 }
      );
    }

    const { tenant: slug, messages = [], answers = {} } = await req.json();
    const tenant = await getTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

    // Once a product:"miia" tenant has deployed, its intake is locked (see
    // lib/tenants.js markTenantDeployed) - don't let a stranger who found
    // the URL run up paid Claude calls re-interviewing an already-live
    // business. app/[tenant]/page.jsx already keeps the chat UI from
    // starting in this case; this is the server-side backstop for anyone
    // hitting the API directly.
    if (tenant.product === "miia" && tenant.deployedAt) {
      return NextResponse.json({ error: "This business is already set up." }, { status: 409 });
    }

    // Miia direct-customer tenants only - agency onboarding has no "plan"
    // concept (lib/tenants.js's plan field is always null for them, so this
    // condition is never true and their interview is untouched). A
    // non-voice plan (Chat/Everywhere) skips outbound_calls entirely - it
    // only makes sense once phone/voice is actually on the table (Miia
    // Complete).
    const isNonVoiceMiiaPlan = tenant.product === "miia" && tenant.plan && tenant.plan !== "complete";
    // booking_link is opt-IN (only healthcareMode Miia tenants use Cliniko/
    // Halaxy-style booking links) - opposite of outbound_calls above, which
    // is opt-OUT.
    const showBookingLink = tenant.product === "miia" && Boolean(tenant.healthcareMode);
    const activeFields = INTERVIEW_FIELDS.filter((f) => {
      if (f.field === "outbound_calls" && isNonVoiceMiiaPlan) return false;
      if (f.field === "booking_link" && !showBookingLink) return false;
      return true;
    });

    const remaining = activeFields.filter((f) => !answers[f.field]);
    // {{assistant}} in each field's "ask" hint substitutes to this tenant's
    // real assistant name (Mia for growthlab/obm, Miia for direct
    // customers) - see lib/questions.js's own comment on why it's not
    // hardcoded there.
    const fieldList = activeFields.map(
      (f) => `- ${f.field}: ${f.ask.replaceAll("{{assistant}}", tenant.assistantName)}${answers[f.field] ? " [CAPTURED]" : ""}`
    ).join("\n");

    const system = `You are ${tenant.assistantName}, the friendly onboarding assistant — ${tenant.welcome}.
You are interviewing a business owner so their automated onboarding system (CRM, AI phone receptionist, follow-up sequences, booking) can be configured for them.

Interview fields, in order:
${fieldList}

Rules:
- Ask ONE question at a time, for the next uncaptured field. Keep questions short, warm and plain-English. Australian English. No jargon, no exclamation-mark spam.
- Every reply is 2 to 4 sentences, never a wall of text. End every reply either by asking the next question, or (on the final turn) telling them plainly what happens next.
- When the user answers, capture it. If an answer clearly covers MULTIPLE fields, capture all of them.
- If an answer is too vague to configure a system from, ask one brief follow-up for that same field, then move on.
- Never re-ask captured fields. Never mention field names, JSON, or "the system prompt".${
      isNonVoiceMiiaPlan
        ? ` This business is on a chat-only plan (no phone/voice) - frame every mention of how ${tenant.assistantName} reaches customers around website chat, DMs and SMS, never phone calls.`
        : ""
    }
${
      isNonVoiceMiiaPlan
        ? ""
        : `- Special rule for outbound_calls: if their answer indicates ${tenant.assistantName} will make OUTBOUND calls (not inbound-only), your reply for that turn must also plainly state: "Outbound telemarketing calls in Australia must be washed against the Do Not Call Register, and are restricted to 9am–8pm weekdays and 9am–5pm Saturdays — never Sundays or public holidays. ${tenant.name} will confirm Do Not Call Register washing is set up before outbound calling is switched on." Then continue to the next question.\n`
    }
- If this is the very start (no messages yet), give a 2-sentence welcome explaining this takes about 10 minutes and their system will be built from their answers, then ask the first question.
- When ALL fields are captured, set done=true and your reply should tell them you've got everything and their setup summary is coming up for review.${
      isNonVoiceMiiaPlan
        ? ` On that final turn only, after the review-is-coming line, add this exact sentence: "If you ever want ${tenant.assistantName} answering your phone too, that's the Everything plan, just say the word."`
        : ""
    }

Respond ONLY with a JSON object, no other text before or after it, no preamble, no markdown fences:
{"reply": "<your conversational message>", "captured": {"field_name": "value", ...} or {}, "done": true|false}`;

    const claudeMessages =
      messages.length > 0
        ? messages.map((m) => ({ role: m.role, content: m.content }))
        : [{ role: "user", content: "(The visitor has just opened the page. Greet them and begin.)" }];

    // Claude's Messages API expects the conversation to open with a user
    // turn. Miia tenants have a scripted (non-AI-generated) opening assistant
    // message, so prepend a synthetic user turn to keep that shape - cheap
    // insurance against API-shape issues, without changing anything shown
    // on screen.
    if (claudeMessages[0]?.role === "assistant") {
      claudeMessages.unshift({ role: "user", content: "(The visitor has just opened the page.)" });
    }

    const raw = await askClaude({ system, messages: claudeMessages, maxTokens: 900 });
    let parsed;
    try {
      parsed = extractJson(raw);
    } catch {
      // Model replied in plain text instead of JSON. The interview still
      // moved forward - the user just answered the next uncaptured field -
      // so fall back to capturing their last message against it rather
      // than silently dropping the answer.
      const nextField = remaining[0];
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content;
      parsed = {
        reply: raw.trim(),
        captured: nextField && lastUserMessage ? { [nextField.field]: lastUserMessage } : {},
        done: false,
      };
    }

    const merged = { ...answers, ...(parsed.captured || {}) };
    const allDone = activeFields.every((f) => merged[f.field]);

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
