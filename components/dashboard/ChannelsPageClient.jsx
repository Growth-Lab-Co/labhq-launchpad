"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Smartphone, AtSign, Phone, Check, Mail, X } from "lucide-react";
import { MIIA_CHANNEL_COPY } from "@/lib/channelWiring";
import styles from "./ChannelsPageClient.module.css";

const ICONS = { webchat: MessageCircle, sms: Smartphone, social: AtSign, phone: Phone };
const COPY_KEY = { webchat: "webchat", sms: "sms", social: "fb", phone: null };

function pillClass(status) {
  if (status === "live") return styles.pillLive;
  if (status === "connecting") return styles.pillUpgrade;
  if (status === "upgrade") return styles.pillUpgrade;
  return styles.pillNotStarted;
}
function pillLabel(status) {
  if (status === "live") return "Live";
  if (status === "connecting") return "Connecting";
  if (status === "upgrade") return "Upgrade";
  return "Not started";
}

function mailtoHref(businessName, snippet) {
  const subject = `Add our Miia chat widget to the website`;
  const body = [
    "Hi,",
    "",
    `Could you add this chat widget to ${businessName || "our"} website? It lets Miia (our AI front desk) answer visitors right on the site.`,
    "",
    "Paste this snippet right before the closing </body> tag, on every page you'd like it to appear:",
    "",
    snippet,
    "",
    "Thanks!",
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Always shows a real, working snippet once deployed - never an empty card
// (see lib/channelWiring.js websiteChatEmbedSnippet for why this can be
// generated deterministically, no GHL call needed). Fetches automatically
// so there's nothing for the customer to click to reveal it.
function EmbedSnippet({ tenantSlug, businessName }) {
  const [embed, setEmbed] = useState(undefined); // undefined = loading, null = not deployed yet
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/miia/dashboard/embed-snippet?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setEmbed(data.embed || null); })
      .catch(() => { if (!cancelled) setEmbed(null); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  if (embed === undefined) {
    return <p className={styles.detail} style={{ marginTop: 10 }}>Getting your embed code…</p>;
  }
  if (!embed) {
    return <p className={styles.detail} style={{ marginTop: 10 }}>Your embed code will appear here once setup finishes.</p>;
  }
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span className={styles.codeTitle}>Website chat widget</span>
        <div className={styles.codeHeadActions}>
          <a
            className={styles.connectBtn}
            href={mailtoHref(businessName, embed.snippet)}
          >
            <Mail size={14} /> Email this to my web person
          </a>
          <button
            type="button"
            className={styles.connectBtn}
            onClick={() => {
              navigator.clipboard?.writeText(embed.snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              "Copy"
            )}
          </button>
        </div>
      </div>
      <pre className={styles.pre}>{embed.snippet}</pre>
    </div>
  );
}

// Opens Leadsie's embedded access request so the business owner can grant
// Facebook/Instagram page access without leaving the dashboard - one
// Leadsie "connect request" reused for every tenant via customUserId.
// Granting access here is NOT the same as being live (see
// lib/leadsieConnections.js) - the "Connecting" pill above this button
// reflects that honestly once the webhook fires.
function LeadsieConnect({ tenantSlug, leadsieEmbedUrl }) {
  const [open, setOpen] = useState(false);

  if (!leadsieEmbedUrl) {
    return (
      <p className={styles.detail} style={{ marginTop: 10 }}>
        Facebook and Instagram connection isn&apos;t wired up yet on our end - ask your Miia team and we&apos;ll sort it.
      </p>
    );
  }

  const src = `${leadsieEmbedUrl}${leadsieEmbedUrl.includes("?") ? "&" : "?"}customUserId=${encodeURIComponent(tenantSlug)}`;

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.connectBtn} onClick={() => setOpen(true)}>
        Connect Facebook and Instagram
      </button>
      {open && (
        <div className={styles.modalOverlay} onClick={() => setOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.codeTitle}>Connect Facebook and Instagram</span>
              <button type="button" className={styles.modalClose} onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <iframe src={src} className={styles.modalFrame} title="Connect Facebook and Instagram" />
          </div>
        </div>
      )}
    </div>
  );
}

// "Connect your calendar" - no Google OAuth app exists anywhere in this
// codebase today (grepped before building this - confirmed, not assumed),
// so this can't be a real connect flow yet. Files an ops task instead of
// faking a connected state - see MORNING-REPORT.md for the exact blocker
// (a Google Cloud project + OAuth consent screen + client ID/secret all
// need to exist first, none of which do).
function CalendarConnectCard({ tenantSlug }) {
  const [state, setState] = useState("idle"); // idle | sending | sent
  async function requestSetup() {
    setState("sending");
    try {
      await fetch("/api/miia/dashboard/calendar-interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug }),
      });
      setState("sent");
    } catch {
      setState("idle");
    }
  }
  return (
    <div className={styles.row} style={{ marginTop: 16 }}>
      <div className={styles.rowHead}>
        <div className={styles.rowLeft}>
          <div>
            <p className={styles.name}>Calendar</p>
            <p className={styles.detail}>
              Google Calendar sync isn&apos;t wired up yet - tell us and we&apos;ll set it up with you directly. Outlook is on our roadmap.
            </p>
          </div>
        </div>
        <span className={[styles.pill, styles.pillNotStarted].join(" ")}>
          <span className={styles.pillDot} />
          Not started
        </span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.connectBtn} onClick={requestSetup} disabled={state !== "idle"}>
          {state === "sent" ? (
            <>
              <Check size={14} /> We'll be in touch
            </>
          ) : state === "sending" ? (
            "Sending…"
          ) : (
            "Connect your calendar"
          )}
        </button>
      </div>
    </div>
  );
}

// Cliniko: real connect flow - pastes an API key, validated live against
// Cliniko itself (app/api/miia/dashboard/practice-integration). Halaxy:
// honest stub - see HALAXY-FEASIBILITY.md for why it isn't real yet.
// `emphasise` (from tenant.practiceSoftware, set at intake) puts whichever
// one the business actually said they use first.
function PracticeIntegrationCard({ tenantSlug, practiceSoftware }) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [halaxyInterest, setHalaxyInterest] = useState(false);
  const [momenceInterest, setMomenceInterest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/miia/dashboard/practice-integration?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setConnection(data.connection || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  async function connectCliniko() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/miia/dashboard/practice-integration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, provider: "cliniko", apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't validate that key");
      setConnection({ provider: "cliniko", status: "connected", meta: data.meta });
      setApiKey("");
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function registerHalaxyInterest() {
    setHalaxyInterest(true);
    await fetch("/api/miia/dashboard/practice-integration", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantSlug, interest: "halaxy" }),
    }).catch(() => {});
  }

  async function registerMomenceInterest() {
    setMomenceInterest(true);
    await fetch("/api/miia/dashboard/practice-integration", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantSlug, interest: "momence" }),
    }).catch(() => {});
  }

  if (loading) return null;

  if (connection?.status === "connected" && connection.provider === "cliniko") {
    return (
      <div className={styles.row} style={{ marginTop: 16 }}>
        <div className={styles.rowHead}>
          <div className={styles.rowLeft}>
            <div>
              <p className={styles.name}>Practice software</p>
              <p className={styles.detail}>
                Connected to Cliniko{connection.meta?.businessName ? ` - ${connection.meta.businessName}` : ""}. Miia offers patients
                real available times from your actual diary - your team confirms each booking with one click.
              </p>
            </div>
          </div>
          <span className={[styles.pill, styles.pillLive].join(" ")}>
            <span className={styles.pillDot} />
            Connected
          </span>
        </div>
      </div>
    );
  }

  const clinikoFirst = practiceSoftware !== "halaxy";
  const clinikoCard = (
    <div key="cliniko" className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span className={styles.codeTitle}>Cliniko</span>
      </div>
      <p className={styles.detail} style={{ marginBottom: 10 }}>
        Paste your Cliniko API key -{" "}
        <a href="https://help.cliniko.com/kb/api" target="_blank" rel="noreferrer">
          find it under My Info → API Keys
        </a>
        .
      </p>
      <div className={styles.linkRowInline}>
        <input
          type="password"
          className={styles.linkInput}
          placeholder="Cliniko API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button type="button" className={styles.connectBtn} onClick={connectCliniko} disabled={connecting || !apiKey.trim()}>
          {connecting ? "Validating…" : "Connect"}
        </button>
      </div>
      {error && <p className={styles.linkError}>{error}</p>}
    </div>
  );
  const halaxyCard = (
    <div key="halaxy" className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span className={styles.codeTitle}>Halaxy</span>
      </div>
      <p className={styles.detail} style={{ marginBottom: 10 }}>
        Halaxy integration: in progress - register your interest and we&apos;ll notify you. Halaxy requires the
        clinic&apos;s own API add-on (~$33/month from Halaxy) before we can connect, on top of your existing Halaxy
        subscription.
      </p>
      <button type="button" className={styles.connectBtn} onClick={registerHalaxyInterest} disabled={halaxyInterest}>
        {halaxyInterest ? (
          <>
            <Check size={14} /> Noted
          </>
        ) : (
          "Register interest"
        )}
      </button>
    </div>
  );
  // Momence serves studios (gyms, pilates, yoga) rather than clinics - a
  // different business category to Cliniko/Halaxy, but the same honest
  // "register interest, file an ops note" stub (job 3, 2026-07-29) since
  // no Momence adapter exists yet either.
  const momenceCard = (
    <div key="momence" className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span className={styles.codeTitle}>Momence</span>
      </div>
      <p className={styles.detail} style={{ marginBottom: 10 }}>
        Run a studio - gym, pilates, yoga? Momence integration: in progress - register your interest and we&apos;ll
        notify you.
      </p>
      <button type="button" className={styles.connectBtn} onClick={registerMomenceInterest} disabled={momenceInterest}>
        {momenceInterest ? (
          <>
            <Check size={14} /> Noted
          </>
        ) : (
          "Register interest"
        )}
      </button>
    </div>
  );

  return (
    <div className={styles.row} style={{ marginTop: 16 }}>
      <div className={styles.rowHead}>
        <div className={styles.rowLeft}>
          <div>
            <p className={styles.name}>Practice software</p>
            <p className={styles.detail}>
              Connect Cliniko and Miia offers patients real available times from your actual diary - your team
              confirms each booking with one click.
            </p>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {clinikoFirst ? [clinikoCard, halaxyCard, momenceCard] : [halaxyCard, clinikoCard, momenceCard]}
      </div>
    </div>
  );
}

export function ChannelsPageClient({ tenantSlug, channels, businessName, showPracticeCards, practiceSoftware, leadsieEmbedUrl }) {
  return (
    <>
      <h1 className={styles.heading}>Channels</h1>
      <div className={styles.grid}>
        {channels.map((c) => {
          const Icon = ICONS[c.id] || MessageCircle;
          const live = c.status === "live";
          const copyKey = COPY_KEY[c.id];
          const detail = c.hint || (copyKey && MIIA_CHANNEL_COPY[copyKey]);
          return (
            <div key={c.id} className={styles.row}>
              <div className={styles.rowHead}>
                <div className={styles.rowLeft}>
                  <div className={[styles.iconWrap, live ? styles.iconLive : styles.iconOff].join(" ")}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p className={styles.name}>{c.label}</p>
                    {detail && <p className={styles.detail}>{detail}</p>}
                  </div>
                </div>
                <span className={[styles.pill, pillClass(c.status)].join(" ")}>
                  <span className={styles.pillDot} />
                  {pillLabel(c.status)}
                </span>
              </div>

              {c.id === "webchat" && <EmbedSnippet tenantSlug={tenantSlug} businessName={businessName} />}
              {c.id === "social" && !live && c.status !== "upgrade" && (
                <LeadsieConnect tenantSlug={tenantSlug} leadsieEmbedUrl={leadsieEmbedUrl} />
              )}
            </div>
          );
        })}
      </div>

      <CalendarConnectCard tenantSlug={tenantSlug} />
      {showPracticeCards && <PracticeIntegrationCard tenantSlug={tenantSlug} practiceSoftware={practiceSoftware} />}
    </>
  );
}
