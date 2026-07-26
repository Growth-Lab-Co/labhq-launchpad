import { Check } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Reveal } from "./Reveal";
import styles from "./landing.module.css";

// Set these two before launch - nothing else in this file needs editing.
export const VIDEO_URL = "#";
export const STRIPE_LINK = "#";

const STATS = [
  { number: "10 minutes", label: "from intake chat to deployed account" },
  { number: "Under a minute", label: "from enquiry to AI reply on a connected channel" },
  { number: "2 to 3 weeks", label: "what onboarding used to take your team" },
];

const HOW_IT_WORKS = [
  {
    heading: "Your client chats",
    body: "They click your branded link and answer questions in a friendly AI interview. Services, hours, pricing, tone of voice. No forms, no logins.",
  },
  {
    heading: "Their account deploys",
    body: "LabHQ clones your snapshot into a new sub account and writes every custom value from the interview. CRM, pipelines, nurture, all configured in minutes.",
  },
  {
    heading: "AI answers every connected channel",
    body: "An AI receptionist and message responder go live, trained by the interview. Connect a channel once and every message on it is answered in under a minute, in the client's voice.",
  },
];

const CHANNEL_ROWS = [
  {
    label: "Website chat",
    body: "Paste one embed snippet on the client's site. LabHQ hands you the code the moment their account deploys.",
  },
  {
    label: "Facebook and Instagram",
    body: "The client connects their page with one approval click. Guided link included on the go live checklist.",
  },
  {
    label: "SMS",
    body: "The same number registration you already complete for every GHL client. The AI takes over the moment it clears.",
  },
];

const OFFER_ITEMS = [
  "Unlimited client deploys on your own snapshot",
  "AI replies included, 2,000 replies per month pooled across your clients",
  "White label setup call, first client deployed with you live",
  "Founding price locked for as long as you stay",
  "First client live within 7 days of setup or your $997 back",
];

const FAQ_ITEMS = [
  {
    q: "Can I just build this myself?",
    a: "With OAuth apps, webhook infrastructure and a year of GHL quirks, you could, in about six months. Founding partners are live inside a week.",
  },
  {
    q: "Who pays for the AI?",
    a: "Included. Your plan pools 2,000 AI replies a month across all your clients, then additional replies are $15 per thousand. Most agencies price it into their client fee many times over.",
  },
  {
    q: "What has to be connected for the AI to answer?",
    a: "Each channel needs its normal GHL connection: the chat widget embedded on the website, the Facebook or Instagram page approved by the client, and the client's number registered for SMS. LabHQ surfaces each step on the go live checklist so nothing gets missed.",
  },
  {
    q: "What about the phone number step?",
    a: "The same carrier registration you already complete for every client on GHL. Nothing new. Website chat and DMs answer as soon as they are connected while it clears.",
  },
  {
    q: "Is my data safe?",
    a: "Connections are encrypted at rest, backups run daily, and your data is exportable. Cancelling is a button in your dashboard, not an email.",
  },
  {
    q: "Will my clients see LabHQ anywhere?",
    a: "No. Intake, dashboard and every client touchpoint carry your brand only.",
  },
  {
    q: "What do my clients actually experience?",
    a: "A 10 minute chat, then a working system. Most tell agencies it was the easiest software setup they have ever done.",
  },
];

function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>LabHQ</span>
          <div className={styles.headerRight}>
            <a href="/demo" className={styles.headerLink}>
              Live demo
            </a>
            <Button href={VIDEO_URL} target="_blank" rel="noopener noreferrer" size="sm" className={styles.headerCta}>
              Watch the 90 second demo
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <h1 className={styles.h1}>Client onboarding that does itself</h1>
        <p className={`${styles.body} ${styles.heroSub}`}>
          Your client has a 10 minute AI chat. LabHQ deploys their entire GHL account from your snapshot, then
          answers their leads with AI in their own voice on every connected channel. All white labelled under your
          brand.
        </p>
        <div className={styles.heroActions}>
          <Button href={VIDEO_URL} target="_blank" rel="noopener noreferrer" size="lg">
            Watch the 90 second demo
          </Button>
          <Button href="/demo" variant="secondary" size="lg">
            Try the live demo
          </Button>
        </div>
        <p className={styles.heroFootnote}>Built in Australia by Growth Lab Co</p>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <div className={styles.statsGrid}>
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <div className={styles.statNumber}>{stat.number}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>How it works</h2>
        </div>
        <div className={styles.tileGrid}>
          {HOW_IT_WORKS.map((tile) => (
            <Card key={tile.heading} className={styles.tile}>
              <div className={styles.tileHeading}>{tile.heading}</div>
              <div className={styles.tileBody}>{tile.body}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <div className={styles.aiSectionGrid}>
          <div className={styles.aiSectionCopy}>
            <h2 className={styles.h2}>The AI already knows the business</h2>
            <p className={styles.body}>
              Nobody configures a bot. The onboarding interview is the configuration. Plug in a channel and the AI
              answers with the client's real services, prices and booking rules, and hands over to a human the
              moment it should.
            </p>
          </div>
          <div className={styles.phoneMock}>
            <div className={styles.phoneMockLabel}>SMS</div>
            <div className={styles.mockThread}>
              <div className={styles.mockGroup}>
                <div className={`${styles.mockBubble} ${styles.mockBubbleIn}`}>
                  hi, got water coming through the ceiling near a light, can anyone come today? we're in Stafford
                  Heights. how much roughly?
                </div>
                <div className={styles.mockMeta}>2:14 pm</div>
              </div>
              <div className={`${styles.mockGroup} ${styles.mockGroupOut}`}>
                <div className={`${styles.mockBubble} ${styles.mockBubbleOut}`}>
                  That needs someone today. We can have a plumber out this afternoon, emergency call out is $250 for
                  the first hour and we service Stafford Heights. Want me to lock in a time between 2 and 4pm?
                </div>
                <div className={styles.mockMeta}>
                  2:15 pm <Check size={12} strokeWidth={2.5} /> Delivered
                </div>
              </div>
            </div>
            <p className={styles.mockCaption}>Reply generated from the client's own intake answers.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChannelsSection() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Three channels, three small connections</h2>
        </div>
        <div className={styles.channelRows}>
          {CHANNEL_ROWS.map((row) => (
            <div key={row.label} className={styles.channelRow}>
              <div className={styles.channelRowLabel}>{row.label}</div>
              <div className={styles.channelRowBody}>{row.body}</div>
            </div>
          ))}
        </div>
        <p className={styles.channelClosing}>
          The same connections every GHL agency already makes. The difference is what happens after: no automations
          to build, no replies to template. The brain is already trained.
        </p>
      </div>
    </section>
  );
}

function WhiteLabelSection() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <div className={styles.whiteLabelGrid}>
          <div>
            <h2 className={styles.h2}>Your brand on every screen</h2>
            <p className={`${styles.body} ${styles.heroSub}`}>
              Your logo, your domain, your accent colour, your pricing. Clients onboard at your branded link and
              your team runs everything from a dashboard called Mission Control. LabHQ never appears anywhere your
              clients can see.
            </p>
          </div>
          <div className={styles.dashMock} aria-hidden="true">
            <div className={styles.dashMockTop}>
              <span className={styles.dashMockDot} />
              <span className={styles.dashMockDot} />
              <span className={styles.dashMockDot} />
            </div>
            <div className={styles.dashMockBody}>
              <div className={styles.dashMockNav}>
                <span className={`${styles.dashMockNavItem} ${styles.dashMockNavItemActive}`}>Clients</span>
                <span className={styles.dashMockNavItem}>Activity</span>
                <span className={styles.dashMockNavItem}>Templates</span>
                <span className={styles.dashMockNavItem}>Branding</span>
                <span className={styles.dashMockNavItem}>Settings</span>
              </div>
              <div className={styles.dashMockContent}>
                <div className={styles.dashMockBar} style={{ width: "60%" }} />
                <div className={styles.dashMockCard}>
                  <div className={styles.dashMockBar} style={{ width: "40%" }} />
                  <div className={styles.dashMockBar} style={{ width: "70%" }} />
                </div>
                <div className={styles.dashMockCard}>
                  <div className={styles.dashMockBar} style={{ width: "50%" }} />
                  <div className={styles.dashMockBar} style={{ width: "30%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FoundingOffer() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <Card className={styles.offerCard}>
          <p className={`${styles.eyebrow} ${styles.offerEyebrow}`}>Founding partner offer. Five agencies only.</p>
          <div className={styles.offerPrice}>$997 setup, then $297 per month</div>
          <p className={styles.offerAnchor}>Standard pricing will be $497 per month</p>
          <ul className={styles.offerList}>
            {OFFER_ITEMS.map((item) => (
              <li key={item}>
                <Check size={16} strokeWidth={2.5} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button href={STRIPE_LINK} target="_blank" rel="noopener noreferrer" size="lg">
            Claim a founding spot
          </Button>
          <p className={styles.offerFinePrint}>Five founding spots, then standard pricing applies.</p>
        </Card>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className={`${styles.section} ${styles.sectionBorder}`}>
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Frequently asked questions</h2>
        </div>
        <div className={styles.faqList}>
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary>
                <span className={styles.faqMarker} aria-hidden="true">
                  ▸
                </span>
                {item.q}
              </summary>
              <p className={styles.faqAnswer}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.ctaBand}>
      <div className={styles.container}>
        <h2 className={styles.h2}>The next client you sign could be live before your coffee goes cold</h2>
        <div className={styles.ctaActions}>
          <Button href={VIDEO_URL} target="_blank" rel="noopener noreferrer" size="lg">
            Watch the 90 second demo
          </Button>
          <Button href={STRIPE_LINK} target="_blank" rel="noopener noreferrer" variant="secondary" size="lg">
            Claim a founding spot
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerRow}>
          <a href="https://growthlabco.com.au">A Growth Lab Co product</a>
          <span className={styles.footerSep}>|</span>
          <span>Australian built</span>
          <span className={styles.footerSep}>|</span>
          <a href="mailto:hello@growthlabco.com.au">hello@growthlabco.com.au</a>
          <span className={styles.footerSep}>|</span>
          <a href="/terms">Terms</a>
          <span className={styles.footerSep}>|</span>
          <a href="/demo">Live demo</a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <Header />
      <Hero />
      <Reveal>
        <Stats />
      </Reveal>
      <Reveal>
        <HowItWorks />
      </Reveal>
      <Reveal>
        <AiSection />
      </Reveal>
      <Reveal>
        <ChannelsSection />
      </Reveal>
      <Reveal>
        <WhiteLabelSection />
      </Reveal>
      <Reveal>
        <FoundingOffer />
      </Reveal>
      <Reveal>
        <Faq />
      </Reveal>
      <Reveal>
        <FinalCta />
      </Reveal>
      <Footer />
    </div>
  );
}
