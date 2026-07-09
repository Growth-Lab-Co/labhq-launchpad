import Link from "next/link";

export const metadata = { title: "Lab HQ licence terms" };

export default function TermsPage() {
  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/" className="brand font-display">
          Lab HQ
        </Link>
      </div>

      <div style={{ display: "inline-block", marginBottom: 20 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--warning)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            borderRadius: 999,
            padding: "4px 10px",
          }}
        >
          DRAFT
        </span>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Lab HQ licence terms</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        This is a placeholder. The full licence terms for agencies using the Lab HQ self-serve
        portal haven't been finalised yet - this page exists so signup has somewhere to link to.
      </p>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        In short: agencies who sign up get access to the Lab HQ platform under a subscription,
        are responsible for their own client relationships and compliance obligations (see{" "}
        <Link href="/">COMPLIANCE.md</Link> for the Australian compliance layer this platform
        automates), and Lab HQ is not liable for how an agency's clients use the deployed system.
        This will be replaced with a reviewed agreement before general availability.
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Questions in the meantime? Contact your Lab HQ operator directly.
      </p>

      <footer style={{ marginTop: "auto", paddingTop: 48, fontSize: 13 }}>
        <a href="https://growthlabco.com.au">A Growth Lab Co. product</a>
      </footer>
    </main>
  );
}
