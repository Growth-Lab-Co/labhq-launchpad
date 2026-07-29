// The actual "create a GHL sub-account from the snapshot and push custom
// values into it" work, extracted out of app/api/deploy/route.js (job 2a,
// 2026-07-29) so it can run two ways with identical logic:
//   - synchronously, inline in the deploy request (Everywhere and agency
//     tenants - unchanged behaviour from before this extraction)
//   - in the background, after an instant success response has already
//     gone to the customer (Miia Chat tier only - see
//     netlify/functions/ghl-provision-background.mjs)
// This file does not decide WHEN to run - callers do. It just does the work
// and returns/throws the same way regardless of caller.

import {
  createSubAccount,
  pushAllCustomValues,
  createContact,
  getForms,
  resolveSubAccountAuth,
  resolveLocationDataAuth,
} from "./ghl.js";
import { getActiveSnapshotId } from "./snapshotTemplates.js";
import { ghlCredsFor } from "./tenants.js";

// Returns { demo: true, locationId } for a tenant with no usable GHL auth
// configured yet, or { demo: false, locationId, pushed, failures,
// contactWarning, contactCreated, formEmbed, locationAuthNeeded,
// authorizeUrl } for a real provision. Throws only on a hard failure
// (sub-account creation itself failing) - callers decide what that means
// for their own response/retry behaviour.
export async function runGhlProvisioning({ tenant, slug, answers, customValues }) {
  const legacyCreds = ghlCredsFor(tenant);
  const agencyAuth = await resolveSubAccountAuth(slug, legacyCreds);
  const activeSnapshotId = await getActiveSnapshotId(slug, legacyCreds.snapshotId);
  const configured = Boolean(activeSnapshotId && agencyAuth.token && agencyAuth.companyId);

  if (!configured) {
    const demoLocationId = "demo-" + Math.random().toString(36).slice(2, 8);
    return { demo: true, locationId: demoLocationId };
  }

  const businessName = customValues.business_name || answers.business_name || "New Lab HQ Client";
  const { id: locationId } = await createSubAccount({
    token: agencyAuth.token,
    companyId: agencyAuth.companyId,
    snapshotId: activeSnapshotId,
    businessName,
    contact: { website: customValues.website_url },
  });

  // All location-data writes below use the LOCATION APP's auth for this
  // specific location, falling back to the legacy agency PI token. If
  // neither is available yet, the deploy still succeeds - the operator
  // retries the sync from Mission Control once the location app is
  // authorised.
  const locationAuth = await resolveLocationDataAuth({ tenantSlug: slug, locationId, legacyCreds });
  const locationAuthNeeded = !locationAuth.token;

  const pushed = locationAuth.token
    ? await pushAllCustomValues({ token: locationAuth.token, companyId: agencyAuth.companyId, locationId, values: customValues })
    : Object.keys(customValues).map((name) => ({ name, ok: false }));
  const failures = pushed.filter((p) => !p.ok);

  let contactWarning = null;
  let contactCreated = false;
  if (locationAuth.token) {
    const rawName = (answers.contact_name || "").trim();
    const [firstName, ...rest] = rawName.split(/\s+/).filter(Boolean);
    try {
      await createContact({ token: locationAuth.token, locationId, firstName, lastName: rest.join(" "), tags: ["onboarding"] });
      contactCreated = true;
    } catch (e) {
      console.error(`[GHL-PROVISION-FAIL] tenant=${slug} step=createContact locationId=${locationId} status=${e.status ?? "-"}`, e.body ?? e.message);
      contactWarning = "We couldn't automatically create the onboarding contact — add it manually in GHL so the Go-Live workflow fires.";
    }
  } else {
    contactWarning = "This sub-account is waiting on location app authorisation before we can sync its data — use \"Retry data sync\" in Mission Control once it's connected.";
  }

  let formEmbed = null;
  if (locationAuth.token) {
    try {
      const forms = await getForms({ token: locationAuth.token, locationId });
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
      console.error(`[GHL-PROVISION-FAIL] tenant=${slug} step=getForms locationId=${locationId} status=${e.status ?? "-"}`, e.body ?? e.message);
    }
  }

  return {
    demo: false,
    locationId,
    pushed,
    failures,
    contactWarning,
    contactCreated,
    formEmbed,
    locationAuthNeeded,
    authorizeUrl: locationAuthNeeded ? locationAuth.authorizeUrl : null,
  };
}
