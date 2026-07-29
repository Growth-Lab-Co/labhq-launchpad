"use client";

// Client-safe Meta Pixel helpers. META_PIXEL_ID is a plain (non-NEXT_PUBLIC)
// env var by request, so it's read server-side and passed down as a prop
// wherever the pixel needs to load - see components/miia/MetaPixel.jsx
// (marketing pages, base pixel + PageView on route change) and
// CheckoutSuccessPage.jsx (the one non-marketing page that fires a single
// Purchase event right before it redirects into the tenant app - the base
// pixel must never load past that redirect).
//
// ensureFbq is idempotent: safe to call from both places without double-
// injecting the script or double-firing fbq('init', ...).
let injected = false;

export function ensureFbq(pixelId) {
  if (typeof window === "undefined" || !pixelId || injected) return;
  if (window.fbq) {
    injected = true;
    return;
  }

  /* eslint-disable */
  (function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", pixelId);
  injected = true;
}

export function trackPageView() {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "PageView");
}

export function trackViewContent(params) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "ViewContent", params);
}

export function trackInitiateCheckout(params) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "InitiateCheckout", params);
}

export function trackLead(params) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "Lead", params);
}

export function trackPurchase(params) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "Purchase", params);
}
