"use client";
import { Card, Button } from "@/components/ui";
import { useOnboarding } from "@/components/portal/OnboardingContext";
import s from "../onboarding.module.css";

export default function CompletePage() {
  const { account } = useOnboarding();
  const subdomainUrl = account ? `https://${account.slug}.labhq.co` : null;

  return (
    <Card className={s.card}>
      <div className={s.complete}>
        <div className={s.completeIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className={s.title}>You're live</h1>
        <p className={s.subtitle}>{account?.agencyName}'s door is open.</p>

        <div className={s.completeLinks}>
          <Button as="a" href={subdomainUrl} target="_blank" rel="noopener noreferrer" style={{ width: "100%" }}>
            Open your subdomain — {account?.slug}.labhq.co
          </Button>
          <Button as="a" href="/portal/dashboard" variant="secondary" style={{ width: "100%" }}>
            Go to your dashboard
          </Button>
          <Button as="a" href={subdomainUrl} target="_blank" rel="noopener noreferrer" variant="ghost" style={{ width: "100%" }}>
            Deploy your first client
          </Button>
        </div>
      </div>
    </Card>
  );
}
