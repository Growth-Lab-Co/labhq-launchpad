import { statusBadgeConfig } from "./statusHelpers";
import s from "./StatusBadge.module.css";

export function StatusBadge({ status }) {
  const c = statusBadgeConfig(status);
  return (
    <div className={s.badge} style={{ background: c.bg }}>
      <div className={s.dot} style={{ background: c.dot }} />
      <span className={s.label} style={{ color: c.text }}>
        {status}
      </span>
    </div>
  );
}
