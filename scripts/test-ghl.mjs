// Quick GHL API smoke test. Run BEFORE the demo:  npm run test:ghl
// Creates a throwaway sub-account "Launchpad Test - DELETE ME" from your snapshot
// and pushes one custom value. Delete it in GHL afterwards.
// Env comes from .env.local (Next convention) - we read it manually here.

import { readFileSync } from "node:fs";
import { getTenant, ghlCredsFor } from "../lib/tenants.js";

try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { console.log("(.env.local not found - using shell env)"); }

const BASE = "https://services.leadconnectorhq.com";
const { token, companyId, snapshotId, configured } = ghlCredsFor(getTenant("growthlab"));

if (!configured) {
  console.error("Missing GHL_AGENCY_TOKEN / GHL_COMPANY_ID / GHL_SNAPSHOT_ID in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
  Accept: "application/json",
};

console.log("1) Creating test sub-account from snapshot", snapshotId, "...");
let res = await fetch(`${BASE}/locations/`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    name: "Launchpad Test - DELETE ME",
    companyId,
    snapshotId,
    timezone: "Australia/Brisbane",
  }),
});
let body = await res.json().catch(() => ({}));
console.log("   status:", res.status);
console.log("   body:", JSON.stringify(body).slice(0, 500));
const locationId = body?.id || body?.location?.id || body?.locationId;
if (!res.ok || !locationId) {
  console.error("\nCreate failed. Most common fixes:\n - token must be an AGENCY-level Private Integration token\n - token needs locations write scope\n - snapshotId: use the ID from the snapshot share link\n - some accounts expect the field as snapshot: { id, type: 'own' } instead of snapshotId - try that variant in lib/ghl.js");
  process.exit(1);
}

console.log("\n2) Pushing a test custom value ...");
res = await fetch(`${BASE}/locations/${locationId}/customValues`, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: "business_name", value: "Launchpad Test Pty Ltd" }),
});
body = await res.json().catch(() => ({}));
console.log("   status:", res.status);
console.log("   body:", JSON.stringify(body).slice(0, 300));

console.log(`\nDone. Test sub-account id: ${locationId}`);
console.log("Now open GHL, confirm the snapshot cloned and the custom value exists, then DELETE the test sub-account.");
