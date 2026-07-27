import { Reveal } from "./Reveal";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import {
  ChannelsVisual,
  IntakeVisual,
  BookingVisual,
  HandoffVisual,
  VoiceVisual,
  DashboardVisual,
} from "./FeatureVisuals";
import styles from "./features.module.css";

const FEATURES = [
  {
    heading: "Answers every channel",
    body: "Web chat, Facebook, Instagram and SMS, all answered by the same Miia. Connect a channel once and every message on it gets a reply in under a minute.",
    Visual: ChannelsVisual,
  },
  {
    heading: "Trained by conversation",
    body: "No settings to configure and no bot to script. Miia learns your business the way a new hire would, by talking it through with you.",
    Visual: IntakeVisual,
  },
  {
    heading: "Books real jobs",
    body: "Miia checks your actual calendar and locks in a time that works. No back and forth, no double bookings.",
    Visual: BookingVisual,
  },
  {
    heading: "Knows when to hand over",
    body: "The moment someone asks for a real person, or she can't help, Miia hands over immediately. You're never locked out of your own conversations.",
    Visual: HandoffVisual,
  },
  {
    heading: "Answers the phone",
    body: "On the Complete plan, Miia answers your business number directly. Every call gets a summary, an outcome and a transcript.",
    Visual: VoiceVisual,
  },
  {
    heading: "You stay in control",
    body: "See her status, send a test message, and watch usage against your plan, all from one dashboard. Nothing happens without you seeing it.",
    Visual: DashboardVisual,
  },
];

export function FeaturesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Reveal className={styles.intro}>
          <span className={`eyebrowPill ${styles.introEyebrow}`}>What Miia does</span>
          <h1 className={styles.h1}>Everything a great front desk does. None of the overheads.</h1>
          <p>Six things Miia handles the moment she goes live, in your voice, on the channels your customers already use.</p>
        </Reveal>

        {FEATURES.map((feature, i) => (
          <div key={feature.heading} className={[styles.featureRow, i % 2 === 1 ? styles.featureRowReverse : ""].join(" ")}>
            <Reveal className={styles.featureText}>
              <div className={styles.featureNum}>{String(i + 1).padStart(2, "0")}</div>
              <h2 className={styles.featureHeading}>{feature.heading}</h2>
              <p className={styles.featureBody}>{feature.body}</p>
            </Reveal>
            <Reveal delay={120} className={styles.featureVisual}>
              <feature.Visual />
            </Reveal>
          </div>
        ))}

        <Reveal className={styles.finalCta}>
          <h2 className={styles.finalCtaHeading}>See all of this running on your business in 10 minutes.</h2>
          <Button href="/get-started" variant="onDark">
            {PRIMARY_CTA_LABEL}
          </Button>
        </Reveal>
      </div>
    </div>
  );
}
