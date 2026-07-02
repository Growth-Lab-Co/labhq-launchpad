import Link from "next/link";

export default function Home() {
  return (
    <main className="shell" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div className="brand" style={{ fontSize: 24, marginBottom: 16 }}>Lab HQ</div>
      <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.5, maxWidth: 420, marginBottom: 32 }}>
        The automated onboarding system, deployed through a conversation.
      </p>
      <Link href="/demo" className="btn">Try the demo</Link>
      <footer style={{ marginTop: "auto", paddingTop: 48, fontSize: 13 }}>
        <a href="https://growthlabco.com.au">A Growth Lab Co. product</a>
      </footer>
    </main>
  );
}
