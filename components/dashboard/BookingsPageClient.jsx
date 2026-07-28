"use client";
import { useState } from "react";
import { CalendarDays, Search, Check } from "lucide-react";
import { Card, CardEmpty } from "./Card";
import styles from "./ConversationsPageClient.module.css";
import bookingStyles from "./BookingsList.module.css";

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}
function dateTimeOf(iso) {
  return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Editable booking link (Cliniko, Halaxy, Calendly, whatever they use) - the
// bot offers this directly on booking intent (lib/bot.js), falling back to
// taking details when it's blank. Saves straight to the live deployment
// record, no redeploy needed.
function BookingLinkField({ tenantSlug, initialValue }) {
  const [value, setValue] = useState(initialValue || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/miia/dashboard/booking-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, bookingLink: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that");
      setValue(data.bookingLink || "");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ marginTop: 20 }}>
      <p className={bookingStyles.linkLabel}>Booking link</p>
      <p className={bookingStyles.linkHint}>
        Paste your Cliniko, Halaxy, Calendly or other booking link - Miia offers it directly when someone wants to book.
      </p>
      <div className={bookingStyles.linkRow}>
        <input
          type="url"
          className={bookingStyles.linkInput}
          placeholder="https://yourclinic.cliniko.com/bookings"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" className={bookingStyles.linkSaveBtn} onClick={save} disabled={saving}>
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            "Save"
          )}
        </button>
      </div>
      {error && <p className={bookingStyles.linkError}>{error}</p>}
    </Card>
  );
}

export function BookingsPageClient({ events, tenantSlug, showBookingLinkField, initialBookingLink }) {
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

      {showBookingLinkField && <BookingLinkField tenantSlug={tenantSlug} initialValue={initialBookingLink} />}

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
