// Daily plain-text ops digest (job 7, 2026-07-31) - Bec asked to stop
// checking Mission Control daily and have the system tell her when
// something needs her instead. Runs on Netlify's scheduler (fires in UTC -
// 20:00 UTC is 06:00 next day in Queensland, AEST fixed UTC+10 year-round,
// same reasoning as backup-blobs.mjs's own schedule comment), waiting in
// the inbox at the start of the day.
//
// Sends every day regardless of whether anything needs attention - "0 new
// signups, 0 issues" is itself a useful, reassuring signal that the digest
// is actually running, not silence Bec has to trust.
import { listSignups } from "../../lib/miiaSignups.js";
import { listDeployments } from "../../lib/deployments.js";
import { listEmailFailures } from "../../lib/emailFailures.js";
import { sendTransactionalEmail } from "../../lib/emailFailures.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const STUCK_INTAKE_AFTER_MS = 48 * 60 * 60 * 1000; // paid but never finished the interview
const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const OPS_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

function withinLast(iso, ms) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= ms;
}

function olderThan(iso, ms) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > ms;
}

function line(label, items, formatter) {
  if (!items.length) return `${label}: none`;
  return `${label} (${items.length}):\n` + items.map((i) => `  - ${formatter(i)}`).join("\n");
}

export default async () => {
  const [signups, allDeployments, emailFailures] = await Promise.all([
    listSignups({ includeArchived: false }).catch(() => []),
    listDeployments().catch(() => []),
    listEmailFailures({ sinceMs: DAY_MS }).catch(() => []),
  ]);

  const newSignups = signups.filter((s) => withinLast(s.paidAt, DAY_MS));

  // "Stuck" - three independent honest signals, not a single fuzzy score:
  // provisioning that outright failed (always worth flagging, regardless of
  // age), a paid customer who never finished the intake interview after a
  // reasonable window, or one who finished intake but somehow never
  // deployed (shouldn't happen given deploy fires right after intake
  // completes, but a real gap if it ever does).
  const stuckProvisioning = signups.filter((s) => s.provisioningStatus === "failed");
  const stuckIntake = signups.filter(
    (s) => s.provisioningStatus === "success" && s.intakeStatus !== "complete" && olderThan(s.paidAt, STUCK_INTAKE_AFTER_MS)
  );
  const stuckDeploy = signups.filter((s) => s.intakeStatus === "complete" && s.deployStatus !== "deployed");

  // Channel-connection issues: only the MOST RECENT deployment per tenant
  // matters (older ones are historical/redeployed-over records - see
  // lib/deployments.js listDeployments' own sort), so dedupe by tenant,
  // keeping whichever sorts first (newest, since the list is already
  // newest-first).
  const latestByTenant = new Map();
  for (const d of allDeployments) {
    if (!latestByTenant.has(d.tenant)) latestByTenant.set(d.tenant, d);
  }
  const syncIssues = [...latestByTenant.values()].filter(
    (d) => d.locationAuthNeeded || (d.syncFailures && d.syncFailures.length > 0)
  );

  const totalIssues = stuckProvisioning.length + stuckIntake.length + stuckDeploy.length + syncIssues.length + emailFailures.length;

  const sections = [
    line("New signups (last 24h)", newSignups, (s) => `${s.businessName || s.tenantSlug || s.id} - ${s.plan || "no plan"}${s.founding ? ", founding" : ""}`),
    line("Failed emails (last 24h)", emailFailures, (e) => `${e.context || "unknown"} to ${e.to || "?"}: ${e.error || "no detail"}`),
    line("Provisioning failed", stuckProvisioning, (s) => `${s.businessName || s.id} - ${s.provisioningError || "no error detail"}`),
    line(
      `Stuck in intake (paid, no reply ${Math.round(STUCK_INTAKE_AFTER_MS / (60 * 60 * 1000))}h+)`,
      stuckIntake,
      (s) => `${s.businessName || s.id} - paid ${s.paidAt}`
    ),
    line("Finished intake but never deployed", stuckDeploy, (s) => `${s.businessName || s.id}`),
    line("Channel/sync needs attention", syncIssues, (d) => `${d.businessName || d.tenant} - ${d.locationAuthNeeded ? "location auth needed" : ""}${d.syncFailures?.length ? ` sync failed: ${d.syncFailures.join(", ")}` : ""}`.trim()),
  ];

  const subject = totalIssues > 0 ? `[Miia ops] ${totalIssues} thing${totalIssues === 1 ? "" : "s"} need attention` : "[Miia ops] All quiet";
  const text = [
    `Daily Miia ops digest - ${new Date().toISOString().slice(0, 10)}`,
    "",
    ...sections,
  ].join("\n\n");

  await sendTransactionalEmail({
    context: "daily-ops-digest",
    to: OPS_EMAIL,
    subject,
    text,
    from: MIIA_FROM,
  });

  console.log(`[daily-ops-digest] sent - ${totalIssues} issue(s), ${newSignups.length} new signup(s)`);
};

export const config = { schedule: "0 20 * * *" };
