import { NextResponse } from "next/server";
import { resolveMcAuth } from "@/lib/mcBridge";
import { getBotSettings, saveBotSettings } from "@/lib/botSettings";

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const locationId = req.nextUrl.searchParams.get("locationId");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!locationId) return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
  try {
    const settings = await getBotSettings(tenant, locationId);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { tenant, locationId, settings, updatedBy } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!locationId) return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
    if (!settings) return NextResponse.json({ error: "Missing settings" }, { status: 400 });
    const saved = await saveBotSettings(tenant, locationId, settings, updatedBy);
    return NextResponse.json({ settings: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
