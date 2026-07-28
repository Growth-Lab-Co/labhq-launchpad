import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import { Reveal, RiseHeadline } from "./Reveal";
import { ChatDemo } from "./ChatDemo";
import { NumberedSteps } from "./NumberedSteps";
import { FaqAccordion } from "./FaqAccordion";
import { INDUSTRIES } from "./industries";
import styles from "./industry.module.css";

// "audienceSingular" (e.g. "trade", "salon", "law firm") is what reads
// naturally in "a ___ business" / "___ businesses ask" phrasing - the
// plural display name (e.g. "Tradies", "Salons") doesn't, since stacking it
// straight into those templates produces double plurals ("a tradies
// business", "salons businesses ask") and article mismatches.
function article(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export function IndustryPage({ industry }) {
  const others = INDUSTRIES.filter((i) => i.slug !== industry.slug);
  const who = industry.audienceSingular;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.eyebrow}>For {industry.name.toLowerCase()}</span>
              <h1 className={styles.h1}>
                <RiseHeadline
                  parts={[{ text: "Miia for " }, { text: industry.name, accent: true }]}
                  accentClassName={styles.accent}
                />
              </h1>
              <Reveal delay={420}>
                <p className={styles.heroSub}>{industry.heroSub}</p>
              </Reveal>
              <Reveal delay={520}>
                <div className={styles.heroCtas}>
                  <Button href="/pricing">{PRIMARY_CTA_LABEL}</Button>
                  <Button href="/how-it-works" variant="outline">
                    See how she works
                  </Button>
                </div>
              </Reveal>
            </div>
            <Reveal delay={300} className={styles.heroDemoWrap}>
              <ChatDemo exchange={industry.chat} />
            </Reveal>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>What running {article(who)} {who} business on the phone actually looks like</h2>
          </Reveal>
          <NumberedSteps steps={industry.painPoints} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.linkOut}>
            <p className={styles.linkOutBody}>
              Miia answers every channel, books straight into your calendar and hands over the moment someone needs
              you. See exactly what she does, or check pricing for {who} businesses your size.
            </p>
            <div className={styles.linkOutRow}>
              <Link href="/features" className="eyebrowPill">
                See all features <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <Link href="/pricing" className="eyebrowPill">
                View pricing <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Questions {who} businesses ask</h2>
          </Reveal>
          <Reveal delay={100} className={styles.faqWrap}>
            <FaqAccordion items={industry.faq} />
          </Reveal>
        </div>
      </section>

      <section className={styles.otherIndustries}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Miia for other industries</h2>
          </Reveal>
          <div className={styles.otherGrid}>
            {others.map((o) => (
              <Link key={o.slug} href={o.path} className={styles.otherCard}>
                {o.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.container}>
          <Reveal>
            <h2 className={styles.finalCtaHeading}>
              Ready for {who} enquiries to answer themselves?
            </h2>
            <Button href="/pricing" variant="onDark">
              {PRIMARY_CTA_LABEL}
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
