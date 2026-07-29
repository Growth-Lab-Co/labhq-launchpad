"use client";

// First-touch UTM capture. Written once per browser (first landing wins -
// the standard attribution model, so a later organic visit doesn't steal
// credit from the ad click that actually brought them) into a plain cookie,
// read back at checkout time and threaded through to Stripe metadata and
// the tenant record - see app/api/miia/checkout/route.js onward.
const COOKIE_NAME = "miia_utm";
const COOKIE_DAYS = 90;

export function captureUtm() {
  if (typeof window === "undefined") return;
  if (readUtm()) return;

  const params = new URLSearchParams(window.location.search);
  const utm = {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
  };
  if (!utm.utmSource && !utm.utmMedium && !utm.utmCampaign) return;

  const expires = new Date(Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(utm))}; expires=${expires}; path=/; SameSite=Lax`;
}

export function readUtm() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
