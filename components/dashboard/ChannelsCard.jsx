import Link from "next/link";
import { MessageCircle, Smartphone, AtSign, Phone } from "lucide-react";
import { Card, CardHead } from "./Card";
import styles from "./ChannelsCard.module.css";

// Same icon choices as components/miia/FeatureVisuals.jsx's ChannelsVisual -
// lucide-react (this version) has no Facebook/Instagram brand icons.
const ICONS = { webchat: MessageCircle, sms: Smartphone, social: AtSign, phone: Phone };

export function ChannelsCard({ channels, base }) {
  const liveCount = channels.filter((c) => c.status === "live").length;
  const totalCount = channels.length;

  return (
    <Card>
      <CardHead title="Channels" meta={`${liveCount} of ${totalCount} live`} />
      <ul className={styles.list}>
        {channels.map((c) => {
          const Icon = ICONS[c.id] || Globe;
          const live = c.status === "live";
          return (
            <li key={c.id} className={styles.row}>
              <div className={styles.rowLeft}>
                <div className={[styles.iconWrap, live ? styles.iconLive : styles.iconOff].join(" ")}>
                  <Icon size={16} strokeWidth={2} />
                </div>
                <div>
                  <p className={[styles.name, live ? styles.nameLive : styles.nameOff].join(" ")}>{c.label}</p>
                  {c.hint && <p className={styles.hint}>{c.hint}</p>}
                </div>
              </div>
              <span className={[styles.statusPill, live ? styles.live : styles.notStarted].join(" ")}>
                <span className={styles.pillDot} />
                {live ? "Live" : c.status === "upgrade" ? "Upgrade" : "Not started"}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href={`${base}/channels`} style={{ display: "inline-block", marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--dash-violet)" }}>
        Manage channels
      </Link>
    </Card>
  );
}
