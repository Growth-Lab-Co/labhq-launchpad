// Daily disaster-recovery backup of every durable Netlify Blobs store into
// the "backups" store, pruned to the last 30 snapshots. Runs on Netlify's
// scheduler, which fires in UTC - 17:00 UTC is 03:00 next day in Queensland
// (AEST, fixed UTC+10 year-round, no daylight saving). See DEPLOY.md
// "Disaster recovery" for the restore path (scripts/restore-backup.mjs) and
// the admin console's Backups page.
//
// Uses ambient Blobs context (no explicit siteID/token) - Netlify injects
// that automatically for deployed Functions, same as every app/api route.

import { runBackup } from "../../lib/backup.js";
import { logAdminActivity } from "../../lib/adminActivity.js";

export default async () => {
  try {
    const result = await runBackup({ trigger: "scheduled" });
    console.log(`[backup-blobs] wrote ${result.key} (${result.totalKeys} keys, ${result.sizeBytes} bytes)`);
    if (result.pruned.length) console.log(`[backup-blobs] pruned ${result.pruned.length} old snapshot(s)`);
    await logAdminActivity({
      action: "backup_completed",
      detail: { key: result.key, totalKeys: result.totalKeys, sizeBytes: result.sizeBytes, trigger: "scheduled" },
    });
    return new Response("ok");
  } catch (e) {
    console.error("[backup-blobs] FAILED:", e.message);
    return new Response(`backup failed: ${e.message}`, { status: 500 });
  }
};

export const config = { schedule: "0 17 * * *" };
