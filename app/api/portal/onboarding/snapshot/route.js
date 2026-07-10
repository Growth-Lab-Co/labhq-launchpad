import { NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/portalSession";
import { getAccountById, updateOnboarding, maybeCompleteOnboarding, publicAccount } from "@/lib/accounts";
import { getAgencyConnection } from "@/lib/ghlOAuth";
import { listSnapshots } from "@/lib/ghl";
import { setPrimarySnapshot } from "@/lib/snapshotTemplates";

export async function GET(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const account = await getAccountById(session.accountId);
  return NextResponse.json({
    shareUrl: process.env.LABHQ_SNAPSHOT_SHARE_URL || null,
    snapshotId: account?.onboarding?.snapshotId || null,
  });
}

// Validates the pasted-in snapshot id live against the agency's own GHL
// account (via their agency OAuth token from the Connect step) before saving
// it - catches a typo'd or wrong-account id before it can break a real
// client deploy later.
export async function POST(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { snapshotId } = await req.json().catch(() => ({}));
  const cleanId = String(snapshotId || "").trim();
  if (!cleanId) return NextResponse.json({ error: "Enter a snapshot ID" }, { status: 400 });

  const connection = await getAgencyConnection(session.tenantSlug);
  if (!connection) {
    return NextResponse.json({ error: "Connect your GoHighLevel agency account first" }, { status: 400 });
  }

  let snapshots;
  try {
    snapshots = await listSnapshots({ token: connection.token, companyId: connection.companyId });
  } catch (e) {
    console.error("[onboarding/snapshot] listSnapshots failed:", e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't verify that snapshot ID with GoHighLevel. Try again." }, { status: 502 });
  }

  if (!snapshots.some((s) => s.id === cleanId)) {
    return NextResponse.json({ error: "That snapshot ID isn't in your agency account" }, { status: 400 });
  }

  await setPrimarySnapshot(session.tenantSlug, cleanId);
  await updateOnboarding(session.accountId, { snapshotId: cleanId });
  const account = await maybeCompleteOnboarding(session.accountId);
  return NextResponse.json({ account: publicAccount(account) });
}
