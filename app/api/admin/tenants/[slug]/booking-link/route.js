import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant } from "@/lib/tenants";
import { listDeployments, patchDeploymentCustomValues } from "@/lib/deployments";

// Ops-only counterpart to the customer dashboard's booking-link save route -
// for backfilling a demo tenant, or setting one on a customer's behalf on
// request.
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

  const deployments = await listDeployments(params.slug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment) return NextResponse.json({ error: "Not deployed yet" }, { status: 400 });

  const { bookingLink } = await req.json().catch(() => ({}));
  const value = typeof bookingLink === "string" ? bookingLink.trim().slice(0, 500) : "";
  const updated = await patchDeploymentCustomValues(deployment.id, params.slug, { booking_link: value });
  if (!updated) return NextResponse.json({ error: "Couldn't save that" }, { status: 500 });

  return NextResponse.json({ bookingLink: updated.customValues.booking_link });
}
