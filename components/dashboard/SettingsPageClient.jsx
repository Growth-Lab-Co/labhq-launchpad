"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Card } from "./Card";
import styles from "./SettingsPageClient.module.css";

// The fields here mirror app/api/miia/dashboard/settings/route.js's
// EDITABLE_FIELDS whitelist exactly - deliberately narrower than every
// customValues key the bot's system prompt reads. Left out on purpose:
// mia_guardrails / sms_compliance_footer / privacy_policy_snippet
// (compliance-sensitive - a business owner fat-fingering these is a bigger
// risk than the inconvenience of asking Bec to change them), and
// greeting_line (auto-derived from business_name at deploy time - editing
// it separately here would let it silently drift out of sync).
const FIELDS = [
  { key: "business_name", label: "Business name", hint: "What Miia calls you when she answers, and refers to herself as speaking on behalf of.", multiline: false },
  { key: "pricing_summary", label: "Pricing", hint: "Your actual prices and plans - this is the single most common thing a customer asks Miia.", multiline: true },
  { key: "services_summary", label: "Services", hint: "What you do, in a couple of sentences.", multiline: true },
  { key: "service_area", label: "Service area", hint: "Where you operate - suburbs, city, statewide, online.", multiline: false },
  { key: "opening_hours", label: "Opening hours", hint: "Your hours, in plain language.", multiline: false },
  { key: "booking_rules", label: "Booking rules", hint: "How appointments work - length, buffers, who takes them.", multiline: true },
  { key: "tone_style", label: "Tone", hint: "How Miia should sound - professional, friendly, casual, plus phrases you love or hate.", multiline: true },
  { key: "escalation_name", label: "Escalation contact name", hint: "Who Miia hands a customer to when a human is needed.", multiline: false },
  { key: "escalation_contact", label: "Escalation contact detail", hint: "Their email or phone number.", multiline: false },
  { key: "website_url", label: "Website", hint: "Your website address.", multiline: false },
  { key: "faq_block", label: "FAQs", hint: "Common questions and answers, one per line.", multiline: true },
];

function SettingsField({ tenantSlug, field, initialValue, onSaved }) {
  const [value, setValue] = useState(initialValue || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/miia/dashboard/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, patch: { [field.key]: value } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that");
      const saved = data.customValues?.[field.key] ?? "";
      setValue(saved);
      onSaved?.(field.key, saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className={styles.fieldLabel}>{field.label}</p>
      <p className={styles.fieldHint}>{field.hint}</p>
      <div className={styles.fieldRow}>
        {field.multiline ? (
          <textarea
            className={styles.fieldInput}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <input
            type="text"
            className={styles.fieldInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <button type="button" className={styles.fieldSaveBtn} onClick={save} disabled={saving}>
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            "Save"
          )}
        </button>
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
    </Card>
  );
}

export function SettingsPageClient({ tenantSlug, customValues }) {
  return (
    <>
      <h1 className={styles.heading}>Settings</h1>
      <p className={styles.intro}>
        What Miia knows about your business. Changes save straight away, no need to wait or redeploy - the next
        conversation uses the new details immediately.
      </p>
      <div className={styles.grid}>
        {FIELDS.map((field) => (
          <SettingsField key={field.key} tenantSlug={tenantSlug} field={field} initialValue={customValues?.[field.key]} />
        ))}
      </div>
    </>
  );
}
