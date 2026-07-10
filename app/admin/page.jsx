"use client";
import { useEffect, useState } from "react";
import { Table, Badge, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "./admin.module.css";

export default function AdminTenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState(null);

  useEffect(() => {
    adminFetch("/api/admin/tenants")
      .then((data) => setTenants(data.tenants || []))
      .catch((e) => toast.push(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Tenants</h1>
        <p className={s.pageSubtitle}>Every door on the platform, hand-onboarded or self-serve.</p>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Type</th>
            <th>Portal account</th>
            <th>Onboarding</th>
          </tr>
        </thead>
        <tbody>
          {(tenants || []).map((t) => (
            <Table.Row key={t.slug}>
              <td>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.slug}.labhq.co</div>
              </td>
              <td>
                <Badge tone={t.isSeed ? "neutral" : "accent"}>{t.isSeed ? "Hand-onboarded" : "Self-serve"}</Badge>
              </td>
              <td>
                {t.account ? (
                  <div>
                    <div>{t.account.agencyName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.account.contactEmail}</div>
                  </div>
                ) : (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>No account</span>
                )}
              </td>
              <td>
                {t.account ? (
                  t.account.onboarding?.completedAt ? (
                    <Badge tone="success">Complete</Badge>
                  ) : (
                    <Badge tone="warning">In progress</Badge>
                  )
                ) : (
                  <span style={{ color: "var(--muted-2)", fontSize: 13 }}>—</span>
                )}
              </td>
            </Table.Row>
          ))}
          {tenants && tenants.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No tenants yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
