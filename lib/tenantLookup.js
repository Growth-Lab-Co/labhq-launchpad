// GHL Marketplace webhooks only carry a locationId, never a tenant slug, and
// ghl-connections (lib/ghlOAuth.js) is keyed tenant-first - there's no
// existing locationId -> tenant index anywhere in the app. This resolves one
// by scanning deployments (which store both) and caches the result so the
// scan only happens once per location.

import { listDeployments } from "./deployments.js";
import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "location-tenant-index";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

export async function resolveTenantForLocation(locationId) {
  try {
    const cached = await store().get(locationId);
    if (cached) return cached;
  } catch (e) {
    console.error("[CONVO-BOT] location-tenant-index read failed:", e.message);
  }

  const deployments = await listDeployments();
  const match = deployments.find((d) => d.locationId === locationId);
  if (!match) return null;

  try {
    await store().set(locationId, match.tenant);
  } catch (e) {
    console.error("[CONVO-BOT] location-tenant-index write failed:", e.message);
  }
  return match.tenant;
}
