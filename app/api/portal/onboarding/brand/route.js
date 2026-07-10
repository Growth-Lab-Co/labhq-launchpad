import { NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/portalSession";
import { updateOnboarding, maybeCompleteOnboarding, publicAccount } from "@/lib/accounts";

// Actual asset/colour/welcome-message saves go through the existing
// /api/branding and /api/branding/asset routes (now accepting a portal
// session via lib/mcBridge.js) - this just marks the wizard step done once
// the agency is happy with their preview and clicks Finish.
export async function POST(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  await updateOnboarding(session.accountId, { brandingDone: true });
  const account = await maybeCompleteOnboarding(session.accountId);
  return NextResponse.json({ account: publicAccount(account) });
}
