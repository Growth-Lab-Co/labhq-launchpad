import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getTenantSlugForWidgetKey } from "@/lib/widgetKeys";
import { listDeployments } from "@/lib/deployments";
import {
  createWidgetConversation,
  getWidgetConversation,
  appendWidgetMessage,
} from "@/lib/widgetConversations";
import {
  getPreviewSession,
  incrementPreviewMessageCount,
  appendPreviewMessage,
  PREVIEW_MESSAGE_CAP,
  PREVIEW_EMAIL_GATE_AT,
} from "@/lib/previewSessions";
import { streamReply, fileBookingRequestIfConfirmed } from "@/lib/bot";
import { streamClaude } from "@/lib/claude";

export const maxDuration = 60;
// Found during verification: without this, Next.js 14 can statically
// optimise/cache a route handler's output and Netlify's runtime buffers the
// whole response instead of streaming it as generated - a ~30s "everything
// arrives at once, or the proxy gives up first" delay instead of real
// token-by-token streaming, confirmed with a minimal diagnostic route
// (same behaviour, fixed the same way). Explicit here rather than relying
// on POST-implies-dynamic, since that alone didn't prevent the buffering.
export const dynamic = "force-dynamic";

// The in-house widget's message endpoint (job 1, 2026-07-29) - embedded on
// arbitrary customer domains via public/widget.js, so this is the one API
// route in the app that genuinely needs cross-origin handling, an origin
// check, and its own rate limit (everything else in the app is same-origin
// or admin/session-gated).

// Best-effort, in-memory, per-instance - resets on cold start, not shared
// across function instances. Enough to blunt a runaway embed or scripted
// abuse; not a distributed rate limiter. Keyed by IP + widget/preview id so
// one abusive site can't throttle every other tenant's widget.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const buckets = new Map();
function withinRateLimit(key) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

export async function OPTIONS(req) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

// Forwards every chunk to the client while persisting the full reply once
// generation finishes, via two independent branches of the same source
// stream (source.tee()) rather than one shared TransformStream.
//
// Root cause found 2026-07-30: a single shared TransformStream's flush()
// only fires once its readable side is fully drained - and that side is
// only drained by whatever reads the outer HTTP response. streamClaude's
// ReadableStream is pull-based, so on the connections where the platform's
// slow-to-formally-close behaviour (documented for months, never fully
// root-caused - visible text streams in 2-5s, raw Claude streaming
// independently timed at under 2s to first byte, but the underlying
// connection can take ~30s+ to formally close) stalls the client-facing
// read, the upstream pull() simply stops being called again - flush()
// never fires, and a reply that fully generated in seconds silently never
// gets persisted. tee()'s persist branch pulls from the underlying stream
// on its own schedule, independent of the client branch, so it drains and
// completes regardless of what the client connection does.
function tapStream(source, onDone) {
  const [toClient, toPersist] = source.tee();

  (async () => {
    const reader = toPersist.getReader();
    let full = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += value;
      }
      await onDone(full);
    } catch (e) {
      console.error("[WIDGET] post-stream persist failed:", e.message);
    }
  })();

  return toClient.pipeThrough(new TextEncoderStream());
}

async function handleTenantMessage({ widgetKey, conversationId, message, origin }) {
  const tenantSlug = await getTenantSlugForWidgetKey(widgetKey);
  if (!tenantSlug) return { status: 404, error: "Unknown widget key" };

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return { status: 404, error: "Unknown tenant" };

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment) {
    return { status: 200, notReady: true, text: "Give us just a moment - your Miia is still finishing setup." };
  }

  if (!isAllowedOrigin(origin, deployment.customValues?.website_url)) {
    return { status: 403, error: "This widget isn't authorised for this site." };
  }

  let conversation = conversationId ? await getWidgetConversation(conversationId) : null;
  if (!conversation || conversation.tenant !== tenantSlug) {
    conversation = await createWidgetConversation({ tenant: tenantSlug, kind: "tenant" });
  }

  const history = conversation.messages;

  // Persisted immediately, not deferred to the stream's flush() - a slow or
  // dropped connection on the reply side (see tapStream's own comment on
  // the ~30s formal-close characteristic) must never cost the customer
  // their own message too. Found 2026-07-30: a stalled reply left the
  // transcript panel completely empty because both messages used to wait
  // for the same flush() that never fired.
  await appendWidgetMessage(conversation.id, { direction: "inbound", body: message });

  const { stream } = await streamReply({ deployment, tenant, messages: history, inboundText: message });

  const tapped = tapStream(stream, async (fullReply) => {
    await appendWidgetMessage(conversation.id, { direction: "outbound", body: fullReply });
    await fileBookingRequestIfConfirmed({
      tenantSlug,
      businessName: deployment.businessName,
      deploymentId: deployment.id,
      tenantRecord: tenant,
      messages: history,
      inboundText: message,
      reply: fullReply,
    });
  });

  return { status: 200, stream: tapped, conversationId: conversation.id };
}

async function handlePreviewMessage({ previewId, message }) {
  const session = await getPreviewSession(previewId);
  if (!session) return { status: 404, error: "This preview has expired - paste your website again to start a new one." };

  if (session.messageCount >= PREVIEW_MESSAGE_CAP) {
    return { status: 200, notReady: true, text: "That's the preview limit for now - hit \"Get started\" to keep going with your real Miia." };
  }
  if (session.messageCount >= PREVIEW_EMAIL_GATE_AT && !session.email) {
    return { status: 403, error: "email-required" };
  }

  const system = `You are Miia, an AI front-desk assistant giving a live PREVIEW to the owner of "${session.businessName}", a business you looked at from their own website.
What you know about their business (scraped from their site, may be incomplete): ${session.servicesSummary || "not much - keep questions general"}.
This is a DEMO for the business owner, not a real customer conversation - be impressive, warm, and show how you'd handle a real enquiry for a business like theirs. Keep replies under 100 words. Australian English. If you don't know something specific, say how you'd normally ask the business for it, don't invent facts.`;

  const history = session.messages.map((m) => ({
    role: m.direction === "outbound" ? "assistant" : "user",
    content: m.body,
  }));

  const stream = await streamClaude({ system, messages: [...history, { role: "user", content: message }], maxTokens: 300 });

  const tapped = tapStream(stream, async (fullReply) => {
    await appendPreviewMessage(previewId, { direction: "inbound", body: message });
    await appendPreviewMessage(previewId, { direction: "outbound", body: fullReply });
    await incrementPreviewMessageCount(previewId);
  });

  return { status: 200, stream: tapped };
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
  if (!withinRateLimit(`${ip}:${widgetKey || previewId}`)) {
    return NextResponse.json({ error: "Slow down a little and try again in a minute." }, { status: 429, headers: corsHeaders(origin) });
  }

  const result = widgetKey
    ? await handleTenantMessage({ widgetKey, conversationId, message: message.trim(), origin })
    : await handlePreviewMessage({ previewId, message: message.trim() });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: corsHeaders(origin) });
  }
  if (result.notReady) {
    return NextResponse.json({ text: result.text }, { status: 200, headers: corsHeaders(origin) });
  }

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      ...(result.conversationId ? { "X-Conversation-Id": result.conversationId } : {}),
    },
  });
}
