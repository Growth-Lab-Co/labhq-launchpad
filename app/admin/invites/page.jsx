"use client";
import { useEffect, useState } from "react";
import { Input, Button, Badge, Table, useToast } from "@/components/ui";
import { adminFetch } from "@/components/admin/adminKey";
import s from "../admin.module.css";

export default function InvitesPage() {
  const toast = useToast();
  const [codes, setCodes] = useState([]);
  const [planLabel, setPlanLabel] = useState("Founding partner");
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  async function refetch() {
    try {
      const data = await adminFetch("/api/admin/invites");
      setCodes(data.codes || []);
    } catch (e) {
      toast.push(e.message, "error");
    }
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminFetch("/api/admin/invites", { method: "POST", body: { planLabel } });
      toast.push("Invite code generated", "success");
      refetch();
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Clipboard denied - the code is still visible in the table to copy manually.
    }
  }

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.pageTitle}>Invite codes</h1>
        <p className={s.pageSubtitle}>The live activation path on the portal's Activate step.</p>
      </div>

      <div className={s.section}>
        <form onSubmit={submit} className={s.sectionForm}>
          <Input label="Plan label" value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Generating…" : "Generate code"}
          </Button>
        </form>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Plan label</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <Table.Row key={c.code}>
              <td>
                <div className={s.copyRow}>
                  <span className={s.copyField}>{c.code}</span>
                  {!c.usedAt && (
                    <Button variant="secondary" size="sm" onClick={() => copyCode(c.code)}>
                      {copiedCode === c.code ? "Copied" : "Copy"}
                    </Button>
                  )}
                </div>
              </td>
              <td>{c.planLabel}</td>
              <td>{c.usedAt ? <Badge tone="neutral">Used</Badge> : <Badge tone="success">Available</Badge>}</td>
            </Table.Row>
          ))}
          {codes.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No invite codes yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
