import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { resolveLocationDataAuth, getForms } from "@/lib/ghl";

// Live-fetches the website chat embed snippet rather than relying on a
// stored copy - deployment records don't persist the form embed today (it's
// only ever returned transiently from the deploy call), so this re-fetches
// from GHL each time the Channels page asks for it.
export async function GET(req) {
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug");
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment?.locationId) return NextResponse.json({ embed: null });

  try {
    const legacyCreds = ghlCredsFor(tenant);
    const auth = await resolveLocationDataAuth({ tenantSlug, locationId: deployment.locationId, legacyCreds });
    if (!auth.token) return NextResponse.json({ embed: null });

    const forms = await getForms({ token: auth.token, locationId: deployment.locationId });
    const form = forms[0];
    if (!form?.id) return NextResponse.json({ embed: null });

    const formName = form.name || "Contact form";
    const snippet = `<script src="https://link.msgsndr.com/js/form_embed.js"></script>\n<iframe src="https://api.leadconnectorhq.com/widget/form/${form.id}" style="width:100%;height:600px;border:none;border-radius:4px" id="inline-${form.id}" data-form-id="${form.id}" title="${formName}"></iframe>`;
    return NextResponse.json({ embed: { formId: form.id, name: formName, snippet } });
  } catch (e) {
    console.error(`[DASHBOARD-EMBED-FAIL] tenant=${tenantSlug}`, e.message);
    return NextResponse.json({ embed: null });
  }
}
