import { Activity } from "lucide-react";
import { Card, CardEmpty } from "./Card";
import { customerActivityEntry, timeAgo } from "./activityCopy";
import styles from "./ActivityFeed.module.css";
import cardStyles from "./Card.module.css";

export function ActivityFeed({ entries }) {
  const rows = (entries || []).map(customerActivityEntry);
  return (
    <Card>
      <div className={cardStyles.cardHead}>
        <span className={cardStyles.cardTitle}>Live activity</span>
        {rows.length > 0 && (
          <span className={styles.liveTag}>
            <span className={styles.liveDot} /> Live
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <CardEmpty icon={Activity} title="Nothing to show yet" body="As Miia answers enquiries and books appointments, it'll show up here." />
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.id} className={styles.row}>
                <div className={styles.iconWrap}>
                  <Icon size={15} strokeWidth={2} />
                </div>
                <p className={styles.text}>
                  {r.text}
                  <span className={styles.time}>{timeAgo(r.createdAt)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
