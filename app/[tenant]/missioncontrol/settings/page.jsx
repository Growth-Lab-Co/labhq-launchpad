"use client";
import { useEffect, useState } from "react";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import { mcFetch } from "@/components/missioncontrol/api";
import { NOTIFICATION_TOGGLES } from "@/lib/notificationDefinitions";
import s from "./settings.module.css";

const TABS = [
  { id: "general", label: "General" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
];

function SettingsRow({ label, help, children }) {
  return (
    <div className={s.row}>
      <div className={s.rowLabelWrap}>
        <p className={s.rowLabel}>{label}</p>
        {help && <p className={s.rowHelp}>{help}</p>}
      </div>
      <div className={s.rowControl}>{children}</div>
    </div>
  );
}

function ComingSoonCard({ title, description }) {
  return (
    <div className={s.comingSoon}>
      <h3 className={s.comingSoonTitle}>{title}</h3>
      <p className={s.comingSoonText}>{description}</p>
    </div>
  );
}

function GeneralTab({ slug, mcKey }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    mcFetch(`/api/tenant-config?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then(setConfig)
      .catch(() => setConfig({}));
  }, [slug, mcKey]);

  if (!config) return <p className={s.muted}>Loading…</p>;

  return (
    <>
      <SettingsRow label="Agency name" help="Shown throughout your workspace">
        <input className={s.input} value={config.agencyName || ""} readOnly disabled />
      </SettingsRow>
      <SettingsRow label="Subdomain" help="Your client portal URL — set at onboarding, not editable here">
        <input className={s.input} value={config.subdomain || ""} readOnly disabled />
      </SettingsRow>
    </>
  );
}

function TeamTab() {
  return (
    <ComingSoonCard
      title="Team management — coming soon"
      description="Inviting teammates and assigning roles isn't wired up yet. For now, Mission Control access is shared via the single dashboard password."
    />
  );
}

function BillingTab() {
  return (
    <ComingSoonCard
      title="Billing — coming soon"
      description="Plan details and invoices aren't tracked in Lab HQ yet."
    />
  );
}

function NotificationsTab({ slug, mcKey, toast }) {
  const defs = NOTIFICATION_TOGGLES;
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mcFetch(`/api/notifications?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then((data) => setSettings(data.settings))
      .catch(() => setSettings({}));
  }, [slug, mcKey]);

  const toggle = (id) => {
    setSettings((s) => ({ ...s, [id]: !s[id] }));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await mcFetch("/api/notifications", { mcKey, method: "PATCH", body: { tenant: slug, settings } });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.push("Couldn't save notification settings. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className={s.muted}>Loading…</p>;

  return (
    <>
      {defs.map((n, idx) => (
        <div key={n.id} className={`${s.notifRow} ${idx < defs.length - 1 ? s.notifRowBordered : ""}`}>
          <div>
            <p className={s.rowLabel}>{n.label}</p>
            <p className={s.rowHelp}>{n.help}</p>
          </div>
          <button
            onClick={() => toggle(n.id)}
            role="switch"
            aria-checked={Boolean(settings[n.id])}
            className={`${s.toggle} ${settings[n.id] ? s.toggleOn : ""}`}
          >
            <div className={s.toggleKnob} />
          </button>
        </div>
      ))}

      {dirty && (
        <div className={s.saveBar}>
          <div className={s.saveBarInner}>
            <span className={s.saveBarText}>Unsaved changes</span>
            <button onClick={save} disabled={saving} className={s.saveButton}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function SettingsPage() {
  const { slug, mcKey, toast } = useMissionControl();
  const [activeTab, setActiveTab] = useState("general");

  return (
    <>
      <div className={s.pageHeader}>
        <h1 className={s.title}>Settings</h1>
      </div>

      <div className={s.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${s.tab} ${activeTab === tab.id ? s.tabActive : ""}`}
          >
            {tab.label}
            {activeTab === tab.id && <div className={s.tabIndicator} />}
          </button>
        ))}
      </div>

      {activeTab === "general" && <GeneralTab slug={slug} mcKey={mcKey} />}
      {activeTab === "team" && <TeamTab />}
      {activeTab === "billing" && <BillingTab />}
      {activeTab === "notifications" && <NotificationsTab slug={slug} mcKey={mcKey} toast={toast} />}
    </>
  );
}
