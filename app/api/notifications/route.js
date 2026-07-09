import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/mcAuth";
import { getNotificationSettings, saveNotificationSettings } from "@/lib/notifications";

async function authorized(req, tenant) {
  const key = req.headers.get("x-mc-key");
  return verifyPassword(tenant, key);
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
