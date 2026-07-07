// Marketplace OAuth for GHL's two Launchpad apps (agency + location).
// Connections are encrypted at rest in Netlify Blobs (store "ghl-connections")
// with LAUNCHPAD_MASTER_KEY. See DEPLOY.md "OAuth apps".

import { getStore } from "@netlify/blobs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const STORE_NAME = "ghl-connections";
const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const LOCATION_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/locationToken";
const API_VERSION = "2021-07-28";
const REFRESH_SKEW_MS = 60 * 1000; // refresh this long before actual expiry
const STATE_TTL_MS = 15 * 60 * 1000;

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function encryptionKey() {
  const secret = process.env.LAUNCHPAD_MASTER_KEY;
  if (!secret) throw new Error("LAUNCHPAD_MASTER_KEY is not set");
  return createHash("sha256").update(secret).digest();
}

function encrypt(obj) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(".");
}

function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

// ---- App credentials ----

const APPS = {
  agency: {
    clientId: () => process.env.GHL_AGENCY_APP_CLIENT_ID,
    clientSecret: () => process.env.GHL_AGENCY_APP_CLIENT_SECRET,
    installUrl: () => process.env.GHL_AGENCY_APP_INSTALL_URL,
  },
  location: {
    clientId: () => process.env.GHL_LOCATION_APP_CLIENT_ID,
    clientSecret: () => process.env.GHL_LOCATION_APP_CLIENT_SECRET,
    installUrl: () => process.env.GHL_LOCATION_APP_INSTALL_URL,
  },
};

function appOrThrow(app) {
  const cfg = APPS[app];
  if (!cfg) throw new Error(`Unknown app: ${app}`);
  return cfg;
}

export function appConfigured(app) {
  const cfg = APPS[app];
  return Boolean(cfg && cfg.clientId() && cfg.clientSecret() && cfg.installUrl());
}

// Install links copied from the Marketplace listing already carry the
// registered client_id + scope + redirect_uri - parse them apart so /start
// can reuse the exact redirect_uri GHL expects and /callback can build the
// token exchange to match it (must match byte-for-byte or GHL rejects it).
function parseInstallUrl(app) {
  const cfg = appOrThrow(app);
  const raw = cfg.installUrl();
  if (!raw) throw new Error(`${app} app install URL is not configured`);
  const url = new URL(raw);
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!redirectUri) throw new Error(`${app} app install URL has no redirect_uri param`);
  return { url, redirectUri };
}

export function getAppRedirectUri(app) {
  return parseInstallUrl(app).redirectUri;
}

// ---- State: HMAC-signed with the master key so a callback can't be forged
// to overwrite a different tenant's connection, plus a short TTL. ----

function signState(payload) {
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", encryptionKey()).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyState(state) {
  const [b64, sig] = String(state || "").split(".");
  if (!b64 || !sig) return null;
  const expected = createHmac("sha256", encryptionKey()).update(b64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload?.ts || Date.now() - payload.ts > STATE_TTL_MS) return null;
  return payload;
}

export function buildAuthorizeUrl({ app, tenant }) {
  const { url, redirectUri } = parseInstallUrl(app);
  const authorizeUrl = new URL(url.toString());
  authorizeUrl.searchParams.set("state", signState({ app, tenant, ts: Date.now() }));
  return { authorizeUrl: authorizeUrl.toString(), redirectUri };
}

// ---- Token exchange / refresh / location-token mint ----

async function postForm(url, params, extraHeaders = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Version: API_VERSION,
      ...extraHeaders,
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`GHL POST ${url} -> ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function exchangeCode({ app, code, redirectUri }) {
  const cfg = appOrThrow(app);
  return postForm(TOKEN_URL, {
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

async function refreshAccessToken({ app, refreshToken }) {
  const cfg = appOrThrow(app);
  return postForm(TOKEN_URL, {
    client_id: cfg.clientId(),
    client_secret: cfg.clientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// Documented workaround for marketplace apps too: mint a location-scoped
// token from a company-level (agency) OAuth token, same endpoint the legacy
// Private Integration fallback in lib/ghl.js uses.
async function mintLocationToken({ bearerToken, companyId, locationId }) {
  return postForm(
    LOCATION_TOKEN_URL,
    { companyId, locationId },
    { Authorization: `Bearer ${bearerToken}` }
  );
}

// ---- Connection storage ----

export function connectionKeyFor({ tenant, app, locationId }) {
  if (app === "agency") return `${tenant}:agency`;
  return locationId ? `${tenant}:location:${locationId}` : `${tenant}:location:company`;
}

function keyApp(key) {
  return key.endsWith(":agency") ? "agency" : "location";
}

export async function saveConnection(key, connection) {
  await store().set(key, encrypt(connection));
}

export async function getConnection(key) {
  const raw = await store().get(key);
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch (e) {
    console.error(`[oauth] failed to decrypt connection ${key}:`, e.message);
    return null;
  }
}

export async function storeTokenResponse({ tenant, app, tokenResponse }) {
  const locationId = tokenResponse.locationId || null;
  const key = connectionKeyFor({ tenant, app, locationId });
  const connection = {
    app,
    companyId: tokenResponse.companyId || null,
    locationId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || null,
    expiresAt: Date.now() + (tokenResponse.expires_in || 0) * 1000,
  };
  await saveConnection(key, connection);
  return { key, connection };
}

// Valid access token for a stored connection, refreshing first if it's near
// expiry. Returns null if there's no connection, or none we can still use.
export async function getValidToken(key) {
  const connection = await getConnection(key);
  if (!connection) return null;
  if (connection.expiresAt - REFRESH_SKEW_MS > Date.now()) return connection.accessToken;
  if (!connection.refreshToken) return null; // expired, nothing to refresh with

  try {
    const app = connection.app || keyApp(key);
    const refreshed = await refreshAccessToken({ app, refreshToken: connection.refreshToken });
    const updated = {
      ...connection,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || connection.refreshToken,
      expiresAt: Date.now() + (refreshed.expires_in || 0) * 1000,
    };
    await saveConnection(key, updated);
    return updated.accessToken;
  } catch (e) {
    console.error(`[oauth] token refresh failed for ${key}:`, e.status ?? "-", e.body ?? e.message);
    return null;
  }
}

// ---- High-level helpers used by lib/ghl.js ----

export async function getAgencyConnection(tenant) {
  const key = connectionKeyFor({ tenant, app: "agency" });
  const connection = await getConnection(key);
  if (!connection) return null;
  const token = await getValidToken(key);
  return token ? { token, companyId: connection.companyId } : null;
}

// Location-app token for one location. Tries, in order:
//   1) a connection authorised directly against this location
//   2) minting one from a company-level location-app connection
// Returns null if neither is available - caller logs [LOCATION-AUTH-NEEDED].
export async function getLocationAppToken({ tenant, locationId }) {
  const directKey = connectionKeyFor({ tenant, app: "location", locationId });
  const direct = await getValidToken(directKey);
  if (direct) return direct;

  const companyKey = connectionKeyFor({ tenant, app: "location" });
  const companyConnection = await getConnection(companyKey);
  if (!companyConnection?.companyId) return null;
  const companyToken = await getValidToken(companyKey);
  if (!companyToken) return null;

  try {
    const minted = await mintLocationToken({
      bearerToken: companyToken,
      companyId: companyConnection.companyId,
      locationId,
    });
    if (!minted?.access_token) throw new Error("locationToken response had no access_token");
    // Cache it under the direct key so repeat calls skip the mint round-trip
    // until it expires. No refresh_token comes back from this endpoint - once
    // it lapses getValidToken returns null and we just re-mint from here.
    await saveConnection(directKey, {
      app: "location",
      companyId: companyConnection.companyId,
      locationId,
      accessToken: minted.access_token,
      refreshToken: null,
      expiresAt: Date.now() + (minted.expires_in || 24 * 60 * 60) * 1000,
      mintedFromCompany: true,
    });
    return minted.access_token;
  } catch (e) {
    console.error(
      `[oauth] locationToken mint failed for ${tenant}:${locationId}:`,
      e.status ?? "-",
      e.body ?? e.message
    );
    return null;
  }
}
