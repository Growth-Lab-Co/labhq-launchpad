import { NextResponse } from "next/server";
import { resolveMcAuth } from "@/lib/mcBridge";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import {
  listSnapshotTemplates,
  addSnapshotTemplate,
  renameSnapshotTemplate,
  setActiveSnapshotTemplate,
  deleteSnapshotTemplate,
} from "@/lib/snapshotTemplates";

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
}

async function legacySnapshotId(slug) {
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  return ghlCredsFor(tenant).snapshotId || null;
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await listSnapshotTemplates(tenant, await legacySnapshotId(tenant));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { tenant, name, snapshotId } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const items = await addSnapshotTemplate(tenant, { name, snapshotId }, await legacySnapshotId(tenant));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  try {
    const { tenant, id, name, setActive } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const items = setActive ? await setActiveSnapshotTemplate(tenant, id) : await renameSnapshotTemplate(tenant, id, name);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { tenant, id } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const items = await deleteSnapshotTemplate(tenant, id);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
