"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, Check, X, Download } from "lucide-react";
import { Modal, Button, Input } from "@/components/ui";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import { BreadcrumbPortal } from "@/components/missioncontrol/BreadcrumbPortal";
import { StatusBadge } from "@/components/missioncontrol/StatusBadge";
import { mcFetch } from "@/components/missioncontrol/api";
import {
  STATUS_STEPS,
  displayStatus,
  needsDataSync,
  formatDate,
  relativeTime,
  ghlLocationUrl,
} from "@/components/missioncontrol/statusHelpers";
import { INTERVIEW_FIELDS, CUSTOM_VALUE_KEYS } from "@/lib/questions";
import s from "./detail.module.css";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "setup", label: "Setup answers" },
  { id: "ai-replies", label: "AI Replies" },
  { id: "checklist", label: "Checklist" },
  { id: "activity", label: "Activity" },
];

function stepIndexOf(key) {
  return STATUS_STEPS.findIndex((s) => s.key === key);
}

export default function ClientDetailPage({ params }) {
  const { tenant: slug, id } = params;
  const { mcKey, toast, refetchActivity } = useMissionControl();
  const router = useRouter();
  const base = `/${slug}/missioncontrol`;
  const [activeTab, setActiveTab] = useState("overview");
  const [deployment, setDeployment] = useState(null);
  const [error, setError] = useState(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  const load = () => {
    mcFetch(`/api/deployments?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then((data) => {
        const found = (data.deployments || []).find((d) => d.id === id);
        setDeployment(found || null);
        if (!found) setError("Client not found");
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, mcKey, id]);

  if (error && !deployment) {
    return <div className={s.notFound}>{error}</div>;
  }
  if (!deployment) {
    return <p className={s.muted}>Loading…</p>;
  }

  const status = displayStatus(deployment);

  return (
    <>
      <BreadcrumbPortal>
        <Link href={base} className={s.crumbLink}>
          <ChevronLeft size={13} strokeWidth={2.5} />
          Clients
        </Link>
        <span className={s.crumbSep}>/</span>
        <span className={s.crumbCurrent}>{deployment.businessName || "Unnamed business"}</span>
      </BreadcrumbPortal>

      <div className={s.header}>
        <div className={s.headerLeft}>
          <Link href={base} className={s.backLink}>
            <ChevronLeft size={18} />
          </Link>
          <h1 className={s.title}>{deployment.businessName || "Unnamed business"}</h1>
          <StatusBadge status={status} />
        </div>
        <div className={s.headerActions}>
          {deployment.locationId && (
            <a
              href={ghlLocationUrl(deployment.locationId)}
              target="_blank"
              rel="noopener noreferrer"
              className={s.secondaryButton}
            >
              Open in GoHighLevel
            </a>
          )}
        </div>
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

      <div className={s.tabContent}>
        {activeTab === "overview" && (
          <OverviewTab
            deployment={deployment}
            slug={slug}
            mcKey={mcKey}
            toast={toast}
            onChanged={(next) => {
              setDeployment(next);
              refetchActivity();
            }}
            onRequestRemove={() => setRemoveModalOpen(true)}
          />
        )}
        {activeTab === "setup" && <SetupTab deployment={deployment} />}
        {activeTab === "ai-replies" && (
          <AiRepliesTab deployment={deployment} slug={slug} mcKey={mcKey} toast={toast} />
        )}
        {activeTab === "checklist" && (
          <ChecklistTab slug={slug} mcKey={mcKey} deploymentId={id} onTicked={refetchActivity} />
        )}
        {activeTab === "activity" && <ActivityTab deploymentId={id} />}
      </div>

      <RemoveClientModal
        open={removeModalOpen}
        deployment={deployment}
        slug={slug}
        mcKey={mcKey}
        toast={toast}
        onClose={() => setRemoveModalOpen(false)}
        onRemoved={() => {
          refetchActivity();
          router.push(base);
        }}
      />
    </>
  );
}

// ─── Remove client ────────────────────────────────────────────────────────────

function RemoveClientModal({ open, deployment, slug, mcKey, toast, onClose, onRemoved }) {
  const [confirmText, setConfirmText] = useState("");
  const [removing, setRemoving] = useState(false);
  const expectedName = deployment?.businessName || "Unnamed business";

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  async function confirmRemove() {
    setRemoving(true);
    try {
      await mcFetch("/api/deployments", {
        mcKey,
        method: "DELETE",
        body: { id: deployment.id, tenant: slug, confirmName: confirmText },
      });
      toast.push(`${expectedName} removed`, "success");
      onRemoved();
    } catch (e) {
      toast.push(e.message || "Couldn't remove this client. Try again.", "error");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={removing ? undefined : onClose}
      title={`Remove ${expectedName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={removing}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={removing || confirmText !== expectedName} onClick={confirmRemove}>
            {removing ? "Removing…" : "Remove client"}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
        This removes the record from your dashboard. Delete the GoHighLevel sub-account separately if needed.
      </p>
      <Input
        label={`Type "${expectedName}" to confirm`}
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoFocus
        disabled={removing}
      />
    </Modal>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ deployment, slug, mcKey, toast, onChanged, onRequestRemove }) {
  const [copiedId, setCopiedId] = useState(false);
  const [settingStatus, setSettingStatus] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const currentIndex = Math.max(stepIndexOf(deployment.status), 0);
  const needsSync = needsDataSync(deployment);

  const copyId = () => {
    navigator.clipboard?.writeText(deployment.locationId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  async function setStatus(stepKey) {
    if (settingStatus) return;
    setSettingStatus(true);
    try {
      const data = await mcFetch("/api/deployments", {
        mcKey,
        method: "PATCH",
        body: { id: deployment.id, status: stepKey, tenant: slug },
      });
      onChanged(data.deployment);
    } catch {
      toast.push("Couldn't update the status. Try again.", "error");
    } finally {
      setSettingStatus(false);
    }
  }

  async function retrySync() {
    setRetrying(true);
    setSyncResult(null);
    try {
      const data = await mcFetch("/api/deploy/retry-sync", {
        mcKey,
        method: "POST",
        body: { id: deployment.id, tenant: slug },
      });
      onChanged(data.deployment);
      setSyncResult({ pushed: data.pushed, warning: data.warning, contactWarning: data.contactWarning });
      toast.push(data.deployment?.customValuesSynced ? "Data sync complete." : "Retried - some values are still unsynced.", data.deployment?.customValuesSynced ? "success" : "error");
    } catch (e) {
      setSyncResult(null);
      toast.push(
        e.status === 409
          ? "Still not authorised. Connect the location app for this sub-account, then retry."
          : e.message || "Couldn't retry the sync. Try again.",
        "error"
      );
    } finally {
      setRetrying(false);
    }
  }

  const connected = (stepKey) => currentIndex >= stepIndexOf(stepKey);

  const leftRows = [
    { label: "Deployed", value: <span className={s.rowValue}>{formatDate(deployment.createdAt)}</span> },
    {
      label: "Location ID",
      value: deployment.locationId ? (
        <span className={`${s.rowValue} ${s.mono} ${s.copyGroup}`}>
          {deployment.locationId}
          <button onClick={copyId} className={s.copyIconButton}>
            {copiedId ? <Check size={12} className={s.copiedIcon} /> : <Copy size={12} />}
          </button>
        </span>
      ) : (
        <span className={s.rowValue}>—</span>
      ),
    },
    {
      label: "Phone",
      value: (
        <span className={s.rowValue}>
          <span className={`${s.dot} ${connected("phone_live") ? s.dotOn : s.dotOff}`} />
          {connected("phone_live") ? "Connected" : "Not connected"}
        </span>
      ),
    },
  ];

  const rightRows = [
    {
      label: "Calendar",
      value: (
        <span className={s.rowValue}>
          <span className={`${s.dot} ${connected("calendar_connected") ? s.dotOn : s.dotOff}`} />
          {connected("calendar_connected") ? "Connected" : "Not connected"}
        </span>
      ),
    },
    { label: "Contact", value: <span className={s.rowValue}>{deployment.contactName || "—"}</span> },
    { label: "Mode", value: <span className={s.rowValue}>{deployment.demo ? "Demo" : "Live GHL sub-account"}</span> },
  ];

  return (
    <div className={s.overview}>
      <div className={s.detailsGrid}>
        <div>
          {leftRows.map((r) => (
            <div key={r.label} className={s.detailRow}>
              <span className={s.detailLabel}>{r.label}</span>
              {r.value}
            </div>
          ))}
        </div>
        <div>
          {rightRows.map((r) => (
            <div key={r.label} className={s.detailRow}>
              <span className={s.detailLabel}>{r.label}</span>
              {r.value}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className={s.sectionLabel}>Fulfillment status</h3>
        <div className={s.stepperWrap}>
          <div className={s.stepperLine} />
          {STATUS_STEPS.map((step, idx) => {
            const isPast = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={step.key}
                disabled={settingStatus}
                onClick={() => setStatus(step.key)}
                className={s.stepRow}
              >
                <span className={`${s.stepDot} ${isPast ? s.stepDotPast : isCurrent ? s.stepDotCurrent : ""}`} />
                <span className={`${s.stepLabel} ${isCurrent ? s.stepLabelCurrent : ""}`}>{step.label}</span>
                {isCurrent && needsSync && <span className={s.attentionPill}>Attention</span>}
              </button>
            );
          })}
        </div>
      </div>

      {!deployment.demo && (
        <div>
          <h3 className={s.sectionLabel}>Data sync</h3>
          {needsSync ? (
            <>
              <div className={s.syncActions}>
                <a
                  href={`/api/oauth/start?app=location&tenant=${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={s.secondaryButton}
                >
                  Authorise data sync
                </a>
                <button onClick={retrySync} disabled={retrying} className={s.secondaryButton}>
                  {retrying ? "Retrying…" : "Retry data sync"}
                </button>
              </div>
              <p className={s.helpText}>
                GHL doesn't let us preselect the location. When the picker opens, choose{" "}
                <strong>{deployment.businessName || "this business"}</strong>, then select Retry data sync.
              </p>
              {syncResult && (
                <div className={s.syncResultBox}>
                  {syncResult.pushed && (
                    <ul className={s.syncResultList}>
                      {syncResult.pushed.map((p) => (
                        <li key={p.name} className={p.ok ? s.syncResultOk : s.syncResultFail}>
                          {p.ok ? <Check size={11} /> : <X size={11} />} {p.name.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                  )}
                  {syncResult.warning && <p className={s.helpText}>{syncResult.warning}</p>}
                  {syncResult.contactWarning && <p className={s.helpText}>{syncResult.contactWarning}</p>}
                </div>
              )}
            </>
          ) : (
            <div className={s.syncedState}>
              <span className={`${s.dot} ${s.dotOn}`} />
              <span className={s.rowValue}>Values synced</span>
              <span className={s.helpText}>
                {deployment.locationSyncedAt ? formatDate(deployment.locationSyncedAt) : formatDate(deployment.createdAt)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className={s.dangerZone}>
        <button onClick={onRequestRemove} className={s.dangerLink}>
          Remove client
        </button>
      </div>
    </div>
  );
}

// ─── Setup answers ────────────────────────────────────────────────────────────

function SetupTab({ deployment }) {
  const [source, setSource] = useState("answers");
  const [copiedRow, setCopiedRow] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const answerFields = INTERVIEW_FIELDS.map((f) => ({
    label: f.ask,
    value: deployment.answers?.[f.field] || "—",
  }));
  const valueFields = CUSTOM_VALUE_KEYS.map((key) => ({
    label: key.replaceAll("_", " "),
    value: String(deployment.customValues?.[key] ?? "—"),
  }));
  const fields = source === "answers" ? answerFields : valueFields;
  const hasData = source === "answers" ? Boolean(deployment.answers) : Boolean(deployment.customValues);

  const copyRow = (idx, value) => {
    navigator.clipboard?.writeText(value);
    setCopiedRow(idx);
    setTimeout(() => setCopiedRow(null), 1500);
  };

  const copyAll = () => {
    const text = fields.map((f) => `${f.label}: ${f.value}`).join("\n");
    navigator.clipboard?.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const downloadCsv = () => {
    const rows = ['"Field","Value"', ...fields.map((f) => `"${f.label}","${String(f.value).replace(/"/g, '""')}"`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(deployment.businessName || "client").replace(/\s+/g, "-").toLowerCase()}-${source}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={s.setup}>
      <div className={s.setupToolbar}>
        <div className={s.segmented}>
          <button
            onClick={() => setSource("answers")}
            className={`${s.segmentButton} ${source === "answers" ? s.segmentActive : ""}`}
          >
            Interview answers
          </button>
          <button
            onClick={() => setSource("values")}
            className={`${s.segmentButton} ${source === "values" ? s.segmentActive : ""}`}
          >
            Custom values
          </button>
        </div>
        <div className={s.setupActions}>
          <button onClick={copyAll} className={s.smallButton}>
            {copiedAll ? (
              <>
                <Check size={11} className={s.copiedIcon} /> Copied
              </>
            ) : (
              <>
                <Copy size={11} /> Copy all
              </>
            )}
          </button>
          <button onClick={downloadCsv} className={s.smallButton}>
            <Download size={11} /> Download CSV
          </button>
        </div>
      </div>

      {!hasData ? (
        <p className={s.muted}>Not recorded for this client.</p>
      ) : (
        fields.map((f, i) => (
          <div key={i} className={s.setupRow}>
            <span className={s.setupLabel}>{f.label}</span>
            <span className={s.setupValue}>
              <span className={s.setupValueText}>{f.value}</span>
              <button onClick={() => copyRow(i, f.value)} className={s.copyIconButton}>
                {copiedRow === i ? <Check size={12} className={s.copiedIcon} /> : <Copy size={12} />}
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ─── AI Replies ───────────────────────────────────────────────────────────────

const BOT_CHANNELS = [
  { id: "sms", label: "SMS" },
  { id: "fb", label: "Facebook" },
  { id: "ig", label: "Instagram" },
  { id: "webchat", label: "Web chat" },
];

function AiRepliesTab({ deployment, slug, mcKey, toast }) {
  const { activity } = useMissionControl();
  const locationId = deployment.locationId || deployment.id;
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    mcFetch(`/api/bot-settings?tenant=${encodeURIComponent(slug)}&locationId=${encodeURIComponent(locationId)}`, {
      mcKey,
    })
      .then((data) => setSettings(data.settings))
      .catch(() => setSettings(null));
  }, [slug, mcKey, locationId]);

  const update = (patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  };
  const updateChannel = (id, value) => {
    setSettings((prev) => ({ ...prev, channels: { ...prev.channels, [id]: value } }));
    setDirty(true);
    setSaved(false);
  };
  const updateQuietHours = (key, value) => {
    setSettings((prev) => ({ ...prev, quietHours: { ...prev.quietHours, [key]: value } }));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await mcFetch("/api/bot-settings", {
        mcKey,
        method: "PATCH",
        body: { tenant: slug, locationId, settings },
      });
      setSettings(data.settings);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.push("Couldn't save AI Replies settings. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const needsAuth = !deployment.demo && Boolean(deployment.locationAuthNeeded);
  const botActivity = (activity || []).filter(
    (e) => e.deploymentId === deployment.id && e.type === "bot_message"
  );

  return (
    <div className={s.aiReplies}>
      {needsAuth ? (
        <div>
          <h3 className={s.sectionLabel}>Turn on AI Replies</h3>
          <p className={s.helpText} style={{ marginBottom: 12 }}>
            This client's data sync needs to be authorised before the bot can read or send messages.
          </p>
          <div className={s.syncActions}>
            <a
              href={`/api/oauth/start?app=location&tenant=${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={s.secondaryButton}
            >
              Authorise data sync
            </a>
          </div>
        </div>
      ) : settings === null ? (
        <p className={s.muted}>Loading…</p>
      ) : (
        <>
          <div className={`${s.aiRow} ${s.aiRowBordered}`}>
            <div>
              <p className={s.aiRowLabel}>AI Replies</p>
              <p className={s.aiRowHelp}>Automatically reply to inbound messages in this client's voice</p>
            </div>
            <button
              onClick={() => update({ enabled: !settings.enabled })}
              role="switch"
              aria-checked={Boolean(settings.enabled)}
              className={`${s.toggle} ${settings.enabled ? s.toggleOn : ""}`}
            >
              <div className={s.toggleKnob} />
            </button>
          </div>

          <div className={s.aiSection}>
            <h3 className={s.sectionLabel}>Channels</h3>
            <div className={s.channelGrid}>
              {BOT_CHANNELS.map((c) => (
                <label key={c.id} className={s.channelPill}>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.channels?.[c.id])}
                    onChange={(e) => updateChannel(c.id, e.target.checked)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className={s.aiSection}>
            <h3 className={s.sectionLabel}>Quiet hours</h3>
            <div className={s.quietHoursRow}>
              <input
                type="time"
                value={settings.quietHours?.start || ""}
                onChange={(e) => updateQuietHours("start", e.target.value)}
                className={s.timeInput}
              />
              <span className={s.helpText}>to</span>
              <input
                type="time"
                value={settings.quietHours?.end || ""}
                onChange={(e) => updateQuietHours("end", e.target.value)}
                className={s.timeInput}
              />
              <input
                type="text"
                value={settings.quietHours?.tz || ""}
                onChange={(e) => updateQuietHours("tz", e.target.value)}
                className={s.tzInput}
                placeholder="Australia/Brisbane"
              />
            </div>
          </div>

          <div className={s.aiSection}>
            <h3 className={s.sectionLabel}>Handoff &amp; limits</h3>
            <div className={s.detailRow}>
              <span className={s.detailLabel}>Handoff keyword</span>
              <input
                type="text"
                value={settings.handoffKeyword || ""}
                onChange={(e) => update({ handoffKeyword: e.target.value })}
                className={s.smallInput}
              />
            </div>
            <div className={s.detailRow}>
              <span className={s.detailLabel}>Max replies / conversation / hour</span>
              <input
                type="number"
                min="1"
                value={settings.maxRepliesPerConversationPerHour ?? ""}
                onChange={(e) => update({ maxRepliesPerConversationPerHour: Number(e.target.value) || 1 })}
                className={s.smallInput}
              />
            </div>
          </div>

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
      )}

      <div className={s.aiSection}>
        <h3 className={s.sectionLabel}>Test chat</h3>
        <p className={s.helpText} style={{ marginBottom: 12 }}>
          Preview the bot's replies using this client's real business context. Nothing here touches GHL.
        </p>
        <TestChat slug={slug} mcKey={mcKey} deploymentId={deployment.id} />
      </div>

      <div className={s.aiSection}>
        <h3 className={s.sectionLabel}>Recent bot activity</h3>
        {botActivity.length === 0 ? (
          <p className={s.muted}>No AI replies yet.</p>
        ) : (
          <div className={s.aiActivityTimeline}>
            <div className={s.activityLine} />
            {botActivity.slice(0, 20).map((entry, idx) => (
              <div key={entry.id} className={s.aiActivityRow}>
                <div className={`${s.activityDot} ${idx < 3 ? s.activityDotRecent : ""}`} />
                <div className={s.activityContent}>
                  <span className={s.activityText}>{entry.text}</span>
                  <span className={s.activityMeta}>· {relativeTime(entry.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TestChat({ slug, mcKey, deploymentId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text) {
    const historyForRequest = messages.map((m) => ({
      direction: m.role === "user" ? "inbound" : "outbound",
      body: m.content,
    }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const data = await mcFetch("/api/bot/test", {
        mcKey,
        method: "POST",
        body: { tenant: slug, deploymentId, messages: historyForRequest, inboundText: text },
      });
      let reply;
      if (data.category === "handoff") {
        reply = "[Would hand off to a human — handoff keyword or urgent request detected]";
      } else if (data.category === "spam") {
        reply = "[Would be ignored as spam]";
      } else {
        reply = data.reply || "…";
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.testChat}>
      <div className={s.chatLog}>
        {messages.length === 0 && (
          <p className={s.muted}>Send a message as a customer to preview the bot's reply.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`${s.chatBubble} ${m.role === "user" ? s.chatBubbleUser : s.chatBubbleAssistant}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className={`${s.chatBubble} ${s.chatBubbleAssistant}`}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      {error && (
        <p className={s.helpText} style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
      <form
        className={s.chatComposer}
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !busy) send(input.trim());
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message as the customer…"
          className={s.chatInput}
        />
        <button type="submit" disabled={busy || !input.trim()} className={s.smallButton}>
          Send
        </button>
      </form>
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function ChecklistTab({ slug, mcKey, deploymentId, onTicked }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    mcFetch(`/api/checklist?tenant=${encodeURIComponent(slug)}&id=${encodeURIComponent(deploymentId)}`, { mcKey })
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }, [slug, mcKey, deploymentId]);

  const toggle = async (itemId) => {
    const data = await mcFetch("/api/checklist", {
      mcKey,
      method: "PATCH",
      body: { tenant: slug, id: deploymentId, itemId },
    }).catch(() => null);
    if (data) {
      setItems(data.items);
      onTicked?.();
    }
  };

  if (items === null) return <p className={s.muted}>Loading…</p>;

  const progress = items.length ? Math.round((items.filter((i) => i.checked).length / items.length) * 100) : 0;
  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <div className={s.checklist}>
      <div className={s.checklistProgressTrack}>
        <div className={s.checklistProgressFill} style={{ width: `${progress}%` }} />
      </div>

      {groups.map((group) => (
        <div key={group} className={s.checklistGroup}>
          <h4 className={s.checklistGroupLabel}>{group}</h4>
          <div className={s.checklistGroupBody}>
            {items
              .filter((i) => i.group === group)
              .map((item) => (
                <div key={item.id} role="checkbox" aria-checked={item.checked} onClick={() => toggle(item.id)} className={s.checklistRow}>
                  <div className={s.checklistRowLeft}>
                    <div className={`${s.checkbox} ${item.checked ? s.checkboxOn : ""}`}>
                      {item.checked && <Check size={10} strokeWidth={3} className={s.checkboxIcon} />}
                    </div>
                    <span className={`${s.checklistText} ${item.checked ? s.checklistTextDone : ""}`}>{item.text}</span>
                  </div>
                  <span className={`${s.ownerTag} ${item.owner === "You" ? s.ownerYou : s.ownerClient}`}>{item.owner}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity ─────────────────────────────────────────────────────────────────

function ActivityTab({ deploymentId }) {
  const { activity } = useMissionControl();

  if (activity === null) return <p className={s.muted}>Loading…</p>;

  const entries = activity.filter((e) => e.deploymentId === deploymentId);

  if (entries.length === 0) {
    return <p className={s.muted}>No activity recorded for this client yet.</p>;
  }

  return (
    <div className={s.activityTimeline}>
      <div className={s.activityLine} />
      {entries.map((entry, idx) => (
        <div key={entry.id} className={s.activityRow}>
          <div className={`${s.activityDot} ${idx < 3 ? s.activityDotRecent : ""}`} />
          <div className={s.activityContent}>
            <span className={s.activityText}>{entry.text}</span>
            <span className={s.activityMeta}>· {relativeTime(entry.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
