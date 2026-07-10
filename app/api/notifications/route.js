import { NextResponse } from "next/server";
import { resolveMcAuth } from "@/lib/mcBridge";
import { getNotificationSettings, saveNotificationSettings } from "@/lib/notifications";

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const settings = await getNotificationSettings(tenant);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { tenant, settings } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!settings) return NextResponse.json({ error: "Missing settings" }, { status: 400 });
    const saved = await saveNotificationSettings(tenant, settings);
    return NextResponse.json({ settings: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
