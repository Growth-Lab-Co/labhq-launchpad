"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Smartphone, AtSign, Phone, Check, Mail } from "lucide-react";
import { MIIA_CHANNEL_COPY } from "@/lib/channelWiring";
import styles from "./ChannelsPageClient.module.css";

const ICONS = { webchat: MessageCircle, sms: Smartphone, social: AtSign, phone: Phone };
const COPY_KEY = { webchat: "webchat", sms: "sms", social: "fb", phone: null };

function pillClass(status) {
  if (status === "live") return styles.pillLive;
  if (status === "upgrade") return styles.pillUpgrade;
  return styles.pillNotStarted;
}
function pillLabel(status) {
  if (status === "live") return "Live";
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
            </div>
          );
        })}
      </div>
    </>
  );
}
