"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Badge } from "@/components/ui";
import { useOnboarding } from "@/components/portal/OnboardingContext";
import s from "../onboarding.module.css";

const POLL_MS = 4000;

export default function ConnectPage() {
  const router = useRouter();
  const { account, refetchAccount } = useOnboarding();
  const [status, setStatus] = useState(null);
  const [continuing, setContinuing] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/onboarding/connect-status");
      const data = await res.json();
      setStatus(data);
    } catch {
      // A missed poll just tries again next tick.
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, POLL_MS);
    const onFocus = () => refreshStatus();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshStatus]);

  const tenant = account?.slug;
  const agencyConnected = status?.agencyConnected;
  const locationConnected = status?.locationConnected;
  const bothConnected = agencyConnected && locationConnected;

  async function handleContinue() {
    setContinuing(true);
    await refetchAccount();
    router.replace("/portal/onboarding/snapshot");
  }

  return (
    <Card className={s.card}>
      <h1 className={s.title}>Connect GoHighLevel</h1>
      <p className={s.subtitle}>
        Each opens GoHighLevel in a new tab. Approve the connection, then close that tab and come back here.
      </p>

      <div className={s.connectRow}>
        <div className={s.connectRowLeft}>
          <span className={s.connectRowTitle}>Agency account</span>
          <span className={s.connectRowHelp}>Lets Lab HQ create sub-accounts in your agency from the snapshot.</span>
        </div>
        {agencyConnected ? (
          <Badge tone="success">Connected: {status?.agencyName || account?.agencyName}</Badge>
        ) : (
          <Button
            as="a"
            href={`/api/oauth/start?app=agency&tenant=${encodeURIComponent(tenant || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            Connect
          </Button>
        )}
      </div>

      <div className={s.connectRow}>
        <div className={s.connectRowLeft}>
          <span className={s.connectRowTitle}>Sync</span>
          <span className={s.connectRowHelp}>
            This second connection lets Lab HQ read and write client data - custom values, contacts and forms - inside
            each sub-account we create for you.
          </span>
        </div>
        {locationConnected ? (
          <Badge tone="success">Connected</Badge>
        ) : (
          <Button
            as="a"
            href={`/api/oauth/start?app=location&tenant=${encodeURIComponent(tenant || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            Connect
          </Button>
        )}
      </div>

      <div className={s.actions}>
        <Button onClick={handleContinue} disabled={!bothConnected || continuing}>
          {continuing ? "Continuing…" : "Continue"}
        </Button>
      </div>
    </Card>
  );
}
