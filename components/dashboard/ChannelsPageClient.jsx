"use client";
import { useState } from "react";
import { MessageCircle, Smartphone, AtSign, Phone, Check } from "lucide-react";
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

function EmbedSnippet({ tenantSlug }) {
  const [embed, setEmbed] = useState(undefined); // undefined = not fetched, null = none available
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchEmbed() {
    setLoading(true);
    try {
      const res = await fetch(`/api/miia/dashboard/embed-snippet?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();
      setEmbed(data.embed || null);
    } catch {
      setEmbed(null);
    } finally {
      setLoading(false);
    }
  }

  if (embed === undefined) {
    return (
      <div className={styles.actions}>
        <button type="button" className={styles.connectBtn} onClick={fetchEmbed} disabled={loading}>
          {loading ? "Getting your code" : "Get embed code"}
        </button>
      </div>
    );
  }
  if (!embed) {
    return <p className={styles.detail} style={{ marginTop: 10 }}>Couldn&apos;t find a website form for this yet. Reach out and we&apos;ll sort it.</p>;
  }
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHead}>
        <span className={styles.codeTitle}>Website embed</span>
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
      <pre className={styles.pre}>{embed.snippet}</pre>
    </div>
  );
}

export function ChannelsPageClient({ tenantSlug, channels }) {
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

              {!live && c.id === "webchat" && <EmbedSnippet tenantSlug={tenantSlug} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
