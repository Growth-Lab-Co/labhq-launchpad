"use client";
import { useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { Card, CardEmpty } from "./Card";
import styles from "./ConversationsPageClient.module.css";
import bookingStyles from "./BookingsList.module.css";

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}
function dateTimeOf(iso) {
  return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function BookingsPageClient({ events }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("upcoming");

  const now = Date.now();
  const upcoming = (events || []).filter((e) => new Date(e.startTime).getTime() >= now).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const past = (events || []).filter((e) => new Date(e.startTime).getTime() < now).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  const list = tab === "upcoming" ? upcoming : past;
  const filtered = list.filter((b) => !query.trim() || (b.contactName || b.title || "").toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <h1 className={styles.heading}>Bookings</h1>

      {events !== null && (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {["upcoming", "past"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  minHeight: 44,
                  padding: "0 18px",
                  borderRadius: 10,
                  border: "1px solid var(--dash-border)",
                  background: tab === t ? "var(--dash-violet)" : "var(--dash-surface)",
                  color: tab === t ? "#fff" : "var(--dash-ink)",
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search bookings"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </>
      )}

      <Card style={{ marginTop: 20 }}>
        {events === null ? (
          <CardEmpty icon={CalendarDays} title="No calendar connected yet" body="Once your calendar's connected, upcoming and past bookings will show up here." />
        ) : filtered.length === 0 ? (
          <CardEmpty icon={CalendarDays} title={tab === "upcoming" ? "Nothing booked yet" : "No past bookings"} body={tab === "upcoming" ? "New bookings will land here the moment Miia locks one in." : undefined} />
        ) : (
          <ul className={bookingStyles.list}>
            {filtered.map((b) => {
              const name = b.contactName || b.title || "Booking";
              return (
                <li key={b.id} className={bookingStyles.row}>
                  <div className={bookingStyles.rowLeft}>
                    <div className={bookingStyles.avatar}>{initials(name)}</div>
                    <div style={{ minWidth: 0 }}>
                      <p className={bookingStyles.name}>{name}</p>
                      {b.title && b.contactName && <p className={bookingStyles.service}>{b.title}</p>}
                    </div>
                  </div>
                  <span className={bookingStyles.time}>{dateTimeOf(b.startTime)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
