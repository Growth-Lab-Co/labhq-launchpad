import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getAccountByEmail, updateOnboarding, maybeCompleteOnboarding, publicAccount } from "@/lib/accounts";

// TEMPORARY - added to verify the domain-alias auto-registration feature
// against production end to end without real GHL OAuth (which needs a human
// consent click), then removed. Do not leave this route deployed. Marks the
// two GHL-connection flags true directly, same shape connect-status/route.js
// writes for real - only path into maybeCompleteOnboarding this doesn't
// exercise for real is that one function's own live-connection check.
export async function POST(req) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    if (auth.rateLimited) {
      return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json().catch(() => ({}));
  const account = await getAccountByEmail(email);
  if (!account) return NextResponse.json({ error: "No account with that email" }, { status: 404 });

  await updateOnboarding(account.id, {
    ghlAgencyConnected: true,
    ghlLocationConnected: true,
    snapshotId: "debug-verification-snapshot",
  });
  const completed = await maybeCompleteOnboarding(account.id);
  return NextResponse.json({ account: publicAccount(completed) });
}
