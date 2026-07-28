import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getSignupById, getSignupWithStatus } from "@/lib/miiaSignups";
import { sendWelcomeEmailForSignup } from "@/lib/miiaProvisioning";

// Forces a fresh welcome email (new magic link) regardless of whether one
// was already marked sent - see the 2026-07-28 "silent failure" incident.
export async function POST(req, { params }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    if (auth.rateLimited) {
      return NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429, headers: { "retry-after": String(auth.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signup = await getSignupById(params.id);
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!signup.tenantSlug) {
    return NextResponse.json({ error: "This signup hasn't provisioned a tenant yet." }, { status: 400 });
  }

  await sendWelcomeEmailForSignup(signup, { force: true });
  const updated = await getSignupWithStatus(params.id);
  return NextResponse.json({ signup: updated });
}
