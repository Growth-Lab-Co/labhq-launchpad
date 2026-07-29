import { Check, MessageSquare } from "lucide-react";
import { Card, CardEmpty } from "./Card";
import { TestChat } from "./TestChat";
import styles from "./ConversationHero.module.css";
import cardStyles from "./Card.module.css";

function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const isToday = new Date().toDateString() === d.toDateString();
  return isToday ? `${time} today` : `${time} ${d.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

export function ConversationHero({ conversation, tenantSlug, widgetKey, base }) {
  if (!conversation) {
    return (
      <Card>
        <CardEmpty
          icon={MessageSquare}
          title="No conversations yet"
          body="Miia's ready. Try her yourself and see how she sounds."
        />
        <TestChat tenantSlug={tenantSlug} widgetKey={widgetKey} triggerClassName={styles.primaryBtn} />
      </Card>
    );
  }

  const chronological = (conversation.messages || []).slice(0, 2).reverse();

  return (
    <Card>
      <div className={cardStyles.cardHead}>
        <div className={cardStyles.cardHeadLeft}>
          <span className={cardStyles.cardTitle}>Latest conversation</span>
          {conversation.type && <span className={styles.badge}>{conversation.type}</span>}
        </div>
        <span className={styles.meta}>{timeLabel(conversation.dateUpdated)}</span>
      </div>

      {chronological.length > 0 ? (
        <div className={styles.bubbles}>
          {chronological.map((m, i) => (
            <div key={i} className={m.direction === "outbound" ? styles.bubbleOut : styles.bubbleIn}>
              {m.body}
            </div>
          ))}
          <div className={styles.statusRow}>
            <span className={styles.statusText}>Delivered</span>
            <Check size={14} style={{ color: "var(--dash-violet)" }} strokeWidth={3} />
          </div>
        </div>
      ) : (
        <p className={styles.meta} style={{ marginTop: 16 }}>
          {conversation.lastMessageBody || `A conversation with ${conversation.contactName || "a customer"} is open.`}
        </p>
      )}

      <div className={styles.actions}>
        <a href={`${base}/conversations`} className={styles.primaryBtn}>
          <MessageSquare size={16} /> View conversation
        </a>
      </div>
      <TestChat tenantSlug={tenantSlug} widgetKey={widgetKey} triggerClassName={styles.secondaryBtn} />
    </Card>
  );
}
