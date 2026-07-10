import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { listTenants, SEED_TENANTS } from "@/lib/tenants";
import { listAccounts, publicAccount } from "@/lib/accounts";

// Lists every tenant (seed + dynamic) alongside the portal account bound to
// it, if any - the operator's one view of "who's on the platform".
export async function GET(req) {
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

  const [tenants, accounts] = await Promise.all([listTenants(), listAccounts()]);
  const accountsBySlug = Object.fromEntries(accounts.map((a) => [a.slug, a]));

  const items = tenants.map((tenant) => ({
    slug: tenant.slug,
    name: tenant.name,
    isSeed: Boolean(SEED_TENANTS[tenant.slug]),
    createdAt: tenant.createdAt || null,
    account: accountsBySlug[tenant.slug] ? publicAccount(accountsBySlug[tenant.slug]) : null,
  }));

  return NextResponse.json({ tenants: items });
}
