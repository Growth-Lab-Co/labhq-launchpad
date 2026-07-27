import { Check, MessageCircle, MessageSquare, AtSign, Smartphone, Clock, User, Sparkles } from "lucide-react";
import styles from "./features.module.css";

export function ChannelsVisual() {
  const rows = [
    { icon: MessageCircle, label: "Website chat", msg: "Are you open Sundays?" },
    { icon: MessageSquare, label: "Facebook", msg: "Do you do quotes over messenger?" },
    { icon: AtSign, label: "Instagram", msg: "Saw your reel, how much for a full colour?" },
    { icon: Smartphone, label: "SMS", msg: "Running late, can you still fit me in?" },
  ];
  return (
    <div className={styles.visualCard}>
      {rows.map((row) => (
        <div className={styles.channelRow} key={row.label}>
          <div className={styles.channelIcon}>
            <row.icon size={16} strokeWidth={2.2} />
          </div>
          <div className={styles.channelText}>
            <div className={styles.channelLabel}>{row.label}</div>
            <div className={styles.channelMsg}>{row.msg}</div>
          </div>
          <Check size={16} strokeWidth={2.5} className={styles.channelCheck} />
        </div>
      ))}
    </div>
  );
}

export function IntakeVisual() {
  return (
    <div className={styles.visualCard}>
      <div className={styles.intakeThread}>
        <div className={styles.intakeBubbleMiia}>What's the name of your business, and what do you do?</div>
        <div className={styles.intakeBubbleUser}>Coastal Electrical, we do residential and light commercial</div>
        <div className={styles.intakeBubbleMiia}>Perfect. What hours do you take emergency call outs?</div>
        <div className={styles.intakeTyping}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function BookingVisual() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className={styles.visualCard}>
      <div className={styles.calendarHead}>
        <span>This week</span>
      </div>
      <div className={styles.calendarGrid}>
        {days.map((d, i) => (
          <div className={styles.calendarCol} key={d}>
            <div className={styles.calendarDay}>{d}</div>
            {i === 2 ? (
              <div className={styles.calendarSlotBooked}>
                <Check size={12} strokeWidth={3} />
                2:00pm
              </div>
            ) : (
              <div className={styles.calendarSlotOpen} />
            )}
          </div>
        ))}
      </div>
      <div className={styles.calendarNote}>Booked by Miia · Wed 2:00pm</div>
    </div>
  );
}

export function HandoffVisual() {
  return (
    <div className={styles.visualCard}>
      <div className={styles.intakeThread}>
        <div className={styles.intakeBubbleUser}>This is urgent, can I just talk to someone?</div>
        <div className={styles.intakeBubbleMiia}>Of course, connecting you now. I've flagged this as urgent.</div>
        <div className={styles.handoffBadge}>
          <User size={13} strokeWidth={2.5} />
          Handed to Sam · 4 seconds ago
        </div>
      </div>
    </div>
  );
}

export function VoiceVisual() {
  return (
    <div className={styles.visualCard}>
      <div className={styles.voiceCallBar}>
        <span className={styles.voiceDotLive} />
        Live call · 01:42
      </div>
      <div className={styles.voiceWave} aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ "--i": i }} />
        ))}
      </div>
      <div className={styles.voiceSummary}>
        <div className={styles.voiceSummaryRow}>
          <Clock size={14} strokeWidth={2.2} />
          <span>Duration 1m 42s</span>
        </div>
        <div className={styles.voiceSummaryRow}>
          <Check size={14} strokeWidth={2.5} />
          <span>Booked for Thursday 10am</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardVisual() {
  return (
    <div className={styles.visualCard}>
      <div className={styles.dashTop}>
        <span className={styles.dashStatus}>
          <span className={styles.dashStatusDot} /> Live
        </span>
        <span className={styles.dashTestBtn}>
          <Sparkles size={13} strokeWidth={2.2} /> Send test message
        </span>
      </div>
      <div className={styles.dashUsageLabel}>Replies this month</div>
      <div className={styles.dashUsageBar}>
        <div className={styles.dashUsageFill} style={{ width: "42%" }} />
      </div>
      <div className={styles.dashUsageValue}>420 / 1,500</div>
    </div>
  );
}
