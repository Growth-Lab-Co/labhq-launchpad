import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { isPasswordConfigured, setPassword, verifyPassword } from "@/lib/mcAuth";

const MIN_LENGTH = 8;

// Unauthenticated on purpose - only reveals whether a password has been set
// yet for this tenant, nothing sensitive, and the dashboard needs it to
// decide whether to show "create a password" or "enter password".
export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!tenant || !(await getTenant(tenant))) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  try {
    const configured = await isPasswordConfigured(tenant);
    return NextResponse.json({ configured });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// First-time setup needs no auth (nothing to prove yet). Once a password
// exists, changing it requires the current password (or the MC_PASSWORD
// master override) via the x-mc-key header.
export async function POST(req) {
  try {
    const { tenant, password } = await req.json();
    if (!tenant || !(await getTenant(tenant))) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
    if (!password || password.length < MIN_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_LENGTH} characters` }, { status: 400 });
    }

    const configured = await isPasswordConfigured(tenant);
    if (configured) {
      const key = req.headers.get("x-mc-key");
      const authorized = await verifyPassword(tenant, key);
      if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await setPassword(tenant, password);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
