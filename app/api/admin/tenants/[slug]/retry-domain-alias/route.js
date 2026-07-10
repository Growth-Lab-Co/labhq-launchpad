import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant } from "@/lib/tenants";
import { getAccountById, registerTenantDomain, publicAccount } from "@/lib/accounts";
import { netlifyDomainsConfigured } from "@/lib/netlifyDomains";

// Operator-triggered retry for a tenant whose {slug}.labhq.co domain alias
// failed to auto-register at onboarding completion (see
// lib/accounts.js:registerTenantDomain). The tenant works at labhq.co/{slug}
// either way - this just closes the gap for the nicer subdomain URL.
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

  if (!netlifyDomainsConfigured()) {
    return NextResponse.json({ error: "NETLIFY_API_TOKEN isn't set - can't auto-register domains yet" }, { status: 503 });
  }

  const tenant = await getTenant(params.slug);
  if (!tenant?.ownerAccountId) return NextResponse.json({ error: "No portal account bound to this tenant" }, { status: 404 });

  const account = await getAccountById(tenant.ownerAccountId);
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const updated = await registerTenantDomain(account);
  return NextResponse.json({ account: publicAccount(updated) });
}
