// Minimal, dependency-free "scrape basics" for the Meet Miia preview -
// fetches the page, strips markup with regex (no cheerio/jsdom in this
// project, and a full HTML parser is overkill for "grab the title, meta
// description and some visible text"), then asks Claude to turn that into
// a short business summary. Best-effort throughout - a scrape failure
// falls back to a generic preview rather than blocking the feature.

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 500_000;
const MAX_TEXT_SAMPLE = 4000;

function isSafeUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  // Basic SSRF guard - block obvious internal/loopback targets. Not
  // exhaustive (a determined attacker has other tricks), but this is a
  // low-stakes, unauthenticated, rate-limited preview feature, not a
  // security-critical fetcher - see app/api/preview/start/route.js for the
  // rate limit that's the real defence here.
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
  return url.toString();
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Miia preview bot (hello@growthlabco.com.au)" },
    });
    if (!res.ok) throw new Error(`Site responded ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

// Returns { businessName, servicesSummary, toneHint } - every field a best
// guess, never invented beyond what's on the page. Throws only if the URL
// itself is unsafe/malformed; a fetch/parse failure returns a minimal
// fallback object instead, since "couldn't fully read the site" shouldn't
// block the preview from starting.
export async function scrapeWebsiteBasics(rawUrl) {
  const url = isSafeUrl(rawUrl);
  if (!url) throw new Error("That doesn't look like a public website address.");

  try {
    const html = await fetchHtml(url);
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    const descMatch = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html);
    const bodyText = stripHtml(html).slice(0, MAX_TEXT_SAMPLE);

    return {
      businessName: (titleMatch?.[1] || "").trim().slice(0, 120) || null,
      metaDescription: (descMatch?.[1] || "").trim().slice(0, 300) || null,
      bodyText,
    };
  } catch (e) {
    console.error(`[SCRAPE] failed for ${url}:`, e.message);
    return { businessName: null, metaDescription: null, bodyText: "" };
  }
}
