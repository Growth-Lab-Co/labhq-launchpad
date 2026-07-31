// Netlify Background Function (note the -background suffix: Netlify invokes
// this async with a 202 and up to 15 minutes to run, rather than the ~10-26s
// budget a normal function gets) - job 2, 2026-07-31. Same pattern as
// bot-reply-background.mjs, applied to the in-house widget/TestChat/preview
// path: reply generation is fully decoupled from any live HTTP connection,
// so a slow Claude response (observed 30-36s from this environment, right
// at the edge of Netlify's own connection ceiling for a live streamed
// response) can never cause a lost reply or an empty transcript again.
// Enqueued by app/api/widget/message/route.js's POST (submit) handler.
import { getTenant } from "../../lib/tenants.js";
import { listDeployments } from "../../lib/deployments.js";
import { generateReply, fileBookingRequestIfConfirmed } from "../../lib/bot.js";
import { askClaude } from "../../lib/claude.js";
import { getWidgetConversation, resolvePendingWidgetReply } from "../../lib/widgetConversations.js";
import { getPreviewSession, resolvePendingPreviewReply, incrementPreviewMessageCount } from "../../lib/previewSessions.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
// Never a raw error/parser message, never "Something went wrong" - a
// visitor waited for this, so the least we owe them is a calm human line.
const CALM_FAILURE_TEXT = "Sorry, that's taking longer than it should on my end. Please try sending that again in a moment.";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// getText extracts the string to validate from whatever generate() resolves
// to - a plain string for the preview path, generateReply's own
// { reply, actions } shape for the tenant path - so retries work the same
// way for both without generateReply needing to return a bare string.
async function withRetries(generate, getText = (result) => result) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await generate();
      const text = getText(result).trim();
      if (text) return result;
      lastError = new Error("empty reply from model");
    } catch (e) {
      lastError = e;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  throw lastError;
}

async function handleTenantReply({ tenantSlug, conversationId, message }) {
  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  const conversation = await getWidgetConversation(conversationId);
  if (!deployment || !conversation) throw new Error(`missing deployment or conversation for ${tenantSlug}/${conversationId}`);

  // Everything already appended (including this turn's own inbound message
  // and the pending placeholder) - exclude anything not yet resolved so the
  // model never sees its own empty in-flight reply as part of the history.
  const history = conversation.messages.filter((m) => m.status !== "pending");

  // offerActions: true - the one and only place suggested action buttons
  // get turned on (see lib/bot.js generateReply's own comment on why this
  // is the whole channel-awareness mechanism: TestChat shares this same
  // path deliberately, so Bec previews the exact thing a real visitor sees).
  const { reply, actions } = await withRetries(
    () => generateReply({ deployment, messages: history, inboundText: message, offerActions: true }),
    (result) => result.reply
  );
  await resolvePendingWidgetReply(conversationId, { body: reply, status: "complete", actions });

  const tenant = await getTenant(tenantSlug).catch(() => null);
  await fileBookingRequestIfConfirmed({
    tenantSlug,
    businessName: deployment.businessName,
    deploymentId: deployment.id,
    tenantRecord: tenant,
    messages: history,
    inboundText: message,
    reply,
  }).catch((e) => console.error(`[WIDGET-BG] booking check failed for ${tenantSlug}:`, e.message));
}

async function handlePreviewReply({ previewId, message }) {
  const session = await getPreviewSession(previewId);
  if (!session) throw new Error(`missing or expired preview session ${previewId}`);

  const system = `You are Miia, an AI front-desk assistant giving a live PREVIEW to the owner of "${session.businessName}", a business you looked at from their own website.
What you know about their business (scraped from their site, may be incomplete): ${session.servicesSummary || "not much - keep questions general"}.
This is a DEMO for the business owner, not a real customer conversation - be impressive, warm, and show how you'd handle a real enquiry for a business like theirs. Keep replies under 100 words. Australian English. If you don't know something specific, say how you'd normally ask the business for it, don't invent facts.`;

  const history = session.messages
    .filter((m) => m.status !== "pending")
    .map((m) => ({ role: m.direction === "outbound" ? "assistant" : "user", content: m.body }));

  const reply = await withRetries(() =>
    askClaude({ system, messages: [...history, { role: "user", content: message }], maxTokens: 300 })
  );
  await resolvePendingPreviewReply(previewId, { body: reply, status: "complete" });
  // Matches the pre-rewrite behaviour: only a reply that actually landed
  // counts against the preview's message cap.
  await incrementPreviewMessageCount(previewId);
}

export default async (req) => {
  const payload = await req.json().catch(() => ({}));
  const { kind } = payload;
  try {
    if (kind === "tenant") {
      await handleTenantReply(payload);
    } else if (kind === "preview") {
      await handlePreviewReply(payload);
    } else {
      console.error("[WIDGET-BG] unknown kind:", kind);
    }
  } catch (e) {
    console.error(`[WIDGET-BG] failed kind=${kind}:`, e.message);
    if (kind === "tenant" && payload.conversationId) {
      await resolvePendingWidgetReply(payload.conversationId, { body: CALM_FAILURE_TEXT, status: "failed" }).catch(() => {});
    } else if (kind === "preview" && payload.previewId) {
      await resolvePendingPreviewReply(payload.previewId, { body: CALM_FAILURE_TEXT, status: "failed" }).catch(() => {});
    }
  }
  return new Response("ok");
};
