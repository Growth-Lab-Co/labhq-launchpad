import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getTenantSlugForWidgetKey } from "@/lib/widgetKeys";
import { getPreviewSession, PREVIEW_MESSAGE_CAP, PREVIEW_EMAIL_GATE_AT } from "@/lib/previewSessions";

// Public, unauthenticated branding lookup for the widget loader
// (public/widget.js) - called from arbitrary customer domains before the
// first message, so the header/colours are right immediately. Nothing
// sensitive here (name, colour, welcome line), so CORS is wide open -
// the message endpoint (app/api/widget/message/route.js) is where the
// origin check and rate limiting that actually matter live.
function withCors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req) {
  const widgetKey = req.nextUrl.searchParams.get("key");
  const previewId = req.nextUrl.searchParams.get("preview");

  if (previewId) {
    const session = await getPreviewSession(previewId);
    if (!session) {
      return withCors(NextResponse.json({ error: "This preview has expired - paste your website again to start a new one." }, { status: 404 }));
    }
    return withCors(
      NextResponse.json({
        mode: "preview",
        businessName: session.businessName,
        assistantName: "Miia",
        accent: "#A070F8",
        accentSoft: "#9878F0",
        welcome: `Hi, I had a quick look at ${session.businessName}. I'm Miia - ask me anything a customer of yours might, and I'll show you how I'd handle it.`,
        messageCount: session.messageCount,
        cap: PREVIEW_MESSAGE_CAP,
        emailGateAt: PREVIEW_EMAIL_GATE_AT,
        emailCaptured: Boolean(session.email),
      })
    );
  }

  if (widgetKey) {
    const slug = await getTenantSlugForWidgetKey(widgetKey);
    const tenant = slug ? await getTenant(slug) : null;
    if (!tenant) return withCors(NextResponse.json({ error: "Unknown widget key" }, { status: 404 }));
    return withCors(
      NextResponse.json({
        mode: "tenant",
        businessName: tenant.name,
        assistantName: tenant.assistantName,
        accent: tenant.accent,
        accentSoft: tenant.accentSoft,
        welcome: `Hi, I'm ${tenant.assistantName}. How can I help?`,
      })
    );
  }

  return withCors(NextResponse.json({ error: "Missing key or preview" }, { status: 400 }));
}
