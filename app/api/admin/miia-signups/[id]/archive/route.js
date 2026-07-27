import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getSignupById, archiveSignup, unarchiveSignup, getSignupWithStatus } from "@/lib/miiaSignups";
import { archiveTenant, unarchiveTenant } from "@/lib/tenants";

// Archives (or restores) a signup AND, if it has a tenant, that tenant too -
// data-layer only, no interaction with checkout/webhook/provisioning/email.
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

  const { restore } = await req.json().catch(() => ({}));
  const signup = await getSignupById(params.id);
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (restore) {
    await unarchiveSignup(params.id);
    if (signup.tenantSlug) await unarchiveTenant(signup.tenantSlug).catch(() => {});
  } else {
    await archiveSignup(params.id);
    if (signup.tenantSlug) await archiveTenant(signup.tenantSlug).catch(() => {});
  }

  const updated = await getSignupWithStatus(params.id);
  return NextResponse.json({ signup: updated });
}
