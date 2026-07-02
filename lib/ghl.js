// GoHighLevel API v2 client - the two calls Launchpad needs.
// Docs: https://highlevel.stoplight.io / https://marketplace.gohighlevel.com/docs
// NOTE: field names below follow GHL API v2 at time of writing. If a deploy
// fails with a 4xx, run `npm run test:ghl` and check the response body -
// the fix is almost always a payload field name. See DEPLOY.md "If GHL says no".

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

async function ghlFetch(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: headers(token) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = typeof body === "object" ? JSON.stringify(body).slice(0, 400) : text.slice(0, 400);
    throw new Error(`GHL ${options.method || "GET"} ${path} -> ${res.status}: ${msg}`);
  }
  return body;
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
  if (!id) throw new Error(`Sub-account created but no id in response: ${JSON.stringify(body).slice(0, 300)}`);
  return { id, raw: body };
}

// Push one custom value into a location.
export async function pushCustomValue({ token, locationId, name, value }) {
  return ghlFetch(token, `/locations/${locationId}/customValues`, {
    method: "POST",
    body: JSON.stringify({ name, value: String(value ?? "") }),
  });
}

export async function pushAllCustomValues({ token, locationId, values }) {
  const results = [];
  for (const [name, value] of Object.entries(values)) {
    try {
      await pushCustomValue({ token, locationId, name, value });
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }
  return results;
}
