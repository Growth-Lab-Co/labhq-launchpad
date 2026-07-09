"use client";
import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import { mcFetch } from "@/components/missioncontrol/api";
import { NOTIFICATION_TOGGLES } from "@/lib/notificationDefinitions";
import s from "./settings.module.css";

const ROLES = ["Owner", "Admin", "Member"];
const ROLE_STYLE = {
  Owner: s.roleOwner,
  Admin: s.roleAdmin,
  Member: s.roleMember,
};
const CANCEL_EMAIL = "Hello@growthlabco.com.au";

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

function TeamTab({ slug, mcKey, toast }) {
  const [members, setMembers] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [inviting, setInviting] = useState(false);

  const load = () => {
    mcFetch(`/api/team?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then((data) => setMembers(data.members || []))
      .catch(() => setMembers([]));
  };

  useEffect(load, [slug, mcKey]);

  const sendInvite = async (e) => {
    e.preventDefault();
    if (inviting || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const data = await mcFetch("/api/team", {
        mcKey,
        method: "POST",
        body: { tenant: slug, email: inviteEmail, role: inviteRole },
      });
      setMembers(data.members);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("Member");
      if (data.emailSent) {
        toast.push("Invite sent.", "success");
      } else {
        toast.push(`Invite saved, but the email didn't send: ${data.emailError}`, "error");
      }
    } catch (e) {
      toast.push(e.message || "Couldn't send the invite. Try again.", "error");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (id, role) => {
    try {
      const data = await mcFetch("/api/team", { mcKey, method: "PATCH", body: { tenant: slug, id, role } });
      setMembers(data.members);
    } catch (e) {
      toast.push(e.message || "Couldn't update that role.", "error");
    } finally {
      setMenuId(null);
    }
  };

  const remove = async (id) => {
    try {
      const data = await mcFetch("/api/team", { mcKey, method: "DELETE", body: { tenant: slug, id } });
      setMembers(data.members);
    } catch (e) {
      toast.push(e.message || "Couldn't remove that member.", "error");
    } finally {
      setMenuId(null);
    }
  };

  if (members === null) return <p className={s.muted}>Loading…</p>;

  return (
    <>
      <div className={s.teamHeader}>
        <p className={s.muted}>{members.length} member{members.length === 1 ? "" : "s"}</p>
        <button onClick={() => setInviteOpen(true)} className={s.inviteButton}>
          Invite member
        </button>
      </div>

      {members.length === 0 ? (
        <ComingSoonCard title="No team members yet" description="Invite someone to give them access to this workspace." />
      ) : (
        <div className={s.teamList}>
          {members.map((m, idx) => (
            <div key={m.id} className={`${s.teamRow} ${idx < members.length - 1 ? s.teamRowBordered : ""}`}>
              <div className={s.teamAvatar}>{m.email.charAt(0).toUpperCase()}</div>
              <div className={s.teamInfo}>
                <p className={s.rowLabel}>{m.email}</p>
                <p className={s.rowHelp}>{m.status === "invited" ? "Invited" : "Active"}</p>
              </div>
              <span className={`${s.roleBadge} ${ROLE_STYLE[m.role]}`}>{m.role}</span>
              <div className={s.teamMenuWrap}>
                <button onClick={() => setMenuId(menuId === m.id ? null : m.id)} className={s.teamMenuButton}>
                  <MoreVertical size={14} />
                </button>
                {menuId === m.id && (
                  <div className={s.teamMenuDropdown}>
                    <p className={s.teamMenuLabel}>Change role</p>
                    {ROLES.map((r) => (
                      <button key={r} onClick={() => changeRole(m.id, r)} className={s.teamMenuItem}>
                        {r} {m.role === r && "✓"}
                      </button>
                    ))}
                    <div className={s.teamMenuDivider} />
                    <button onClick={() => remove(m.id)} className={`${s.teamMenuItem} ${s.teamMenuItemDanger}`}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && (
        <div className={s.modalOverlay} onClick={() => setInviteOpen(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>Invite team member</h2>
            </div>
            <form onSubmit={sendInvite}>
              <div className={s.modalBody}>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Email address</label>
                  <input
                    autoFocus
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className={s.fieldInput}
                  />
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Role</label>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={s.fieldSelect}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={s.modalFooter}>
                <button type="button" onClick={() => setInviteOpen(false)} className={s.modalCancelButton}>
                  Cancel
                </button>
                <button type="submit" disabled={inviting || !inviteEmail.trim()} className={s.modalSubmitButton}>
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function BillingTab() {
  const cancelHref = `mailto:${CANCEL_EMAIL}?subject=${encodeURIComponent("Cancel my Lab HQ subscription")}`;

  return (
    <div className={s.planCard}>
      <div className={s.planCardTop}>
        <div>
          <div className={s.planNameRow}>
            <span className={s.planName}>Lab HQ Platform</span>
            <span className={s.planActivePill}>Active</span>
          </div>
          <div className={s.planPriceRow}>
            <span className={s.planPrice}>$349</span>
            <span className={s.planPricePeriod}>/ month</span>
          </div>
        </div>
      </div>
      <ul className={s.planFeatureList}>
        <li>Unlimited client deployments</li>
        <li>AI receptionist onboarding for every client</li>
        <li>Mission Control dashboard for your whole team</li>
      </ul>
      <div className={s.planFooter}>
        <p className={s.rowHelp}>
          Need to make a change? Email <a href={cancelHref} className={s.planCancelLink}>{CANCEL_EMAIL}</a> and we'll take care of it.
        </p>
        <a href={cancelHref} className={s.planCancelButton}>
          Cancel subscription
        </a>
      </div>
    </div>
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
      {activeTab === "team" && <TeamTab slug={slug} mcKey={mcKey} toast={toast} />}
      {activeTab === "billing" && <BillingTab />}
      {activeTab === "notifications" && <NotificationsTab slug={slug} mcKey={mcKey} toast={toast} />}
    </>
  );
}
