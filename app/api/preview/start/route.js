import { NextResponse } from "next/server";
import { scrapeWebsiteBasics } from "@/lib/scrape";
import { createPreviewSession } from "@/lib/previewSessions";
import { askClaude, extractJson } from "@/lib/claude";

export const maxDuration = 30;

// Rate limit only - no auth, this is a public marketing-site feature.
// Same in-memory pattern as app/api/chat/route.js.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const buckets = new Map();
function withinRateLimit(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

export async function POST(req) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!withinRateLimit(ip)) {
    return NextResponse.json({ error: "Too many previews started - try again in a minute." }, { status: 429 });
  }

  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Paste your website address first." }, { status: 400 });
  }

  let scraped;
  try {
    scraped = await scrapeWebsiteBasics(url);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  let businessName = scraped.businessName;
  let servicesSummary = "";
  let toneHint = "";

  if (scraped.bodyText || scraped.metaDescription) {
    try {
      const system = `Given this website's title, meta description and visible text, produce a short JSON summary for a demo AI receptionist. Never invent facts not implied by the text.
Respond ONLY with JSON: {"businessName": "<clean business name, or null>", "servicesSummary": "<1-2 sentences on what they do>", "toneHint": "<1 short phrase on the site's tone, e.g. 'warm and casual' or 'clinical and precise'>"}`;
      const raw = await askClaude({
        system,
        messages: [
          {
            role: "user",
            content: `Title/name guess: ${scraped.businessName || "unknown"}\nMeta description: ${scraped.metaDescription || "none"}\nPage text sample: ${scraped.bodyText.slice(0, 2000)}`,
          },
        ],
        maxTokens: 300,
      });
      const parsed = extractJson(raw);
      businessName = parsed.businessName || businessName;
      servicesSummary = parsed.servicesSummary || "";
      toneHint = parsed.toneHint || "";
    } catch (e) {
      console.error("[PREVIEW-START] summary generation failed, using raw scrape only:", e.message);
    }
  }

  const session = await createPreviewSession({
    url,
    businessName: businessName || "your business",
    servicesSummary,
    toneHint,
  });

  return NextResponse.json({ previewId: session.id, businessName: session.businessName });
}
