// Quick GHL API smoke test. Run BEFORE the demo:  npm run test:ghl
// Creates a throwaway sub-account "Launchpad Test - DELETE ME" and pushes a
// test custom value, contact, and reads forms. Delete the sub-account in GHL
// afterwards.
//
// Two modes, auto-selected for the "growthlab" tenant:
//  - OAuth chain mode: if an agency-app OAuth connection exists (connect it
//    first via /api/oauth/start?app=agency&tenant=growthlab), runs the full
//    create -> location auth -> push value -> contact -> forms chain through
//    the marketplace apps.
//  - Legacy mode (fallback): uses the Private Integration env token path,
//    same as before OAuth existed.
//
// Env comes from .env.local (Next convention) - we read it manually here.

import { readFileSync } from "node:fs";
import { getTenant, ghlCredsFor } from "../lib/tenants.js";
import {
  createSubAccount,
  pushAllCustomValues,
  createContact,
  getForms,
  resolveSubAccountAuth,
  resolveLocationDataAuth,
} from "../lib/ghl.js";
import { getAgencyConnection } from "../lib/ghlOAuth.js";

try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.log("(.env.local not found - using shell env)");
}

async function step(name, fn) {
  try {
    const result = await fn();
    const summary = result && typeof result === "object" ? JSON.stringify(result).slice(0, 200) : result;
    console.log(`PASS  ${name}${summary ? `  -> ${summary}` : ""}`);
    return { ok: true, result };
  } catch (e) {
    console.log(`FAIL  ${name}  status=${e.status ?? "-"}`);
    console.log("      body:", JSON.stringify(e.body ?? e.message).slice(0, 500));
    return { ok: false, error: e };
  }
}

const tenant = getTenant("growthlab");
const legacyCreds = ghlCredsFor(tenant);

let oauthConnection = null;
try {
  oauthConnection = await getAgencyConnection("growthlab");
} catch (e) {
  console.log(
    `(couldn't check OAuth connections - Netlify Blobs needs a Netlify context (try "netlify dev"): ${e.message})`
  );
}

if (oauthConnection) {
  console.log("\n=== OAuth chain mode: growthlab has an agency-app connection ===\n");

  if (!legacyCreds.snapshotId) {
    console.error("Missing GHL_SNAPSHOT_ID in .env.local - still required in OAuth mode (it's config, not auth).");
    process.exit(1);
  }

  const agencyAuth = await resolveSubAccountAuth("growthlab", legacyCreds);
  let locationId = null;

  const created = await step("1) Create test sub-account (agency OAuth token)", async () => {
    const { id } = await createSubAccount({
      token: agencyAuth.token,
      companyId: agencyAuth.companyId,
      snapshotId: legacyCreds.snapshotId,
      businessName: "Launchpad Test - DELETE ME",
    });
    locationId = id;
    return { locationId: id };
  });

  if (created.ok) {
    let locationToken = null;
    const authed = await step("2) Obtain location-app auth for the new location", async () => {
      const locationAuth = await resolveLocationDataAuth({ tenantSlug: "growthlab", locationId, legacyCreds });
      if (!locationAuth.token) throw new Error("No location-app token available (LOCATION-AUTH-NEEDED)");
      locationToken = locationAuth.token;
      return { source: locationAuth.source };
    });

    if (authed.ok) {
      await step("3) Push a test custom value", async () => {
        const pushed = await pushAllCustomValues({
          token: locationToken,
          companyId: agencyAuth.companyId,
          locationId,
          values: { business_name: "Launchpad Test Pty Ltd" },
        });
        const failed = pushed.filter((p) => !p.ok);
        if (failed.length) throw new Error(`push failed: ${JSON.stringify(failed)}`);
        return pushed;
      });

      await step("4) Create a test contact", async () => {
        const { id } = await createContact({
          token: locationToken,
          locationId,
          firstName: "Launchpad",
          lastName: "Test",
          tags: ["onboarding"],
        });
        return { contactId: id };
      });

      await step("5) Read forms", async () => {
        const forms = await getForms({ token: locationToken, locationId });
        return { formCount: forms.length };
      });
    } else {
      console.log(
        '      -> connect the location app for this sub-account: /api/oauth/start?app=location&tenant=growthlab'
      );
    }

    console.log(`\nTest sub-account id: ${locationId} - delete it in GHL when done.`);
  } else {
    process.exit(1);
  }
} else {
  console.log("\n=== Legacy Private Integration token mode (no OAuth connection for growthlab) ===\n");

  if (!legacyCreds.configured) {
    console.error(
      "Missing GHL_AGENCY_TOKEN / GHL_COMPANY_ID / GHL_SNAPSHOT_ID in .env.local, and no OAuth connection found."
    );
    process.exit(1);
  }

  let locationId = null;
  const created = await step("1) Create test sub-account from snapshot", async () => {
    const { id } = await createSubAccount({
      token: legacyCreds.token,
      companyId: legacyCreds.companyId,
      snapshotId: legacyCreds.snapshotId,
      businessName: "Launchpad Test - DELETE ME",
    });
    locationId = id;
    return { locationId: id };
  });

  if (!created.ok) {
    console.error(
      "\nCreate failed. Most common fixes:\n - token must be an AGENCY-level Private Integration token\n - token needs locations write scope\n - snapshotId: use the ID from the snapshot share link\n - some accounts expect the field as snapshot: { id, type: 'own' } instead of snapshotId - try that variant in lib/ghl.js"
    );
    process.exit(1);
  }

  await step("2) Push a test custom value (with location-token fallback)", async () => {
    const pushed = await pushAllCustomValues({
      token: legacyCreds.token,
      companyId: legacyCreds.companyId,
      locationId,
      values: { business_name: "Launchpad Test Pty Ltd" },
    });
    const failed = pushed.filter((p) => !p.ok);
    if (failed.length) throw new Error(`push failed: ${JSON.stringify(failed)}`);
    return pushed;
  });

  console.log(`\nTest sub-account id: ${locationId} - delete it in GHL when done.`);
}

console.log("\nDone. Open GHL, confirm the sub-account + custom value/contact, then DELETE the test sub-account.");
