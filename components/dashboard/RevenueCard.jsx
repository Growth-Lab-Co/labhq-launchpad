import { Sparkles } from "lucide-react";
import styles from "./RevenueCard.module.css";

function formatCurrency(n) {
  return "$" + Math.round(n).toLocaleString("en-AU");
}

// Renders only when both inputs are real: after-hours bookings this month
// AND an average appointment/job value from intake. The second one is never
// captured by the current intake (lib/questions.js has no such field), so
// this card is structurally correct but will not render for any tenant
// today - see the dashboard commit's NOTES list.
export function RevenueCard({ afterHoursBookingsThisMonth, avgAppointmentValue }) {
  if (afterHoursBookingsThisMonth == null || avgAppointmentValue == null) return null;

  const amount = afterHoursBookingsThisMonth * avgAppointmentValue;

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>
        <Sparkles size={15} />
        Revenue protected this month
      </div>
      <p className={styles.amount}>{formatCurrency(amount)}</p>
      <p className={styles.body}>in after-hours bookings Miia caught</p>
      <p className={styles.footnote}>Estimated, based on your average appointment value.</p>
    </div>
  );
}
