// The AI conversation bot engine. Two entry points:
//
// - generateReply(): pure LLM logic (classify + reply) given a business's
//   context and a message history. No GHL calls, ever - this is what the
//   Mission Control test chat (app/api/bot/test/route.js) calls directly so
//   it works for demo-mode tenants with no GHL sub-account at all.
// - processInboundMessage(): the full pipeline for a real inbound GHL
//   message - looks up the deployment/settings, enforces gating (enabled,
//   channel, quiet hours, handoff, rate cap), fetches recent messages,
//   classifies, and sends the reply back through GHL. Called from the
//   webhook's Netlify Background Function (netlify/functions/bot-reply-background.mjs).

import { askClaude, extractJson } from "./claude.js";
import { listDeployments } from "./deployments.js";
import { getBotSettings } from "./botSettings.js";
import { getTenant, ghlCredsFor } from "./tenants.js";
import { resolveLocationDataAuth, listMessages, sendMessage, addContactTags } from "./ghl.js";
import { logActivity } from "./activity.js";
import { buildHardGuardrails, buildHealthGuardrails } from "./guardrails.js";
import { isHandoffActive, setHandoff, incrementReplyCount } from "./botCounters.js";

const MAX_REPLY_WORDS = 120;

// GHL's InboundMessage webhook documents Call/Voicemail/SMS/GMB/FB/IG/Email/
// Live Chat as the possible channels. Only the four the bot-settings toggles
// cover are ones the bot ever replies on - everything else (calls,
// voicemail, email) is out of scope and skipped.
const CHANNEL_MAP = {
  SMS: "sms",
  FB: "fb",
  Facebook: "fb",
  IG: "ig",
  Instagram: "ig",
  "Live Chat": "webchat",
  Live_Chat: "webchat",
  LIVE_CHAT: "webchat",
};

export function channelKeyForMessageType(messageType) {
  return CHANNEL_MAP[messageType] || null;
}

// Wraps at midnight when start > end (e.g. 20:00 -> 07:00). start === end
// means "no quiet hours" (24h window would otherwise always match).
export function isQuietHours({ start, end, tz }) {
  if (!start || !end || start === end) return false;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const nowMins = hh * 60 + mm;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins < endMins) return nowMins >= startMins && nowMins < endMins;
  return nowMins >= startMins || nowMins < endMins;
}

function buildSystemPrompt(deployment) {
  const cv = deployment.customValues || {};
  const businessName = cv.business_name || deployment.businessName || "the business";
  const escalationName = cv.escalation_name || "a human team member";
  const escalationContact = cv.escalation_contact || "";

  // Vertical-specific hard guardrails stack after the universal ones - never
  // folded into mia_guardrails, which is business-configurable free text.
  // Gating this on deployment.vertical (not keyword-sniffing the message)
  // keeps it a property of the business, not a per-message guess.
  const alwaysApply = [buildHardGuardrails({ escalationName })];
  if (deployment.vertical === "allied-health") {
    alwaysApply.push(buildHealthGuardrails({ escalationName }));
  }

  return `You are an AI assistant replying to inbound SMS/social/webchat messages on behalf of ${businessName}.

Business context:
- Services: ${cv.services_summary || "not specified"}
- Service area: ${cv.service_area || "not specified"}
- Hours: ${cv.opening_hours || "not specified"}
- Booking rules: ${cv.booking_rules || "not specified"}
- FAQs: ${cv.faq_block || "none on file"}
- Tone: ${cv.tone_style || "friendly and professional"}
- Escalation contact: ${escalationName}${escalationContact ? ` (${escalationContact})` : ""}

Guardrails specific to this business:
${cv.mia_guardrails || "none on file"}

Guardrails that always apply:
${alwaysApply.join(" ")}

Reply rules:
- Keep the reply under ${MAX_REPLY_WORDS} words.
- Always end with a clear next step (a question, a booking suggestion, or a prompt to reply).
- Write in Australian English, in the tone described above.
- Never invent services, prices, or availability that aren't in the business context above.`;
}

function enforceWordLimit(text, maxWords) {
  const trimmed = (text || "").trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return trimmed;
  return words.slice(0, maxWords).join(" ") + "…";
}

export async function classifyInbound({ text, handoffKeyword }) {
  const system = `Classify one inbound customer message into exactly one category: "handoff", "spam", or "normal".
- "handoff": the sender explicitly asks for a human/person, uses the word "${handoffKeyword || "human"}", or is upset/urgent enough that a person should take over.
- "spam": clearly spam, an automated message, or irrelevant marketing - not a genuine customer message.
- "normal": everything else - a real customer question, booking request, or FAQ.
Respond ONLY with JSON: {"category": "handoff" | "spam" | "normal"}`;
  try {
    const raw = await askClaude({ system, messages: [{ role: "user", content: text || "" }], maxTokens: 50 });
    const { category } = extractJson(raw);
    return ["handoff", "spam", "normal"].includes(category) ? category : "normal";
  } catch (e) {
    console.error("[CONVO-BOT] classification failed, defaulting to normal:", e.message);
    return "normal";
  }
}

// Pure generation: given a deployment's business context and a message
// history, produce a reply. No GHL calls. `messages` is oldest-first,
// [{ direction: "inbound" | "outbound", body }].
export async function generateReply({ deployment, messages = [], inboundText }) {
  const system = buildSystemPrompt(deployment);
  const history = messages.map((m) => ({
    role: m.direction === "outbound" ? "assistant" : "user",
    content: m.body || m.text || "",
  }));
  const raw = await askClaude({
    system,
    messages: [...history, { role: "user", content: inboundText }],
    maxTokens: 400,
  });
  return enforceWordLimit(raw, MAX_REPLY_WORDS);
}

async function findDeploymentByLocation(tenant, locationId) {
  const deployments = await listDeployments(tenant);
  return deployments.find((d) => d.locationId === locationId) || null;
}

function clip(text, max = 100) {
  const t = (text || "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// Full pipeline for one real inbound GHL message. Never throws - failures
// are logged and returned as { error } so the background function always
// acks cleanly to Netlify.
export async function processInboundMessage({
  tenant,
  locationId,
  conversationId,
  contactId,
  messageType,
  inboundMessageId,
}) {
  try {
    const channelKey = channelKeyForMessageType(messageType);
    if (!channelKey) return { skipped: "unsupported-channel", messageType };

    const deployment = await findDeploymentByLocation(tenant, locationId);
    if (!deployment) return { skipped: "no-deployment" };

    const settings = await getBotSettings(tenant, locationId);
    if (!settings.enabled) return { skipped: "disabled" };
    if (settings.channels?.[channelKey] === false) return { skipped: "channel-off" };
    if (isQuietHours(settings.quietHours)) return { skipped: "quiet-hours" };
    if (await isHandoffActive(tenant, conversationId)) return { skipped: "handoff-active" };

    const count = await incrementReplyCount(tenant, conversationId);
    if (count > settings.maxRepliesPerConversationPerHour) return { skipped: "rate-limit" };

    const tenantRecord = await getTenant(tenant);
    const legacyCreds = tenantRecord ? ghlCredsFor(tenantRecord) : null;
    const auth = await resolveLocationDataAuth({ tenantSlug: tenant, locationId, legacyCreds });
    if (!auth.token) return { skipped: "location-auth-needed" };

    // Never trust the webhook payload's content - re-fetch the conversation
    // from GHL with our own token and confirm the referenced message is
    // genuinely the latest inbound one before acting on it (loop guard: also
    // stops the bot ever replying to its own or another outbound message).
    let recent;
    try {
      recent = await listMessages({ token: auth.token, conversationId, limit: 10 });
    } catch (e) {
      if (e.status === 401) {
        console.error(
          `[CONVO-BOT-FAIL] tenant=${tenant} locationId=${locationId} 401 fetching messages - likely missing conversations scope, re-authorise the location app`
        );
      }
      throw e;
    }
    const latest = recent[0];
    if (!latest) return { skipped: "no-messages" };
    const latestId = latest.id || latest.messageId;
    if (inboundMessageId && latestId && latestId !== inboundMessageId) {
      return { skipped: "stale-or-superseded" };
    }
    if (latest.direction && latest.direction !== "inbound") return { skipped: "not-inbound" };

    const inboundText = latest.body || latest.text || "";
    await logActivity({
      tenant,
      deploymentId: deployment.id,
      businessName: deployment.businessName,
      type: "bot_message",
      text: `Received: "${clip(inboundText)}"`,
    });

    const category = await classifyInbound({ text: inboundText, handoffKeyword: settings.handoffKeyword });

    if (category === "handoff") {
      await setHandoff(tenant, conversationId);
      if (contactId) {
        await addContactTags({ token: auth.token, contactId, tags: ["bot-handoff"] }).catch((e) => {
          console.error(`[CONVO-BOT-FAIL] tenant=${tenant} step=addContactTags:`, e.status ?? "-", e.body ?? e.message);
        });
      }
      await logActivity({
        tenant,
        deploymentId: deployment.id,
        businessName: deployment.businessName,
        type: "attention",
        text: "AI bot handed off to a human - tagged in GHL and paused for this conversation",
      });
      return { category };
    }

    if (category === "spam") {
      console.log(`[CONVO-BOT] tenant=${tenant} conversationId=${conversationId} ignored as spam`);
      return { category };
    }

    const outboundMessages = recent
      .slice(1)
      .reverse()
      .map((m) => ({ direction: m.direction, body: m.body || m.text || "" }));
    const reply = await generateReply({ deployment, messages: outboundMessages, inboundText });

    await sendMessage({
      token: auth.token,
      type: latest.messageType || latest.type || messageType,
      contactId,
      conversationId,
      message: reply,
    });

    await logActivity({
      tenant,
      deploymentId: deployment.id,
      businessName: deployment.businessName,
      type: "bot_message",
      text: `Replied: "${clip(reply)}"`,
    });

    return { category, reply };
  } catch (e) {
    console.error(
      `[CONVO-BOT-FAIL] tenant=${tenant} locationId=${locationId} conversationId=${conversationId} status=${e.status ?? "-"}`,
      e.body ?? e.message
    );
    return { error: e.message };
  }
}
