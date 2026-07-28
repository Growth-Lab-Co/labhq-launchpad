"use client";
import { MessageSquare, CalendarCheck, Clock, Radio, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useCountUp } from "./useCountUp";
import styles from "./StatGrid.module.css";

// Trend chip only renders when both today and yesterday are real numbers -
// never inferred from one side missing. `betterWhen` says which direction
// counts as good (more conversations/bookings is good; a shorter reply time
// is good, i.e. "down" is good there).
function trendFor(today, yesterday, betterWhen) {
  if (today == null || yesterday == null || yesterday === 0) return null;
  const deltaPct = Math.round(((today - yesterday) / yesterday) * 100);
  if (deltaPct === 0) return null;
  const dir = deltaPct > 0 ? "up" : "down";
  const good = betterWhen === dir;
  return { dir, good, text: `${deltaPct > 0 ? "+" : ""}${deltaPct}%` };
}

function StatCard({ label, value, suffix, icon: Icon, trend, delay, formatValue }) {
  const animated = useCountUp(value, 900 + delay);
  const display = formatValue ? formatValue(animated) : `${Math.round(animated)}${suffix || ""}`;

  return (
    <div className={styles.card} style={{ animationDelay: `${delay}ms` }}>
      <div className={styles.cardTop}>
        <div className={styles.iconWrap}>
          <Icon size={18} strokeWidth={2} />
        </div>
        {trend && (
          <span className={[styles.trend, trend.good ? styles.trendGood : styles.trendBad].join(" ")}>
            {trend.dir === "up" ? <ArrowUpRight size={13} strokeWidth={2.5} /> : <ArrowDownRight size={13} strokeWidth={2.5} />}
            {trend.text}
          </span>
        )}
      </div>
      <p className={styles.value}>{display}</p>
      <p className={styles.label}>{label}</p>
    </div>
  );
}

// `avgReplyMsToday/Yesterday` are raw milliseconds so this component owns
// the seconds formatting and the trend math consistently.
export function StatGrid({ stats }) {
  const {
    conversationsToday,
    conversationsYesterday,
    bookingsToday,
    bookingsYesterday,
    avgReplyMsToday,
    avgReplyMsYesterday,
    channelsLiveCount,
    channelsCap,
  } = stats;

  const avgReplySecToday = avgReplyMsToday != null ? Math.round(avgReplyMsToday / 1000) : null;
  const avgReplySecYesterday = avgReplyMsYesterday != null ? Math.round(avgReplyMsYesterday / 1000) : null;

  // Rule 1: an element that can't be computed from real data does not
  // render - filtered here, not shown as a dash-in-a-box placeholder.
  const cards = [
    {
      label: "Conversations today",
      value: conversationsToday,
      icon: MessageSquare,
      trend: trendFor(conversationsToday, conversationsYesterday, "up"),
    },
    {
      label: "Bookings made",
      value: bookingsToday,
      icon: CalendarCheck,
      trend: trendFor(bookingsToday, bookingsYesterday, "up"),
    },
    {
      label: "Avg reply time",
      value: avgReplySecToday,
      suffix: "s",
      icon: Clock,
      trend: trendFor(avgReplySecToday, avgReplySecYesterday, "down"),
    },
    {
      label: "Channels live",
      value: channelsLiveCount,
      icon: Radio,
      formatValue: (animated) => `${Math.round(animated)} of ${channelsCap}`,
    },
  ].filter((c) => c.value != null);

  if (!cards.length) {
    return (
      <div className={styles.emptyGrid}>
        <p>Your stats will show up here once Miia starts answering enquiries.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {cards.map((c, i) => (
        <StatCard key={c.label} {...c} delay={i * 70} />
      ))}
    </div>
  );
}
