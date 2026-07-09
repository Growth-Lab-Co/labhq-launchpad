import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/mcAuth";
import { getChecklist, toggleChecklistItem } from "@/lib/checklist";
import { getDeployment } from "@/lib/deployments";
import { logActivity } from "@/lib/activity";

async function authorized(req, tenant) {
  const key = req.headers.get("x-mc-key");
  return verifyPassword(tenant, key);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const deploymentId = req.nextUrl.searchParams.get("id");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!deploymentId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const items = await getChecklist(tenant, deploymentId);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { tenant, id, itemId } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id || !itemId) return NextResponse.json({ error: "Missing id or itemId" }, { status: 400 });

    const items = await toggleChecklistItem(tenant, id, itemId);
    const toggled = items.find((i) => i.id === itemId);

    if (toggled?.checked) {
      const deployment = await getDeployment(id, tenant);
      await logActivity({
        tenant,
        deploymentId: id,
        businessName: deployment?.businessName || "",
        type: "setup",
        text: `Checklist item completed: ${toggled.text}`,
      });
    }

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
