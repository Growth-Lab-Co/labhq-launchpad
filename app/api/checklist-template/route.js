import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/mcAuth";
import {
  getChecklistTemplate,
  saveChecklistTemplate,
  restoreDefaultChecklistTemplate,
} from "@/lib/checklistTemplate";

async function authorized(req, tenant) {
  const key = req.headers.get("x-mc-key");
  return verifyPassword(tenant, key);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await getChecklistTemplate(tenant);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { tenant, items, restoreDefault } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (restoreDefault) {
      const restored = await restoreDefaultChecklistTemplate(tenant);
      return NextResponse.json({ items: restored });
    }
    if (!Array.isArray(items)) return NextResponse.json({ error: "Missing items" }, { status: 400 });

    const saved = await saveChecklistTemplate(tenant, items);
    return NextResponse.json({ items: saved });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
