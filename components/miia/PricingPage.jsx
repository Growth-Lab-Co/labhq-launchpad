import { Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";
import { PricingCards } from "./PricingCards";
import { FaqAccordion } from "./FaqAccordion";
import { FAQ_ITEMS } from "./faq";
import { WHITE_GLOVE, FOUNDING_SPOTS } from "./plans";
import styles from "./pricing.module.css";

export function PricingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Reveal className={styles.intro}>
          <h1 className={styles.h1}>Simple pricing. No lock-in.</h1>
          <p>Pick the channels you need. Every plan includes AI usage, Australian compliance and setup support.</p>
        </Reveal>

        <div style={{ textAlign: "center" }}>
          <Reveal className={styles.foundingBanner} as="span">
            <Sparkles size={16} strokeWidth={2.5} />
            First {FOUNDING_SPOTS} customers: 20% off for life. $79, $199, $319.
          </Reveal>
        </div>

        <Reveal className={styles.cardsSection}>
          <PricingCards />
        </Reveal>

        <p className={styles.incGst}>All prices inc. GST.</p>

        <Reveal className={styles.whiteGlove}>
          <div className={styles.whiteGloveText}>
            <h3 className={styles.whiteGloveHeading}>{WHITE_GLOVE.name}</h3>
            <p className={styles.whiteGloveBody}>{WHITE_GLOVE.tagline}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={styles.whiteGlovePrice}>${WHITE_GLOVE.price}</div>
            <div className={styles.whiteGlovePriceNote}>one time</div>
          </div>
        </Reveal>

        <Reveal className={styles.guarantee}>
          <strong>Our guarantee.</strong> Better than voicemail in 30 days or that month is refunded.
        </Reveal>
      </div>

      <section className={styles.faqSection}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Frequently asked questions</h2>
          </Reveal>
          <Reveal delay={100} className={styles.faqWrap}>
            <FaqAccordion items={FAQ_ITEMS} />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
