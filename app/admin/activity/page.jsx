"use client";
import { useEffect, useState } from "react";
import { Table, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "../admin.module.css";

const ACTION_LABELS = {
  tenant_removed: "Tenant removed",
  client_removed: "Client removed",
  backup_completed: "Backup completed",
};

export default function AdminActivityPage() {
  const toast = useToast();
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    adminFetch("/api/admin/activity")
      .then((data) => setEntries(data.entries || []))
      .catch((e) => toast.push(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Activity</h1>
        <p className={s.pageSubtitle}>Operator actions taken from this console.</p>
      </div>

      <Table>
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {(entries || []).map((e) => (
            <Table.Row key={e.id}>
              <td style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td>{ACTION_LABELS[e.action] || e.action}</td>
              <td style={{ fontSize: 13 }}>
                {e.action === "tenant_removed" ? (
                  <>
                    <div>
                      <strong>{e.detail?.slug}</strong>.labhq.co
                    </div>
                    <div style={{ color: "var(--muted)" }}>
                      {e.detail?.contactEmail || "no account"}
                      {e.detail?.domainDeregistered ? " · domain alias removed" : ""}
                    </div>
                  </>
                ) : e.action === "client_removed" ? (
                  <>
                    <div>
                      <strong>{e.detail?.businessName}</strong>
                    </div>
                    <div style={{ color: "var(--muted)" }}>{e.detail?.tenant}.labhq.co</div>
                  </>
                ) : e.action === "backup_completed" ? (
                  <>
                    <div>
                      <strong>{e.detail?.key}</strong>
                    </div>
                    <div style={{ color: "var(--muted)" }}>
                      {e.detail?.totalKeys} keys · {Math.round((e.detail?.sizeBytes || 0) / 1024)} KB · {e.detail?.trigger}
                    </div>
                  </>
                ) : (
                  <span style={{ color: "var(--muted)" }}>{JSON.stringify(e.detail)}</span>
                )}
              </td>
            </Table.Row>
          ))}
          {entries && entries.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No operator actions logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
