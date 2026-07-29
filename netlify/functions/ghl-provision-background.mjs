// Netlify Background Function (see bot-reply-background.mjs's header
// comment for why the -background suffix matters) - runs the real GHL
// sub-account provisioning for a Miia Chat-tier tenant AFTER the customer
// has already been told their system is live (job 2a's instant deploy path,
// app/api/deploy/route.js). Never allowed to surface anything to the
// customer - a failure here is silently retried never (see the wince list
// in the job's summary) and instead files an ops alert so a human finishes
// it manually.
import { getTenant } from "../../lib/tenants.js";
import { runGhlProvisioning } from "../../lib/ghlProvisioning.js";
import { markLocationSynced } from "../../lib/deployments.js";
import { logActivity } from "../../lib/activity.js";
import { sendTransactionalEmail } from "../../lib/emailFailures.js";

const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const OPS_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

export default async (req) => {
  const { tenantSlug, answers, customValues, deploymentId, businessName } = await req.json().catch(() => ({}));
  try {
    const tenant = await getTenant(tenantSlug);
    if (!tenant) throw new Error(`Unknown tenant ${tenantSlug}`);

    const result = await runGhlProvisioning({ tenant, slug: tenantSlug, answers, customValues });

    if (!deploymentId) {
      console.log(`[GHL-PROVISION-BG] tenant=${tenantSlug} had no deploymentId to patch - nothing to update`);
      return new Response("ok");
    }

    if (result.demo) {
      await markLocationSynced(deploymentId, tenantSlug, { locationId: result.locationId, ghlStatus: "ready" });
    } else {
      await markLocationSynced(deploymentId, tenantSlug, {
        locationId: result.locationId,
        locationAuthNeeded: result.locationAuthNeeded,
        contactCreated: result.contactCreated,
        customValuesSynced: !result.locationAuthNeeded && result.failures.length === 0,
        syncFailures: result.failures.map((f) => f.name),
        ghlStatus: "ready",
      });
    }
    await logActivity({ tenant: tenantSlug, deploymentId, businessName, type: "general", text: "Background GHL provisioning finished" });
    console.log(`[GHL-PROVISION-BG] tenant=${tenantSlug} finished:`, JSON.stringify({ demo: result.demo, locationId: result.locationId }));
  } catch (e) {
    console.error(`[GHL-PROVISION-BG-FAIL] tenant=${tenantSlug}`, e.stack || e.message);
    if (deploymentId) {
      await markLocationSynced(deploymentId, tenantSlug, { ghlStatus: "failed" }).catch(() => {});
    }
    await logActivity({
      tenant: tenantSlug,
      deploymentId,
      businessName,
      type: "attention",
      text: "Background GHL provisioning failed - needs manual setup.",
    }).catch(() => {});
    await sendTransactionalEmail({
      context: "ghl-provision-background-failed",
      to: OPS_EMAIL,
      subject: `${businessName || tenantSlug}: background GHL setup failed`,
      text: `Instant Chat-tier deploy for ${businessName || tenantSlug} succeeded for the customer, but background GHL sub-account provisioning failed:\n\n${e.message}\n\nFinish this manually in GHL and Mission Control.`,
      from: MIIA_FROM,
      tenantSlug,
    }).catch((emailErr) => console.error(`[GHL-PROVISION-BG] ops alert email also failed for ${tenantSlug}:`, emailErr.message));
  }
  return new Response("ok");
};
