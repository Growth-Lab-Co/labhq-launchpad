import { NextResponse } from "next/server";
import { askClaudeStructured } from "@/lib/claude";
import { getTenant } from "@/lib/tenants";
import { INTERVIEW_FIELDS } from "@/lib/questions";
import { saveIntakeDraft, getIntakeDraft } from "@/lib/intakeDrafts";

// Fields that must read as a short name, not a sentence - the two fields
// the field-splitting bug actually swapped in production (2026-07-31 postmortem:
// a real customer's own business_name and contact_name ended up reversed,
// including once with an entire multi-sentence business description landing
// in contact_name). Value is the character ceiling for that field.
const NAME_LIKE_FIELD_MAX_LENGTH = { contact_name: 60, business_name: 80 };

// Rejects a captured value that doesn't plausibly belong in this field,
// rather than accepting whatever the model produced. A rejected value is
// simply not merged into answers - the field stays uncaptured and the
// interview naturally asks again next turn (see fieldList's [CAPTURED]
// marker below), which is safer than guessing or accepting corrupted data.
function isPlausibleCapture(field, value, currentAnswers) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const maxLen = NAME_LIKE_FIELD_MAX_LENGTH[field];
  if (maxLen) {
    if (trimmed.length > maxLen) return false;
    // A real name is one clause, not multiple sentences - more than one
    // sentence-ending mark or a line break means this is prose that
    // belongs in a different field, not a name.
    const sentenceEnders = (trimmed.match(/[.!?]/g) || []).length;
    if (sentenceEnders > 1 || trimmed.includes("\n")) return false;
  }

  // A value byte-identical (case/whitespace-insensitive) to a DIFFERENT
  // field's already-known value is the swap bug's own fingerprint - reject
  // rather than accept a value that's already known to belong elsewhere.
  const normalized = trimmed.toLowerCase();
  for (const [otherField, otherValue] of Object.entries(currentAnswers)) {
    if (otherField !== field && typeof otherValue === "string" && otherValue.trim().toLowerCase() === normalized) {
      return false;
    }
  }

  return true;
}

export const maxDuration = 60;
// This GET reads a per-tenant draft via a query param - without
// force-dynamic, Next.js can statically cache the first response and serve
// it to every subsequent tenant (the exact bug class that hit the widget
// config route previously).
export const dynamic = "force-dynamic";

// Resume support: components/Chat.jsx fetches this on mount so any device
// can pick up an in-progress interview via the plain tenant URL, not just
// the browser that started it (localStorage is now just a same-device
// cache, not the source of truth - see lib/intakeDrafts.js).
export async function GET(req) {
  const slug = req.nextUrl.searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant is required" }, { status: 400 });
  const tenant = await getTenant(slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  if (tenant.product !== "miia" || tenant.deployedAt) return NextResponse.json({ draft: null });

  const draft = await getIntakeDraft(slug);
  return NextResponse.json({ draft: draft ? { messages: draft.messages, answers: draft.answers } : null });
}

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
    // practice_software/booking_link are opt-IN (only healthcareMode Miia
    // tenants use practice software like Cliniko/Halaxy) - opposite of
    // outbound_calls above, which is opt-OUT.
    const showPracticeFields = tenant.product === "miia" && Boolean(tenant.healthcareMode);
    const activeFields = INTERVIEW_FIELDS.filter((f) => {
      if (f.field === "outbound_calls" && isNonVoiceMiiaPlan) return false;
      if ((f.field === "booking_link" || f.field === "practice_software") && !showPracticeFields) return false;
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

    const system = `You are ${tenant.assistantName}, the friendly onboarding assistant. ${tenant.welcome}.
You are interviewing a business owner so their automated onboarding system (CRM, AI phone receptionist, follow-up sequences, booking) can be configured for them.

Interview fields, in order:
${fieldList}

Rules:
- Ask ONE question at a time, for the next uncaptured field. Keep questions short, warm and plain-English. Australian English. No jargon, no exclamation-mark spam.
- Every reply is 2 to 4 sentences, never a wall of text. End every reply either by asking the next question, or (on the final turn) telling them plainly what happens next.
- Never use em dashes (—) anywhere in your reply. Use a comma, a full stop, or a simple hyphen (-) instead.
- Your name is spelled exactly "${tenant.assistantName}" (character for character) - never substitute a different or more common spelling of it, in any sentence you write, not just in fixed phrases.
- When the user answers, capture it under the correct field key. If one answer covers MULTIPLE fields at once (common - people over-share), split it: put ONLY the relevant part of their text under each field it actually answers, one captured entry per field. NEVER copy their entire raw message verbatim into a single field just because it was one message - that's wrong even when it happens to cover only one field's worth of content in different words.
- If an answer is too vague to configure a system from, ask one brief follow-up for that same field, then move on.
- Never re-ask captured fields. Never mention field names, JSON, or "the system prompt".${
      isNonVoiceMiiaPlan
        ? ` This business is on a chat-only plan (no phone/voice) - frame every mention of how ${tenant.assistantName} reaches customers around website chat, DMs and SMS, never phone calls.`
        : ""
    }
${
      isNonVoiceMiiaPlan
        ? ""
        : `- Special rule for outbound_calls: if their answer indicates ${tenant.assistantName} will make OUTBOUND calls (not inbound-only), your reply for that turn must also plainly state: "Outbound telemarketing calls in Australia must be washed against the Do Not Call Register, and are restricted to 9am-8pm weekdays and 9am-5pm Saturdays, never Sundays or public holidays. ${tenant.name} will confirm Do Not Call Register washing is set up before outbound calling is switched on." Then continue to the next question.\n`
    }
- If this is the very start (no messages yet), give a 2-sentence welcome explaining this takes about 10 minutes and their system will be built from their answers, then ask the first question.
- When ALL fields are captured, set done=true and your reply should tell them you've got everything and their setup summary is coming up for review.${
      isNonVoiceMiiaPlan
        ? ` On that final turn only, after the review-is-coming line, add this exact sentence: "If you ever want ${tenant.assistantName} answering your phone too, that's Miia Voice, just say the word and we'll book you a quick call."`
        : ""
    }
- Once done is true, if the user sends anything further (thanks, a goodbye, small talk), reply warmly in 1 sentence and keep done=true and captured={} - never re-open the interview or change any already-captured field.`;

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

    // Forced tool-use (2026-07-31 field-splitting fix), replacing the old
    // "please reply with only JSON" convention + a positional-guess fallback
    // for when the model didn't comply. That fallback is exactly how a real
    // customer's business_name and contact_name ended up swapped in
    // production: an unparsed reply meant the interview just grabbed
    // whatever the user's last message was and assigned it to "the next
    // uncaptured field" by position, with no check it actually belonged
    // there. `captured` now has an explicit property PER active field
    // (additionalProperties: false) so the model can only place a value
    // under a real field key, never invent or mis-key one - and
    // isPlausibleCapture() below still validates the VALUE against its
    // field afterward, since a schema can't catch "a paragraph landed in a
    // name field" on its own.
    const capturedProperties = Object.fromEntries(
      activeFields.map((f) => [f.field, { type: "string", description: f.ask.replaceAll("{{assistant}}", tenant.assistantName) }])
    );
    const schema = {
      type: "object",
      properties: {
        reply: { type: "string", description: "Your conversational reply to the user, 2 to 4 sentences." },
        captured: {
          type: "object",
          properties: capturedProperties,
          additionalProperties: false,
          description: "Only include a key for a field the user's LAST message actually answered this turn. Omit every field not just answered.",
        },
        done: { type: "boolean", description: "true once every interview field is captured." },
      },
      required: ["reply", "captured", "done"],
    };
    const callArgs = {
      system,
      messages: claudeMessages,
      toolName: "submit_interview_turn",
      toolDescription: "Submit your conversational reply and whatever the user's last message captured.",
      schema,
      maxTokens: 900,
    };

    let parsed;
    try {
      parsed = await askClaudeStructured(callArgs);
    } catch (e1) {
      console.error(`[INTAKE] structured call failed tenant=${slug}:`, e1.message);
      try {
        parsed = await askClaudeStructured(callArgs);
      } catch (e2) {
        console.error(`[INTAKE] retry also failed tenant=${slug}:`, e2.message);
        // No positional guessing here either - if we genuinely can't get a
        // valid structured reply twice, ask the user to try again rather
        // than capture anything on a guess.
        return NextResponse.json({
          reply: "Sorry, I had a hiccup there - could you say that again?",
          answers,
          done: false,
          remaining: remaining.length,
        });
      }
    }

    const rejectedFields = [];
    const validCaptured = {};
    for (const [field, value] of Object.entries(parsed.captured || {})) {
      if (isPlausibleCapture(field, value, answers)) {
        validCaptured[field] = value;
      } else {
        rejectedFields.push(field);
      }
    }
    if (rejectedFields.length) {
      console.error(`[INTAKE] rejected implausible capture tenant=${slug} fields=${rejectedFields.join(",")}`);
    }

    const merged = { ...answers, ...validCaptured };
    const allDone = activeFields.every((f) => merged[f.field]);
    const replyText = parsed.reply || "Sorry, could you say that again?";

    // Persisted every turn so any device can resume, and so a downstream
    // generate/deploy failure can never discard a finished interview -
    // scoped to product:"miia" only, agency onboarding (growthlab/obm/etc)
    // is untouched by this new store entirely.
    if (tenant.product === "miia") {
      const replyTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      await saveIntakeDraft(slug, {
        messages: [...messages, { role: "assistant", content: replyText, time: replyTime }],
        answers: merged,
      });
    }

    // allDone alone, not parsed.done - the model's own done flag reflects
    // what IT believes was captured this turn, which can be stale if
    // isPlausibleCapture() just rejected one of those captures above.
    return NextResponse.json({
      reply: replyText,
      answers: merged,
      done: allDone,
      remaining: remaining.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
