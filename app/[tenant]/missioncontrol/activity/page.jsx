"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import { relativeTime } from "@/components/missioncontrol/statusHelpers";
import s from "./activity.module.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "deployment", label: "Deployments" },
  { id: "go-live", label: "Go-lives" },
];

const TYPE_COLOR = {
  attention: "#EF4444",
  "go-live": "#22C55E",
  deployment: "#7C4DFF",
  setup: "#F59E0B",
  general: "#9CA3AF",
};

function dateGroupLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const isSameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ActivityPage() {
  const { slug, activity, markActivitySeen } = useMissionControl();
  const [filter, setFilter] = useState("all");
  const base = `/${slug}/missioncontrol`;

  useEffect(() => {
    markActivitySeen();
  }, [markActivitySeen]);

  const filtered = useMemo(() => {
    if (!activity) return [];
    if (filter === "all") return activity;
    return activity.filter((e) => e.type === filter);
  }, [activity, filter]);

  const grouped = useMemo(() => {
    const groups = [];
    const index = new Map();
    for (const entry of filtered) {
      const label = dateGroupLabel(entry.createdAt);
      if (!index.has(label)) {
        index.set(label, []);
        groups.push(label);
      }
      index.get(label).push(entry);
    }
    return groups.map((label) => ({ label, entries: index.get(label) }));
  }, [filtered]);

  return (
    <>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Activity</h1>
          <p className={s.subtitle}>Everything that happened across all clients.</p>
        </div>
      </div>

      <div className={s.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`${s.filterPill} ${filter === f.id ? s.filterPillActive : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={s.feed}>
        {activity === null ? (
          <p className={s.muted}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className={s.emptyState}>
            <p className={s.muted}>No entries match this filter.</p>
          </div>
        ) : (
          grouped.map(({ label, entries }) => (
            <div key={label} className={s.dateGroup}>
              <p className={s.dateGroupLabel}>{label}</p>
              <div className={s.dateGroupBody}>
                {entries.map((entry) => (
                  <div key={entry.id} className={s.entryRow}>
                    <div className={s.entryDot} style={{ background: TYPE_COLOR[entry.type] || TYPE_COLOR.general }} />
                    <div className={s.entryContent}>
                      <div className={s.entryLine}>
                        {entry.deploymentId ? (
                          <Link href={`${base}/clients/${entry.deploymentId}`} className={s.entryClient}>
                            {entry.businessName || "Unnamed business"}
                          </Link>
                        ) : (
                          <span className={s.entryClient}>{entry.businessName || "Unnamed business"}</span>
                        )}
                        <span className={s.entryText}>— {entry.text}</span>
                      </div>
                      <span className={s.entryTime}>{relativeTime(entry.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
