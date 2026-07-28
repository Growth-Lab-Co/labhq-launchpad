import { Button } from "./Button";
import { Reveal, RiseHeadline } from "./Reveal";
import { ChatDemo } from "./ChatDemo";
import { NumberedSteps } from "./NumberedSteps";
import { Calculator } from "./Calculator";
import { FaqAccordion } from "./FaqAccordion";
import styles from "./alliedHealth.module.css";

const HERO_CTA_LABEL = "Be one of the first 20 clinics";
// Carries the signup-source healthcare trigger through to checkout - see
// lib/guardrails.js HEALTH_VERTICAL_SLUGS and lib/miiaProvisioning.js.
const GET_STARTED_HREF = "/get-started?vertical=allied-health";

const CHAT_EXCHANGE = {
  customer: {
    text: "hi, do you have anything tomorrow morning for a knee assessment? and roughly how much?",
    time: "4:52 pm",
  },
  reply: {
    text: "We do. 9:15am or 10:30am are both free. Initial assessments are $95 for 45 minutes. Want me to lock one in?",
    time: "4:53 pm",
  },
};

const STATS = [
  { value: "$55,000+", label: "what a receptionist costs a year, and she goes home at five" },
  { value: "After hours", label: "when most new patients actually search and enquire" },
  { value: "5+", label: "contacts it takes to win a patient who didn't get through first time" },
];

const PAIN_POINTS = [
  {
    heading: "New patients enquire after hours",
    body: "Most people search for a physio or dentist at night or on a lunch break. Miia is there when your reception isn't.",
  },
  {
    heading: "Reception is buried in admin",
    body: "Bookings, reschedules and health fund questions all land on Miia first, so your team can focus on the patient in the room.",
  },
  {
    heading: "No-shows cost real money",
    body: "Miia confirms bookings and handles reschedules the moment a patient asks, keeping your calendar full.",
  },
];

const FAQ = [
  {
    q: "Can Miia answer Medicare and health fund questions?",
    a: "She answers the logistics you teach her: what needs a referral, what to bring, how billing works at your clinic. She never guesses at rebates or entitlements. Anything she hasn't been taught gets a warm handoff to your team.",
  },
  {
    q: "What happens when a patient asks something clinical?",
    a: "Miia steps aside immediately: \"That's one for the team, I'll have them get back to you today. Meanwhile, want me to book you in?\" Your team gets the message straight away.",
  },
  {
    q: "How does booking work?",
    a: "Your choice: Miia books into her calendar and your team confirms, or she shares your existing online booking link. Practice software integration is on the roadmap.",
  },
  {
    q: "What about existing patients?",
    a: "She confirms, reschedules and answers logistics for existing patients too, and recognises when someone needs the front desk proper.",
  },
  {
    q: "How much work is setup for a busy practice?",
    a: "One 10 minute chat, done by you or your practice manager, any time. Then a couple of clicks to connect your channels. Web chat answers the same day.",
  },
];

export function AlliedHealthPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.h1}>
                <RiseHeadline
                  parts={[{ text: "The front desk your clinic never had to " }, { text: "hire", accent: true }]}
                  accentClassName={styles.accent}
                />
              </h1>
              <Reveal delay={420}>
                <p className={styles.heroSub}>
                  Miia answers your calls, texts, DMs and website chat day and night, books appointments, and hands
                  anything clinical straight to your team. Live within 48 hours.
                </p>
              </Reveal>
              <Reveal delay={520}>
                <div className={styles.heroCtas}>
                  <Button href={GET_STARTED_HREF}>{HERO_CTA_LABEL}</Button>
                  <Button href="/how-it-works" variant="outline">
                    See how she works
                  </Button>
                </div>
              </Reveal>
            </div>
            <Reveal delay={300} className={styles.heroDemoWrap}>
              <ChatDemo exchange={CHAT_EXCHANGE} />
            </Reveal>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.statsRow}>
            {STATS.map((stat) => (
              <div className={styles.stat} key={stat.label}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>What running a clinic on the phone actually looks like</h2>
          </Reveal>
          <NumberedSteps steps={PAIN_POINTS} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>What are missed calls costing your clinic?</h2>
          </Reveal>
          <Reveal delay={100}>
            <Calculator
              missedLabel="Missed or unanswered calls per week"
              missedDefault={5}
              missedMax={100}
              periodsPerMonth={52 / 12}
              valueLabel="Average appointment value"
              valueMin={50}
              valueMax={500}
              valueStep={5}
              valueDefault={95}
            />
          </Reveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.trustCard}>
            <span className={`eyebrowPill ${styles.trustEyebrow}`}>Built for clinics</span>
            <h2 className={styles.trustHeading}>Miia never gives clinical advice. Ever.</h2>
            <p className={styles.trustBody}>
              Questions about symptoms, treatment or medication go straight to your team, every time. It&apos;s hard
              coded, not a setting. Miia handles the front desk: bookings, prices, directions, what to bring, and the
              questions you&apos;ve taught her the answers to. She always discloses she&apos;s AI, and privacy and
              recording notices are built into every deployment.
            </p>
          </Reveal>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.bookingCard}>
            <h2 className={styles.bookingHeading}>How booking works</h2>
            <p className={styles.bookingBody}>
              Miia books into her own calendar or shares your online booking link, your choice. Direct integration
              with practice software like Cliniko is on our roadmap, and we&apos;ll say so plainly until it ships.
            </p>
          </Reveal>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>Questions clinics ask</h2>
          </Reveal>
          <Reveal delay={100} className={styles.faqWrap}>
            <FaqAccordion items={FAQ} />
          </Reveal>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.container}>
          <Reveal>
            <h2 className={styles.finalCtaHeading}>The 5:40pm enquiry deserves an answer.</h2>
            <p className={styles.finalCtaFounding}>
              Be one of the first 20 founding clinics. 20% off, locked in for life.
            </p>
            <Button href={GET_STARTED_HREF} variant="onDark">
              {HERO_CTA_LABEL}
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

export { FAQ as ALLIED_HEALTH_FAQ };
