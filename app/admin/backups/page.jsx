"use client";
import { useCallback, useEffect, useState } from "react";
import { Table, Button, Card, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "../admin.module.css";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupsPage() {
  const toast = useToast();
  const [snapshots, setSnapshots] = useState(null);
  const [runningBackup, setRunningBackup] = useState(false);

  const load = useCallback(() => {
    adminFetch("/api/admin/backups")
      .then((data) => setSnapshots(data.snapshots || []))
      .catch((e) => toast.push(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function backUpNow() {
    setRunningBackup(true);
    try {
      const { result } = await adminFetch("/api/admin/backups", { method: "POST" });
      toast.push(`Backup complete: ${result.totalKeys} keys, ${formatSize(result.sizeBytes)}`, "success");
      load();
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setRunningBackup(false);
    }
  }

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Backups</h1>
        <p className={s.pageSubtitle}>
          Every durable Netlify Blobs store, snapshotted daily at 03:00 AEST and kept for 30 days.
        </p>
      </div>

      <div className={s.section}>
        <Button onClick={backUpNow} disabled={runningBackup}>
          {runningBackup ? "Backing up…" : "Back up now"}
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Created</th>
            <th>Trigger</th>
            <th>Keys</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {(snapshots || []).map((snap) => (
            <Table.Row key={snap.key}>
              <td style={{ fontWeight: 600 }}>{snap.dateLabel}</td>
              <td style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
                {snap.createdAt ? new Date(snap.createdAt).toLocaleString() : "-"}
              </td>
              <td style={{ fontSize: 13 }}>{snap.trigger || "-"}</td>
              <td style={{ fontSize: 13 }}>{snap.totalKeys ?? "-"}</td>
              <td style={{ fontSize: 13 }}>{formatSize(snap.sizeBytes)}</td>
            </Table.Row>
          ))}
          {snapshots && snapshots.length === 0 && (
            <tr>
              <td colSpan={5} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No snapshots yet - the daily job runs at 03:00 AEST, or use "Back up now" above.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <div className={s.section} style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, margin: "0 0 8px" }}>Disaster recovery</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Restoring is deliberately CLI-only - there's no one-click restore here, so a wrong click in the admin
          console can never overwrite live data. Run this from a machine with <code>NETLIFY_API_TOKEN</code> set:
        </p>
        <Card style={{ padding: 0 }}>
          <pre
            style={{
              margin: 0,
              padding: "var(--space-4)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
{`# List available snapshots
node scripts/restore-backup.mjs --list

# See what would change, without writing anything
node scripts/restore-backup.mjs --date 2026-07-14 --dry-run
node scripts/restore-backup.mjs --date 2026-07-14 --store tenants --dry-run

# Restore for real (prompts for confirmation)
node scripts/restore-backup.mjs --date 2026-07-14
node scripts/restore-backup.mjs --date 2026-07-14 --store tenants`}
          </pre>
        </Card>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
          Full usage, including the <code>--delete-extraneous</code> flag for exact point-in-time rollback, is in
          DEPLOY.md under "Disaster recovery".
        </p>
      </div>
    </>
  );
}
