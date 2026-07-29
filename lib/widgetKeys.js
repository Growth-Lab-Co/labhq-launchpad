// Reverse lookup: widget public key -> tenant slug, backed by Netlify Blobs.
// The widget loader (public/widget.js) only ever sends its public key, never
// the tenant slug, so incoming widget-API requests need this index to
// resolve which tenant a key belongs to. Public keys are safe to expose
// client-side (same trust model as a Stripe publishable key) - they only
// ever identify which tenant's bot to talk to, never authenticate as that
// tenant for anything privileged (see lib/integrations/credentials.js for
// where real secrets live).

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "widget-keys";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

export async function saveWidgetKeyMapping(widgetKey, tenantSlug) {
  await store().setJSON(widgetKey, { tenantSlug });
}

export async function getTenantSlugForWidgetKey(widgetKey) {
  if (!widgetKey) return null;
  const record = await store().get(widgetKey, { type: "json" });
  return record?.tenantSlug || null;
}

export async function deleteWidgetKeyMapping(widgetKey) {
  if (!widgetKey) return;
  await store().delete(widgetKey);
}
