import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant } from "@/lib/tenants";
import { createSession, setSessionCookie, cookieDomainForRequest } from "@/lib/miiaCustomerAuth";
import { SITE_URL } from "@/components/miia/site";

// Ops/QA utility: mints a real customer-dashboard session for a tenant
// without needing a matching miia-signups record or a real magic-link
// round trip - lets an operator verify a tenant's dashboard (e.g. one
// created before the signup-record/magic-link system existed) without
// bypassing the auth mechanism itself. Redirects with the session cookie
// set, same as /api/miia/auth/verify's happy path.
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

  const { token, expiresAt } = await createSession({ tenantSlug: params.slug });
  const res = NextResponse.json({ ok: true, redirectTo: `${SITE_URL}/${params.slug}` });
  return setSessionCookie(res, token, expiresAt, cookieDomainForRequest(req));
}
