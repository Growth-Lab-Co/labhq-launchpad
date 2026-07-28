"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Smartphone, AtSign, Phone, Check, Mail, X } from "lucide-react";
import { MIIA_CHANNEL_COPY } from "@/lib/channelWiring";
import styles from "./ChannelsPageClient.module.css";

// Set this to your Leadsie connect-request URL once one exists (Leadsie
// Dashboard -> your request -> "embed on your website" -> copy the page's
// URL, e.g. https://app.leadsie.com/connect/{agency}/{request}) - one
// request, reused for every tenant via ?customUserId=<tenantSlug> below, so
// each webhook call (app/api/leadsie-webhook/route.js) can be mapped back to
// the right tenant. Left blank until then - the button below shows an
// honest "not wired up yet" state rather than a broken iframe.
const LEADSIE_EMBED_URL = "";

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
function LeadsieConnect({ tenantSlug }) {
  const [open, setOpen] = useState(false);

  if (!LEADSIE_EMBED_URL) {
    return (
      <p className={styles.detail} style={{ marginTop: 10 }}>
        Facebook and Instagram connection isn&apos;t wired up yet on our end - ask your Miia team and we&apos;ll sort it.
      </p>
    );
  }

  const src = `${LEADSIE_EMBED_URL}${LEADSIE_EMBED_URL.includes("?") ? "&" : "?"}customUserId=${encodeURIComponent(tenantSlug)}`;

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

export function ChannelsPageClient({ tenantSlug, channels, businessName }) {
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
              {c.id === "social" && !live && <LeadsieConnect tenantSlug={tenantSlug} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
