import { NextResponse } from "next/server";
import { getClaimLink, redeemClaimLink } from "@/lib/claimLinks";
import { createAccountForExistingTenant, updateOnboarding, maybeCompleteOnboarding, publicAccount } from "@/lib/accounts";
import { createSession, setSessionCookie } from "@/lib/portalSession";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { connectionKeyFor, getConnection } from "@/lib/ghlOAuth";
import { getActiveSnapshotId } from "@/lib/snapshotTemplates";
import { getBranding } from "@/lib/branding";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req, { params }) {
  const link = await getClaimLink(params.token);
  if (!link) return NextResponse.json({ valid: false });
  const tenant = await getTenant(link.tenantSlug);
  return NextResponse.json({ valid: true, tenantSlug: link.tenantSlug, tenantName: tenant?.name || link.tenantSlug, planLabel: link.planLabel });
}

// Redeems the link, creates a portal account bound to the existing tenant,
// and auto-detects which wizard steps are already done so the agency
// doesn't have to redo real setup work that already exists for this tenant.
export async function POST(req, { params }) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({ route: "claim-redeem", ip, max: 10, windowMs: 15 * 60 * 1000 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429, headers: { "retry-after": String(retryAfterSeconds) } });
  }

  const link = await redeemClaimLink(params.token);
  if (!link) return NextResponse.json({ error: "That claim link is invalid, expired, or already used" }, { status: 400 });

  try {
    const { agencyName, contactEmail, password, acceptTerms } = await req.json();
    if (!acceptTerms) return NextResponse.json({ error: "You must agree to the licence terms" }, { status: 400 });

    const account = await createAccountForExistingTenant({
      agencyName,
      tenantSlug: link.tenantSlug,
      contactEmail,
      password,
      acceptedTermsAt: new Date().toISOString(),
    });

    // Detect what's already true for this tenant so the wizard shows those
    // steps pre-completed rather than asking the agency to redo them.
    const tenant = await getTenant(link.tenantSlug);
    const legacyCreds = ghlCredsFor(tenant);
    const [agencyConnected, locationConnected, snapshotId, branding] = await Promise.all([
      getConnection(connectionKeyFor({ tenant: link.tenantSlug, app: "agency" })).then(Boolean),
      getConnection(connectionKeyFor({ tenant: link.tenantSlug, app: "location" })).then(Boolean),
      getActiveSnapshotId(link.tenantSlug, legacyCreds.snapshotId),
      getBranding(link.tenantSlug),
    ]);

    await updateOnboarding(account.id, {
      activated: true,
      planLabel: link.planLabel,
      ghlAgencyConnected: agencyConnected,
      ghlLocationConnected: locationConnected,
      snapshotId: snapshotId || null,
      brandingDone: Boolean(branding.accent || branding.welcomeMessage || branding.logoUrl),
    });
    const completedAccount = await maybeCompleteOnboarding(account.id);

    const { token: sessionToken, expiresAt } = await createSession({ accountId: account.id, tenantSlug: account.slug });
    const res = NextResponse.json({ account: publicAccount(completedAccount) });
    return setSessionCookie(res, sessionToken, expiresAt);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
