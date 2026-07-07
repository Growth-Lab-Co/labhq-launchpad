// GoHighLevel API v2 client - the two calls Launchpad needs.
// Docs: https://highlevel.stoplight.io / https://marketplace.gohighlevel.com/docs
// NOTE: field names below follow GHL API v2 at time of writing. If a deploy
// fails with a 4xx, run `npm run test:ghl` and check the response body -
// the fix is almost always a payload field name. See DEPLOY.md "If GHL says no".

import { getAgencyConnection, getLocationAppToken } from "./ghlOAuth.js";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// Errors thrown here carry structured `.status` / `.body` / `.path` fields so
// callers can log full technical detail server-side without ever having to
// pass the raw GHL response text through a message string that might end up
// facing the user.
async function ghlFetch(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: headers(token) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`GHL ${options.method || "GET"} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = body;
    err.path = path;
    throw err;
  }
  return body;
}

// Two-key auth: which credentials to use for which call.
//
// Resolves auth for CREATING a sub-account: prefer the tenant's agency-app
// OAuth connection; otherwise fall back to the legacy Private Integration
// env token. The legacy path is proven - callers must still pass its token/
// companyId into createSubAccount() unchanged when this falls back to it.
export async function resolveSubAccountAuth(tenantSlug, legacyCreds) {
  const oauth = await getAgencyConnection(tenantSlug);
  if (oauth) return { token: oauth.token, companyId: oauth.companyId, source: "oauth" };
  if (legacyCreds?.token && legacyCreds?.companyId) {
    return { token: legacyCreds.token, companyId: legacyCreds.companyId, source: "legacy" };
  }
  return { token: null, companyId: null, source: null };
}

// Resolves auth for LOCATION DATA writes (custom values, contacts, forms):
// prefer a location-app token for this specific location. Falling back to
// the legacy agency PI token is only correct when there's no location-app
// OAuth setup for this tenant at all - if OAuth IS set up but this specific
// location was never individually authorised ("authorization-needed"), the
// legacy token is a dead end too (same scope limitation the OAuth apps
// exist to replace) and would just fail downstream with a confusing 401.
// In that case skip straight to [LOCATION-AUTH-NEEDED] so the deploy
// surfaces the real "authorise this location" action instead.
export async function resolveLocationDataAuth({ tenantSlug, locationId, legacyCreds }) {
  const { token: locationToken, reason } = await getLocationAppToken({ tenant: tenantSlug, locationId });
  if (locationToken) return { token: locationToken, source: "location-app" };

  if (reason === "authorization-needed") {
    console.error(
      `[LOCATION-AUTH-NEEDED] tenant=${tenantSlug} locationId=${locationId} (location app connected, but this location isn't authorised yet)`
    );
    return { token: null, source: null, authorizeUrl: `/api/oauth/start?app=location&tenant=${tenantSlug}` };
  }

  if (legacyCreds?.configured) {
    return { token: legacyCreds.token, source: "legacy" };
  }
  console.error(`[LOCATION-AUTH-NEEDED] tenant=${tenantSlug} locationId=${locationId}`);
  return { token: null, source: null, authorizeUrl: `/api/oauth/start?app=location&tenant=${tenantSlug}` };
}

// Create a sub-account (location) cloned from a snapshot.
export async function createSubAccount({ token, companyId, snapshotId, businessName, contact }) {
  const payload = {
    name: businessName,
    companyId,
    snapshotId,
    // Optional niceties - GHL accepts these on location create:
    ...(contact?.website ? { website: contact.website } : {}),
    ...(contact?.timezone ? { timezone: contact.timezone } : { timezone: "Australia/Brisbane" }),
  };
  const body = await ghlFetch(token, "/locations/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  // v2 returns the created location under different keys depending on endpoint version
  const id = body?.id || body?.location?.id || body?.locationId;
  if (!id) {
    const err = new Error("Sub-account created but response had no id");
    err.path = "/locations/";
    err.body = body;
    throw err;
  }
  return { id, raw: body };
}

// Push one custom value into a location.
export async function pushCustomValue({ token, locationId, name, value }) {
  return ghlFetch(token, `/locations/${locationId}/customValues`, {
    method: "POST",
    body: JSON.stringify({ name, value: String(value ?? "") }),
  });
}

// Exchange the agency token for a short-lived location-scoped token. Some
// agency Private Integrations can't have the Custom Values scope ticked at
// all in the GHL UI - this is GHL's own documented workaround: mint a
// location token from the agency token and use that instead for the calls
// the agency scope set won't cover.
async function getLocationToken({ agencyToken, companyId, locationId }) {
  const res = await fetch(`${BASE}/oauth/locationToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${agencyToken}`,
      Version: VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ companyId, locationId }).toString(),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok || !body?.access_token) {
    const err = new Error(`GHL POST /oauth/locationToken -> ${res.status}`);
    err.status = res.status;
    err.body = body;
    err.path = "/oauth/locationToken";
    throw err;
  }
  return body.access_token;
}

export async function pushAllCustomValues({ token, companyId, locationId, values }) {
  let activeToken = token;
  let exchangeAttempted = false;
  const results = [];

  for (const [name, value] of Object.entries(values)) {
    try {
      await pushCustomValue({ token: activeToken, locationId, name, value });
      results.push({ name, ok: true });
      continue;
    } catch (e) {
      // Only the agency token gets the scope error - a fresh location token
      // shouldn't. Try the exchange once; if it works, every remaining value
      // in this batch reuses the minted location token from here on.
      if (e.status === 401 && !exchangeAttempted) {
        exchangeAttempted = true;
        try {
          activeToken = await getLocationToken({ agencyToken: token, companyId, locationId });
          await pushCustomValue({ token: activeToken, locationId, name, value });
          results.push({ name, ok: true });
          continue;
        } catch (e2) {
          console.error(
            `[DEPLOY-FAIL] step=locationTokenExchange locationId=${locationId} status=${e2.status ?? "-"}`,
            e2.body ?? e2.message
          );
        }
      }
      console.error(
        `[DEPLOY-FAIL] step=pushCustomValue name=${name} locationId=${locationId} status=${e.status ?? "-"}`,
        e.body ?? e.message
      );
      results.push({ name, ok: false });
    }
  }
  return results;
}

// Create a contact in the new sub-account, tagged so the snapshot's Go-Live
// workflow (trigger: contact tagged "onboarding") fires automatically.
export async function createContact({ token, locationId, firstName, lastName, tags = [] }) {
  const payload = {
    locationId,
    firstName: firstName || "New",
    lastName: lastName || "Client",
    tags,
  };
  const body = await ghlFetch(token, "/contacts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const id = body?.contact?.id || body?.id;
  if (!id) {
    const err = new Error("Contact created but response had no id");
    err.path = "/contacts/";
    err.body = body;
    throw err;
  }
  return { id, raw: body };
}

// List a location's forms - used to offer an embed snippet on the success screen.
export async function getForms({ token, locationId }) {
  const body = await ghlFetch(token, `/forms/?locationId=${locationId}`, { method: "GET" });
  return body?.forms || [];
}
