import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenants";
import { listDeployments, patchDeploymentCustomValues } from "@/lib/deployments";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";

// Customer-editable booking link (Cliniko/Halaxy/Calendly/whatever they use) -
// lib/bot.js reads deployment.customValues.booking_link fresh on every
// reply, so saving here takes effect immediately, no redeploy needed.
export async function POST(req) {
  const { tenantSlug, bookingLink } = await req.json().catch(() => ({}));
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant || tenant.product !== "miia") {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment) return NextResponse.json({ error: "Not deployed yet" }, { status: 400 });

  const value = typeof bookingLink === "string" ? bookingLink.trim().slice(0, 500) : "";
  const updated = await patchDeploymentCustomValues(deployment.id, tenantSlug, { booking_link: value });
  if (!updated) return NextResponse.json({ error: "Couldn't save that - try again" }, { status: 500 });

  return NextResponse.json({ bookingLink: updated.customValues.booking_link });
}
