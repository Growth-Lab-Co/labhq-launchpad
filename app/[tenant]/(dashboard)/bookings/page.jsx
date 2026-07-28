import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { resolveLocationDataAuth, listCalendarEvents } from "@/lib/ghl";
import { BookingsPageClient } from "@/components/dashboard/BookingsPageClient";

const DAY_MS = 24 * 60 * 60 * 1000;

async function getEvents(tenantSlug) {
  const tenant = await getTenant(tenantSlug);
  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment?.locationId) return null;
  try {
    const legacyCreds = ghlCredsFor(tenant);
    const auth = await resolveLocationDataAuth({ tenantSlug, locationId: deployment.locationId, legacyCreds });
    if (!auth.token) return null;
    const now = Date.now();
    return await listCalendarEvents({
      token: auth.token,
      locationId: deployment.locationId,
      startMs: now - 30 * DAY_MS,
      endMs: now + 60 * DAY_MS,
    });
  } catch {
    return null;
  }
}

export default async function BookingsPage({ params }) {
  const events = await getEvents(params.tenant);
  return <BookingsPageClient events={events} />;
}
