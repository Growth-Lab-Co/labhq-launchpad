// Per-tenant branding overrides (favicon + logo), backed by Netlify Blobs.
// Absence of a record just means "use the site default" - nothing to
// configure before launch.
//
// Each of faviconUrl/logoUrl is either an external URL (pasted in) or a
// path into our own asset store (uploaded directly - see
// getBrandingAsset/setBrandingAsset), so consumers don't need to care which.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "branding";
const ASSET_STORE_NAME = "branding-assets";

export const ASSET_TYPES = ["favicon", "logo"];
export const MAX_ASSET_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_ASSET_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function assetStore() {
  return blobStore({ name: ASSET_STORE_NAME, consistency: "strong" });
}

function assetKey(tenant, type) {
  return `${tenant}:${type}`;
}

export const DEFAULT_ACCENT = "#7C4DFF";

export async function getBranding(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return { faviconUrl: null, logoUrl: null, accent: null, welcomeMessage: null, ...record };
}

export async function setBrandingUrls(tenant, { faviconUrl, logoUrl } = {}) {
  const current = await getBranding(tenant);
  const next = {
    ...current,
    ...(faviconUrl !== undefined ? { faviconUrl: faviconUrl || null } : {}),
    ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
    updatedAt: new Date().toISOString(),
  };
  await store().setJSON(tenant, next);
  return next;
}

// Accent colour + welcome message - set together from the Branding page's
// save bar. Distinct from setBrandingUrls (which saves immediately per
// upload) since these two are edited freeform and saved explicitly.
export async function setBrandingFields(tenant, { accent, welcomeMessage } = {}) {
  const current = await getBranding(tenant);
  const next = {
    ...current,
    ...(accent !== undefined ? { accent: accent || null } : {}),
    ...(welcomeMessage !== undefined ? { welcomeMessage: welcomeMessage || null } : {}),
    updatedAt: new Date().toISOString(),
  };
  await store().setJSON(tenant, next);
  return next;
}

export async function getBrandingAsset(tenant, type) {
  const key = assetKey(tenant, type);
  const meta = await assetStore().getMetadata(key);
  if (!meta) return null;
  const data = await assetStore().get(key, { type: "arrayBuffer" });
  return { data, contentType: meta.metadata?.contentType || "application/octet-stream" };
}

// Stores the uploaded file's bytes and points the tenant's branding record
// at the asset-serving route, so faviconUrl/logoUrl always just work as a
// plain URL regardless of whether it came from an upload or a pasted link.
export async function setBrandingAsset(tenant, type, file) {
  const key = assetKey(tenant, type);
  await assetStore().set(key, file, { metadata: { contentType: file.type } });
  const url = `/api/branding/asset?tenant=${encodeURIComponent(tenant)}&type=${type}&v=${Date.now()}`;
  return setBrandingUrls(tenant, { [type === "favicon" ? "faviconUrl" : "logoUrl"]: url });
}

export async function deleteBranding(tenant) {
  await store().delete(tenant);
  await Promise.all(ASSET_TYPES.map((type) => assetStore().delete(assetKey(tenant, type))));
}
