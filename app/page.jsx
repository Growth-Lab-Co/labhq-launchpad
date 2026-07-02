import Link from "next/link";

// Fallback root page (middleware redirects labhq.co -> marketing site in prod).
export default function Home() {
  return (
    <main className="shell" style={{ justifyContent: "center", textAlign: "center" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Lab HQ · Launchpad</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Deployment engine for Lab HQ onboarding systems.
      </p>
      <p>
        <Link href="/demo">Try the demo intake →</Link>
      </p>
    </main>
  );
}
