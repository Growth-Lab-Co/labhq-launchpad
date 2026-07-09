import { NextResponse } from "next/server";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { verifyPassword } from "@/lib/mcAuth";

// Exposes only whether GHL is configured for this tenant + the snapshot id
// (not sensitive - an internal GHL identifier) - never the token/company id.
export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const key = req.headers.get("x-mc-key");
  if (!(await verifyPassword(tenant, key))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const t = getTenant(tenant);
  if (!t) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const creds = ghlCredsFor(t);
  return NextResponse.json({
    snapshotConfigured: creds.configured,
    snapshotId: creds.configured ? creds.snapshotId : null,
    subdomain: `${t.slug}.labhq.co`,
    agencyName: t.name,
  });
}
