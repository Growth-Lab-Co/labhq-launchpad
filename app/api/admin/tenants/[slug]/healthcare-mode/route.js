import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant, setHealthcareMode } from "@/lib/tenants";

// Manual ops override for the healthcare clinical-guardrail flag - see
// lib/tenants.js setHealthcareMode. Source is always "manual" here, which
// makes it sticky: the two automatic triggers (signup source, intake
// classification) leave a tenant alone once an operator has set this
// explicitly, in either direction.
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

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const { enabled } = await req.json().catch(() => ({}));
  const updated = await setHealthcareMode(params.slug, { enabled: Boolean(enabled), source: "manual" });
  if (!updated) return NextResponse.json({ error: "Couldn't update healthcare mode" }, { status: 500 });

  return NextResponse.json({ tenant: updated });
}
