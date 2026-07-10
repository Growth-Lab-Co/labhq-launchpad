import { NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/portalSession";
import { connectionKeyFor, getConnection } from "@/lib/ghlOAuth";
import { getAccountById, updateOnboarding, maybeCompleteOnboarding } from "@/lib/accounts";

// Polled by the Connect step while its popup windows are open - GHL's OAuth
// callback lands on the standalone /api/oauth/connected confirmation page
// (opened in a new tab), not back inside the wizard, so the wizard tab has
// to ask "are we connected yet?" rather than being told directly.
export async function GET(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const tenant = session.tenantSlug;
  const agencyConnected = Boolean(await getConnection(connectionKeyFor({ tenant, app: "agency" })));
  const locationConnected = Boolean(await getConnection(connectionKeyFor({ tenant, app: "location" })));

  const account = await getAccountById(session.accountId);
  if (account && (account.onboarding.ghlAgencyConnected !== agencyConnected || account.onboarding.ghlLocationConnected !== locationConnected)) {
    await updateOnboarding(session.accountId, { ghlAgencyConnected: agencyConnected, ghlLocationConnected: locationConnected });
    await maybeCompleteOnboarding(session.accountId);
  }

  return NextResponse.json({ agencyConnected, locationConnected, agencyName: account?.agencyName || null });
}
