import { NextResponse } from "next/server";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import {
  createSubAccount,
  pushAllCustomValues,
  pushCustomValue,
  getCustomValues,
  createContact,
  getForms,
  resolveSubAccountAuth,
  resolveLocationDataAuth,
} from "@/lib/ghl";
import { getAgencyConnection } from "@/lib/ghlOAuth";

// TEMPORARY - exercises the OAuth chain (agency + location app connections)
// server-side, where real Netlify Blobs context exists. scripts/test-ghl.mjs
// can't do this when run locally via plain `node` (no Blobs credentials
// outside a deployed Function), so this mirrors that script's "OAuth chain
// mode" as an authenticated route instead. Remove once the OAuth path is
// confirmed working - it creates a real throwaway sub-account each call.
//
// POST /api/test-deploy
// Header: x-mc-key: <MC_PASSWORD>
// Body (optional JSON): { "tenant": "growthlab", "locationId": "<existing location>" }
//   - Without locationId: creates a fresh throwaway sub-account and runs the
//     full chain (same as scripts/test-ghl.mjs's "OAuth chain mode").
//   - With locationId: skips creation and runs the same location_app_auth ->
//     push_custom_value -> create_contact -> read_forms chain against that
//     existing location - i.e. the same logic /api/deploy/retry-sync uses,
//     without needing a deployments store record for it.

async function step(name, fn) {
  try {
    const result = await fn();
    return { step: name, ok: true, result };
  } catch (e) {
    return { step: name, ok: false, status: e.status ?? null, body: e.body ?? e.message ?? null };
  }
}

export async function POST(req) {
  const key = req.headers.get("x-mc-key");
  if (!process.env.MC_PASSWORD || key !== process.env.MC_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let tenantSlug = "growthlab";
  let existingLocationId = null;
  try {
    const body = await req.json();
    if (body?.tenant) tenantSlug = body.tenant;
    if (body?.locationId) existingLocationId = body.locationId;
  } catch {
    // no/invalid JSON body - use default tenant
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: `Unknown tenant: ${tenantSlug}` }, { status: 404 });
  }

  const oauthConnection = await getAgencyConnection(tenantSlug).catch(() => null);
  if (!oauthConnection) {
    return NextResponse.json({
      tenant: tenantSlug,
      mode: "oauth",
      ok: false,
      error: `No agency-app OAuth connection for ${tenantSlug}. Connect via /api/oauth/start?app=agency&tenant=${tenantSlug} first.`,
    });
  }

  const legacyCreds = ghlCredsFor(tenant);
  if (!legacyCreds.snapshotId) {
    return NextResponse.json({
      tenant: tenantSlug,
      mode: "oauth",
      ok: false,
      error: "Missing GHL_SNAPSHOT_ID - still required in OAuth mode (it's config, not auth).",
    });
  }

  const agencyAuth = await resolveSubAccountAuth(tenantSlug, legacyCreds);
  const steps = [];
  let locationId = existingLocationId;
  let proceedToAuth = Boolean(existingLocationId);

  if (!existingLocationId) {
    const created = await step("create_sub_account", async () => {
      const { id } = await createSubAccount({
        token: agencyAuth.token,
        companyId: agencyAuth.companyId,
        snapshotId: legacyCreds.snapshotId,
        businessName: "Launchpad Test - DELETE ME",
      });
      locationId = id;
      return { locationId: id, authSource: agencyAuth.source };
    });
    steps.push(created);
    proceedToAuth = created.ok;
  }

  if (proceedToAuth) {
    let locationToken = null;
    const authed = await step("location_app_auth", async () => {
      const locationAuth = await resolveLocationDataAuth({ tenantSlug, locationId, legacyCreds });
      if (!locationAuth.token) throw new Error("No location-app token available (LOCATION-AUTH-NEEDED)");
      locationToken = locationAuth.token;
      return { source: locationAuth.source };
    });
    steps.push(authed);

    if (authed.ok) {
      // Diagnostic: call the single-value push directly so a failure's real
      // status/body surfaces here, instead of pushAllCustomValues's swallow-
      // to-boolean behaviour (it's built for the real deploy flow, where the
      // detail goes to console.error instead).
      steps.push(
        await step("push_custom_value_raw", async () => {
          const existing = await getCustomValues({ token: locationToken, locationId });
          const match = existing.find((cv) => cv.name === "business_name");
          return await pushCustomValue({
            token: locationToken,
            locationId,
            name: "business_name",
            value: "Launchpad Test Pty Ltd",
            existingId: match?.id,
          });
        })
      );

      steps.push(
        await step("push_custom_value", async () => {
          const pushed = await pushAllCustomValues({
            token: locationToken,
            companyId: agencyAuth.companyId,
            locationId,
            values: { business_name: "Launchpad Test Pty Ltd" },
          });
          const failed = pushed.filter((p) => !p.ok);
          if (failed.length) throw new Error(`push failed: ${JSON.stringify(failed)}`);
          return pushed;
        })
      );

      steps.push(
        await step("create_contact", async () => {
          const { id } = await createContact({
            token: locationToken,
            locationId,
            firstName: "Launchpad",
            lastName: "Test",
            tags: ["onboarding"],
          });
          return { contactId: id };
        })
      );

      steps.push(
        await step("read_forms", async () => {
          const forms = await getForms({ token: locationToken, locationId });
          return { formCount: forms.length };
        })
      );
    }
  }

  const ok = steps.every((s) => s.ok);
  return NextResponse.json({
    tenant: tenantSlug,
    mode: "oauth",
    ok,
    locationId,
    steps,
    note: locationId ? `Delete test sub-account ${locationId} in GHL when done.` : null,
  });
}
