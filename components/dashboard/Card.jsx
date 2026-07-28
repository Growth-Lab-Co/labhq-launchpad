import { TwoDots } from "./TwoDots";
import styles from "./Card.module.css";

export function Card({ children, className = "", style }) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")} style={style}>
      {children}
    </section>
  );
}

export function CardHead({ title, icon: Icon, badge, meta }) {
  return (
    <div className={styles.cardHead}>
      <div className={styles.cardHeadLeft}>
        {Icon && <Icon size={18} style={{ color: "var(--dash-violet)" }} />}
        <span className={styles.cardTitle}>{title}</span>
        {badge}
      </div>
      {meta && <span className={styles.cardMeta}>{meta}</span>}
    </div>
  );
}

// Two-dot pulse for loading, per the dashboard's honesty rules - no raw
// spinners anywhere on this product.
export function CardLoading({ label = "Loading" }) {
  return (
    <div className={styles.loading}>
      <TwoDots size="sm" pulse />
      {label}
    </div>
  );
}

export function CardEmpty({ icon: Icon, title, body, action }) {
  return (
    <div className={styles.empty}>
      {Icon && (
        <div className={styles.emptyIcon}>
          <Icon size={20} strokeWidth={2} />
        </div>
      )}
      <p className={styles.emptyTitle}>{title}</p>
      {body && <p className={styles.emptyBody}>{body}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

export function CardError({ body = "Couldn't load this right now.", onRetry }) {
  return (
    <div className={styles.errorBox}>
      <p className={styles.errorBody}>{body}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
