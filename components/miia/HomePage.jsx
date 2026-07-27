"use client";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import { Reveal, RiseHeadline, useInView } from "./Reveal";
import { OdometerNumber } from "./OdometerNumber";
import { ChatDemo } from "./ChatDemo";
import { Marquee } from "./Marquee";
import { NumberedSteps } from "./NumberedSteps";
import { Calculator } from "./Calculator";
import { FaqAccordion } from "./FaqAccordion";
import { PricingCards } from "./PricingCards";
import { FAQ_ITEMS, HOME_FAQ_IDS, faqByIds } from "./faq";
import { INDUSTRIES } from "./industries";
import styles from "./home.module.css";

const MARQUEE_ITEMS = ["MEET MIIA", "ANSWERS EVERYTHING", "BOOKS REAL JOBS", "SOUNDS LIKE YOU", "LIVE IN 48 HOURS"];

const STATS = [
  { value: 47, suffix: "hrs", label: "Average time before a business follows up a new lead" },
  { value: 5, prefix: "", suffix: "+", label: "Follow-ups needed to close 80% of sales. Most stop at two" },
  { value: 21, suffix: "x", label: "Higher conversion when contacted within 5 minutes" },
];

const STEPS = [
  {
    heading: "Have a chat",
    body: "Tell Miia about your business like you'd brief a new receptionist. Ten minutes, no forms.",
  },
  {
    heading: "She sets herself up",
    body: "Your whole system builds itself from that conversation. What used to take weeks happens while you make a coffee.",
  },
  {
    heading: "She starts working",
    body: "Every message answered in under a minute, real bookings in your calendar, and she hands over the moment someone needs the real you.",
  },
];

function StatItem({ stat }) {
  const [ref, inView] = useInView(0.4);
  return (
    <div className={styles.stat} ref={ref}>
      <div className={styles.statNumber}>
        <OdometerNumber value={stat.value} inView={inView} />
        <span className={styles.statSuffix}>{stat.suffix}</span>
      </div>
      <div className={styles.statLabel}>{stat.label}</div>
    </div>
  );
}

export function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1 className={styles.h1}>
                <RiseHeadline
                  parts={[{ text: "Meet " }, { text: "Miia.", accent: true }, { text: "Your new front desk." }]}
                  accentClassName={styles.accent}
                />
              </h1>
              <Reveal delay={420}>
                <p className={styles.heroSub}>
                  She answers your website chat, socials, texts and phone. Trained on your business in one 10
                  minute conversation. Live within 48 hours, answering day and night in your voice.
                </p>
              </Reveal>
              <Reveal delay={520}>
                <div className={styles.heroCtas}>
                  <Button href="/get-started">{PRIMARY_CTA_LABEL}</Button>
                  <Button href="#how-it-works" variant="outline">
                    See how she works
                  </Button>
                </div>
              </Reveal>
            </div>
            <Reveal delay={300} className={styles.heroDemoWrap}>
              <ChatDemo />
            </Reveal>
          </div>

          <div className={styles.statsRow}>
            {STATS.map((stat) => (
              <StatItem stat={stat} key={stat.label} />
            ))}
          </div>
          <Reveal>
            <p className={styles.statsClosing}>
              You don&apos;t need more leads. You need <span className={styles.accent}>Miia</span>.
            </p>
          </Reveal>
        </div>
      </section>

      <Marquee items={MARQUEE_ITEMS} />

      <section className={`${styles.section}`} id="how-it-works">
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Three steps. That&apos;s the whole system.</h2>
          </Reveal>
          <NumberedSteps steps={STEPS} />
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`} id="calculator">
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>What are missed enquiries costing you?</h2>
          </Reveal>
          <Reveal delay={100}>
            <Calculator />
          </Reveal>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Built for businesses that live on the phone</h2>
          </Reveal>
          <div className={styles.whoForGrid}>
            {INDUSTRIES.map((industry, i) => (
              <Reveal key={industry.slug} delay={i * 70} className={styles.whoForCardWrap}>
                <Link href={industry.path} className={styles.whoForCard}>
                  <h3 className={styles.whoForName}>{industry.name}</h3>
                  <p className={styles.whoForBody}>{industry.cardBody}</p>
                  <span className={styles.whoForLink}>
                    See how <ArrowRight size={15} strokeWidth={2.5} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.complianceCard}>
            <ShieldCheck size={32} strokeWidth={1.8} className={styles.complianceIcon} />
            <h2 className={styles.h2sm}>Compliant with Australian law. By default.</h2>
            <p className={styles.complianceBody}>
              AI disclosure, recording notices and opt-outs are built into every deployment, not bolted on. Miia
              always says she&apos;s an AI when asked. Compliance isn&apos;t an add-on here. It&apos;s the floor.
            </p>
          </Reveal>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.foundingCard}>
            <h2 className={styles.h2}>Be one of the first 20.</h2>
            <span className={styles.foundingBadge}>20% off forever</span>
            <p className={styles.foundingSub}>
              Founding pricing locks in for as long as you stay a customer. No catch, no time limit.
            </p>
            <div className={styles.foundingCards}>
              <PricingCards showCta={false} />
            </div>
            <Link href="/pricing" className={styles.foundingLink}>
              See full pricing and start a plan
            </Link>
          </Reveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Questions worth asking before you sign up</h2>
          </Reveal>
          <Reveal delay={100} className={styles.faqWrap}>
            <FaqAccordion items={faqByIds(HOME_FAQ_IDS).length ? faqByIds(HOME_FAQ_IDS) : FAQ_ITEMS} />
          </Reveal>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.container}>
          <Reveal>
            <h2 className={styles.finalCtaHeading}>Your 7:40pm enquiry deserves an answer.</h2>
            <Button href="/get-started" variant="onDark" className={styles.finalCtaBtn}>
              {PRIMARY_CTA_LABEL}
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
