import { CalendarDays } from "lucide-react";
import { Card, CardHead, CardEmpty } from "./Card";
import styles from "./BookingsList.module.css";

function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusLabel(event) {
  const raw = (event.appointmentStatus || "confirmed").toLowerCase();
  if (raw === "cancelled" || raw === "canceled") return { text: "Cancelled", cls: styles.statusRescheduled };
  if (raw === "showed" || raw === "confirmed" || raw === "new") return { text: "Booked", cls: styles.statusBooked };
  return { text: raw.charAt(0).toUpperCase() + raw.slice(1), cls: styles.statusRescheduled };
}

// `bookings` is null when there's no GHL calendar to check yet (not an
// error, not zero) - `undefined`/missing entirely never happens, callers
// always pass an array or null.
export function BookingsList({ bookings }) {
  return (
    <Card>
      <CardHead title="Bookings today" icon={CalendarDays} meta={bookings?.length ? `${bookings.length} scheduled` : undefined} />

      {bookings === null ? (
        <CardEmpty
          icon={CalendarDays}
          title="No calendar connected yet"
          body="Once your calendar's connected, today's bookings will show up here."
        />
      ) : bookings.length === 0 ? (
        <CardEmpty icon={CalendarDays} title="Nothing booked today yet" body="New bookings will land here the moment Miia locks one in." />
      ) : (
        <ul className={styles.list}>
          {bookings.map((b) => {
            const name = b.contactName || b.title || "Booking";
            const status = statusLabel(b);
            return (
              <li key={b.id} className={styles.row}>
                <div className={styles.rowLeft}>
                  <div className={styles.avatar}>{initials(name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <p className={styles.name}>{name}</p>
                    {b.title && b.contactName && <p className={styles.service}>{b.title}</p>}
                  </div>
                </div>
                <div className={styles.rowRight}>
                  <span className={styles.time}>{timeOf(b.startTime)}</span>
                  <span className={[styles.status, status.cls].join(" ")}>{status.text}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
