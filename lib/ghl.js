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

// List a location's existing custom values - used to decide create vs
// update. Snapshot clones commonly pre-seed the same keys we push (e.g.
// business_name), so blindly creating 400s with "already exists".
export async function getCustomValues({ token, locationId }) {
  const body = await ghlFetch(token, `/locations/${locationId}/customValues`, { method: "GET" });
  return body?.customValues || [];
}

// Push one custom value into a location - updates it in place if
// existingId is given (the key already exists on this location), creates
// it otherwise.
export async function pushCustomValue({ token, locationId, name, value, existingId }) {
  if (existingId) {
    return ghlFetch(token, `/locations/${locationId}/customValues/${existingId}`, {
      method: "PUT",
      body: JSON.stringify({ name, value: String(value ?? "") }),
    });
  }
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

  // Look up existing keys once up front so each push below can decide
  // create vs update. A failure here isn't fatal - it just means every push
  // falls through to create, which still works for genuinely-new keys.
  let existingByName = {};
  try {
    const existing = await getCustomValues({ token: activeToken, locationId });
    existingByName = Object.fromEntries(existing.map((cv) => [cv.name, cv.id]));
  } catch (e) {
    console.error(
      `[DEPLOY-FAIL] step=getCustomValues locationId=${locationId} status=${e.status ?? "-"}`,
      e.body ?? e.message
    );
  }

  for (const [name, value] of Object.entries(values)) {
    const existingId = existingByName[name];
    try {
      await pushCustomValue({ token: activeToken, locationId, name, value, existingId });
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
          await pushCustomValue({ token: activeToken, locationId, name, value, existingId });
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

// List an agency's snapshots - used by the portal onboarding wizard to
// validate a pasted-in snapshot id against the agency's own account before
// saving it (agency app already carries the snapshots.readonly scope, see
// lib/ghlOAuth.js APPS.agency.scopes). Response shape follows GHL API v2 at
// time of writing - if this 4xxs, check the response body per the file
// header note above and adjust the field names.
export async function listSnapshots({ token, companyId }) {
  const body = await ghlFetch(token, `/snapshots/?companyId=${companyId}`, { method: "GET" });
  return body?.snapshots || [];
}

// ---- Conversations (used by the AI conversation bot, lib/bot.js) ----
// Requires the location app's conversations.readonly / conversations.write /
// conversations/message.readonly / conversations/message.write scopes - see
// lib/ghlOAuth.js APPS.location.scopes. A 401 here on an already-authorised
// location almost always means that location was authorised before these
// scopes were added and needs re-authorising via "Authorise data sync".

export async function getConversation({ token, conversationId }) {
  return ghlFetch(token, `/conversations/${conversationId}`, { method: "GET" });
}

// Newest-first, regardless of the order the API itself returns them in.
export async function listMessages({ token, conversationId, limit = 10 }) {
  const body = await ghlFetch(token, `/conversations/${conversationId}/messages?limit=${limit}`, {
    method: "GET",
  });
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return messages
    .slice()
    .sort((a, b) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime());
}

export async function sendMessage({ token, type, contactId, conversationId, message }) {
  return ghlFetch(token, "/conversations/messages", {
    method: "POST",
    body: JSON.stringify({ type, contactId, conversationId, message }),
  });
}

// Conversations list + calendar events, added for the Miia customer
// dashboard (app/[tenant]/dashboard). Callers should treat both as
// best-effort - wrap in try/catch and fall back to an empty list/designed
// empty state rather than let a location with no calendar connected, or a
// GHL API shape drift, break the page (see the honesty rules in the
// dashboard commit message: no raw errors, no blank panels).

// Newest-first. GHL's /conversations/search returns the most recent
// conversations for a location; `query` narrows by contact name/phone/email
// (used by the dashboard's client-side search re-querying server-side for
// the Conversations page, not just filtering the current page of results).
export async function listConversations({ token, locationId, limit = 20, query }) {
  const params = new URLSearchParams({ locationId, limit: String(limit), sort: "desc" });
  if (query) params.set("query", query);
  const body = await ghlFetch(token, `/conversations/search?${params.toString()}`, { method: "GET" });
  return Array.isArray(body?.conversations) ? body.conversations : [];
}

// startMs/endMs are unix milliseconds - GHL's calendar events endpoint
// requires both. Returns events across every calendar on the location
// (omitting calendarId/userId narrows to none in particular).
export async function listCalendarEvents({ token, locationId, startMs, endMs }) {
  const params = new URLSearchParams({
    locationId,
    startTime: String(startMs),
    endTime: String(endMs),
  });
  const body = await ghlFetch(token, `/calendars/events?${params.toString()}`, { method: "GET" });
  return Array.isArray(body?.events) ? body.events : [];
}

// Tags a contact (e.g. "bot-handoff") without removing existing tags -
// used to flag a conversation for a human in GHL when the bot hands off.
export async function addContactTags({ token, contactId, tags }) {
  return ghlFetch(token, `/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
}
