import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getSignupById } from "@/lib/miiaSignups";
import { provisionTenantForSignup } from "@/lib/miiaProvisioning";

// One-click retry from the ops queue for a signup stuck in
// provisioningStatus "failed" - re-runs the exact same idempotent
// provisioning path the webhook and success page use.
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

  const result = await provisionTenantForSignup(signup);
  return NextResponse.json({ signup: result });
}
