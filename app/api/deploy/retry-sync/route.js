import { NextResponse } from "next/server";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { getDeployment, markLocationSynced } from "@/lib/deployments";
import { resolveLocationDataAuth, pushAllCustomValues, createContact, getForms } from "@/lib/ghl";
import { resolveMcAuth } from "@/lib/mcBridge";
import { logActivity } from "@/lib/activity";

// POST /api/deploy/retry-sync - re-attempts the location-app data push for a
// deployment that came back with locationAuthNeeded (see app/api/deploy).
// Mission Control's "Retry data sync" button hits this once the location app
// has been authorised for that sub-account.
export async function POST(req) {
  try {
    const { id, tenant: slug } = await req.json();
    if (!(await resolveMcAuth(req, slug))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const record = await getDeployment(id, slug);
    if (!record) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    if (!record.locationId) return NextResponse.json({ error: "Deployment has no location" }, { status: 400 });

    const legacyCreds = ghlCredsFor(tenant);
    const locationAuth = await resolveLocationDataAuth({
      tenantSlug: slug,
      locationId: record.locationId,
      legacyCreds,
    });
    if (!locationAuth.token) {
      return NextResponse.json(
        {
          ok: false,
          locationAuthNeeded: true,
          authorizeUrl: locationAuth.authorizeUrl,
          error: "Location app still isn't authorised for this sub-account.",
        },
        { status: 409 }
      );
    }

    const pushed = await pushAllCustomValues({
      token: locationAuth.token,
      companyId: legacyCreds.companyId,
      locationId: record.locationId,
      values: record.customValues || {},
    });
    const failures = pushed.filter((p) => !p.ok);

    let contactWarning = null;
    let contactCreated = record.contactCreated;
    if (!record.contactCreated) {
      const rawName = (record.contactName || "").trim();
      const [firstName, ...rest] = rawName.split(/\s+/).filter(Boolean);
      try {
        await createContact({
          token: locationAuth.token,
          locationId: record.locationId,
          firstName,
          lastName: rest.join(" "),
          tags: ["onboarding"],
        });
        contactCreated = true;
      } catch (e) {
        console.error(
          `[DEPLOY-FAIL] tenant=${slug} step=retrySync:createContact locationId=${record.locationId} status=${e.status ?? "-"}`,
          e.body ?? e.message
        );
        contactWarning = "Still couldn't create the onboarding contact automatically — add it manually in GHL.";
      }
    }

    let formEmbed = null;
    try {
      const forms = await getForms({ token: locationAuth.token, locationId: record.locationId });
      const form = forms[0];
      if (form?.id) {
        const formName = form.name || "Contact form";
        formEmbed = {
          formId: form.id,
          name: formName,
          snippet: `<script src="https://link.msgsndr.com/js/form_embed.js"></script>\n<iframe src="https://api.leadconnectorhq.com/widget/form/${form.id}" style="width:100%;height:600px;border:none;border-radius:4px" id="inline-${form.id}" data-form-id="${form.id}" title="${formName}"></iframe>`,
        };
      }
    } catch (e) {
      console.error(
        `[DEPLOY-FAIL] tenant=${slug} step=retrySync:getForms locationId=${record.locationId} status=${e.status ?? "-"}`,
        e.body ?? e.message
      );
    }

    const updated = await markLocationSynced(id, slug, {
      locationAuthNeeded: false,
      contactCreated,
    });

    await logActivity({
      tenant: slug,
      deploymentId: id,
      businessName: record.businessName,
      type: "setup",
      text: "Custom values synced",
    });

    return NextResponse.json({
      ok: true,
      pushed,
      warning: failures.length
        ? `${failures.length} custom value(s) failed to push - check GHL and re-add manually: ${failures
            .map((f) => f.name)
            .join(", ")}`
        : null,
      contactWarning,
      formEmbed,
      deployment: updated,
    });
  } catch (e) {
    console.error("[retry-sync] failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
