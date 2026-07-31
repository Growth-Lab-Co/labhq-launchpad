import { NextResponse } from "next/server";
import { getTenantSlugForWidgetKey } from "@/lib/widgetKeys";
import { listDeployments } from "@/lib/deployments";
import {
  createWidgetConversation,
  getWidgetConversation,
  appendWidgetMessage,
} from "@/lib/widgetConversations";
import {
  getPreviewSession,
  appendPreviewMessage,
  PREVIEW_MESSAGE_CAP,
  PREVIEW_EMAIL_GATE_AT,
} from "@/lib/previewSessions";

export const dynamic = "force-dynamic";

// The in-house widget's message endpoint (job 1, 2026-07-29; rewritten to
// submit-then-poll in job 2, 2026-07-31) - embedded on arbitrary customer
// domains via public/widget.js, so this is the one API route in the app
// that genuinely needs cross-origin handling, an origin check, and its own
// rate limit (everything else in the app is same-origin or admin/session-
// gated).
//
// POST submits a message and returns immediately (no reply generation
// happens inline here at all) - a Netlify Background Function
// (netlify/functions/widget-reply-background.mjs) does the actual Claude
// call, fully decoupled from this request's connection. GET polls for that
// background function's result. This replaced a live-streaming response:
// direct testing found Claude's response time from this environment is
// consistently 30-36s, which collides almost exactly with a ~30s
// connection ceiling Netlify enforces on a route like this one - three
// different streaming-response designs were tried and each still lost
// replies or transcripts under that collision (see the git history on this
// file for what didn't work and why). Submit-then-poll has no connection
// for a slow reply to collide with in the first place.

// Best-effort, in-memory, per-instance - resets on cold start, not shared
// across function instances. Enough to blunt a runaway embed or scripted
// abuse; not a distributed rate limiter. Keyed by IP + widget/preview id so
// one abusive site can't throttle every other tenant's widget. Polling gets
// its own, more generous bucket - a single reply can mean ~40 poll requests
// while the background function works, which would trip the submit limit.
const SUBMIT_WINDOW_MS = 60_000;
const SUBMIT_MAX = 20;
const POLL_WINDOW_MS = 60_000;
const POLL_MAX = 90;
const submitBuckets = new Map();
const pollBuckets = new Map();
function withinRateLimit(buckets, key, windowMs, max) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

function clientIp(req) {
  return req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Soft check: blocks nothing if there's no Origin header or nothing
// registered yet to compare against (rate limiting is the real defence -
// see the header comment). Only rejects when both are present and clearly
// don't match, so a customer's real site (with www/subdomain variations)
// is never accidentally locked out.
function isAllowedOrigin(origin, websiteUrl) {
  if (!origin || !websiteUrl) return true;
  try {
    const originHost = new URL(origin).hostname.replace(/^www\./, "");
    const siteHost = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, "");
    return originHost === siteHost || originHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${originHost}`);
  } catch {
    return true;
  }
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

// Fire-and-forget: Netlify invokes a *-background function asynchronously
// with an immediate 202, so this fetch resolving is just the hand-off, not
// the reply itself completing. Deliberately built from the inbound
// request's own host (never process.env.URL, which resolves to the site's
// production domain regardless of deploy context) so this enqueues against
// whichever deploy actually received the request - a preview/staging deploy
// included, not silently against production during verification.
async function enqueueReplyGeneration(payload, req) {
  const site = `https://${req.headers.get("host")}`;
  try {
    await fetch(`${site}/.netlify/functions/widget-reply-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[WIDGET] failed to enqueue background reply:", e.message);
  }
}

async function submitTenantMessage({ widgetKey, conversationId, message, origin, req }) {
  const tenantSlug = await getTenantSlugForWidgetKey(widgetKey);
  if (!tenantSlug) return { status: 404, error: "Unknown widget key" };

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment) {
    return { status: 200, immediate: "Give us just a moment - your Miia is still finishing setup." };
  }

  if (!isAllowedOrigin(origin, deployment.customValues?.website_url)) {
    return { status: 403, error: "This widget isn't authorised for this site." };
  }

  let conversation = conversationId ? await getWidgetConversation(conversationId) : null;
  if (!conversation || conversation.tenant !== tenantSlug) {
    conversation = await createWidgetConversation({ tenant: tenantSlug, kind: "tenant" });
  }

  // Both appended before this route returns - the customer's own message,
  // and a placeholder marking a reply as in flight, so a poll that lands
  // before the background function has even started still sees "pending"
  // rather than nothing.
  await appendWidgetMessage(conversation.id, { direction: "inbound", body: message });
  await appendWidgetMessage(conversation.id, { direction: "outbound", body: "", status: "pending" });

  await enqueueReplyGeneration({ kind: "tenant", tenantSlug, conversationId: conversation.id, message }, req);

  return { status: 200, conversationId: conversation.id };
}

async function submitPreviewMessage({ previewId, message, req }) {
  const session = await getPreviewSession(previewId);
  if (!session) return { status: 404, error: "This preview has expired - paste your website again to start a new one." };

  if (session.messageCount >= PREVIEW_MESSAGE_CAP) {
    return { status: 200, immediate: "That's the preview limit for now - hit \"Get started\" to keep going with your real Miia." };
  }
  if (session.messageCount >= PREVIEW_EMAIL_GATE_AT && !session.email) {
    return { status: 403, error: "email-required" };
  }

  await appendPreviewMessage(previewId, { direction: "inbound", body: message });
  await appendPreviewMessage(previewId, { direction: "outbound", body: "", status: "pending" });

  await enqueueReplyGeneration({ kind: "preview", previewId, message }, req);

  return { status: 200, conversationId: previewId };
}

export async function POST(req) {
  const origin = req.headers.get("origin");
  const ip = clientIp(req);
  const { widgetKey, previewId, conversationId, message } = await req.json().catch(() => ({}));

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Missing message" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!widgetKey && !previewId) {
    return NextResponse.json({ error: "Missing key or preview" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!withinRateLimit(submitBuckets, `${ip}:${widgetKey || previewId}`, SUBMIT_WINDOW_MS, SUBMIT_MAX)) {
    return NextResponse.json({ error: "Slow down a little and try again in a minute." }, { status: 429, headers: corsHeaders(origin) });
  }

  const result = widgetKey
    ? await submitTenantMessage({ widgetKey, conversationId, message: message.trim(), origin, req })
    : await submitPreviewMessage({ previewId, message: message.trim(), req });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: corsHeaders(origin) });
  }

  return NextResponse.json(
    { conversationId: result.conversationId, immediate: result.immediate || null },
    { status: 200, headers: { ...corsHeaders(origin), ...(result.conversationId ? { "X-Conversation-Id": result.conversationId } : {}) } }
  );
}

// Polling: the client already has whichever identifier it got back from
// POST (a tenant conversationId + its own widgetKey, or a previewId) and
// asks "is it done yet" every couple of seconds. Returns the LAST outbound
// message's status/body - only one reply is ever in flight per
// conversation at a time, so there's no ambiguity about which one a poll
// is asking about.
export async function GET(req) {
  const origin = req.headers.get("origin");
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const widgetKey = searchParams.get("widgetKey");
  const previewId = searchParams.get("previewId");
  const ip = clientIp(req);

  if (!conversationId && !previewId) {
    return NextResponse.json({ error: "Missing conversationId or previewId" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!withinRateLimit(pollBuckets, `${ip}:${widgetKey || previewId || conversationId}`, POLL_WINDOW_MS, POLL_MAX)) {
    return NextResponse.json({ error: "Slow down a little and try again in a minute." }, { status: 429, headers: corsHeaders(origin) });
  }

  let messages;
  if (previewId) {
    const session = await getPreviewSession(previewId);
    if (!session) return NextResponse.json({ error: "This preview has expired." }, { status: 404, headers: corsHeaders(origin) });
    messages = session.messages;
  } else {
    if (!widgetKey) return NextResponse.json({ error: "Missing widgetKey" }, { status: 400, headers: corsHeaders(origin) });
    const tenantSlug = await getTenantSlugForWidgetKey(widgetKey);
    const conversation = tenantSlug ? await getWidgetConversation(conversationId) : null;
    if (!conversation || conversation.tenant !== tenantSlug) {
      return NextResponse.json({ error: "Unknown conversation" }, { status: 404, headers: corsHeaders(origin) });
    }
    messages = conversation.messages;
  }

  const lastOutbound = [...messages].reverse().find((m) => m.direction === "outbound");
  if (!lastOutbound) {
    return NextResponse.json({ status: "pending", reply: null, actions: [] }, { status: 200, headers: corsHeaders(origin) });
  }
  return NextResponse.json(
    {
      status: lastOutbound.status || "complete",
      reply: lastOutbound.status === "pending" ? null : lastOutbound.body,
      actions: lastOutbound.status === "pending" ? [] : lastOutbound.actions || [],
    },
    { status: 200, headers: corsHeaders(origin) }
  );
}
