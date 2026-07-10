"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import s from "../portal.module.css";

// "/portal IS their Mission Control" (spec item 5) - rather than duplicating
// the entire, already-built Mission Control UI (clients, activity,
// templates, branding, settings) under a second route tree, this hands off
// to the tenant's own subdomain, where that UI already lives. The portal
// session cookie is domain-wide (see lib/portalSession.js
// cookieDomainForRequest) so the agency lands there already signed in - no
// separate Mission Control password to enter (app/[tenant]/missioncontrol/
// layout.jsx now accepts a portal session bound to that tenant in place of
// the per-tenant dashboard password). MC_PASSWORD still works there too, as
// the operator override, for every tenant.
export default function PortalDashboardPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/portal/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.account) {
          router.replace("/portal");
          return;
        }
        if (!data.account.onboarding?.completedAt) {
          router.replace("/portal/onboarding");
          return;
        }
        window.location.href = `https://${data.account.slug}.labhq.co/missioncontrol`;
      })
      .catch(() => setError("Couldn't load your dashboard. Try again."));
  }, [router]);

  return (
    <main className={s.shell}>
      {error ? (
        <div className={s.errorBanner}>{error}</div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Taking you to your dashboard…</p>
      )}
    </main>
  );
}
