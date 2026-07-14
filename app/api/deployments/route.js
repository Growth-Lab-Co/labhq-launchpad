import { NextResponse } from "next/server";
import { listDeployments, updateDeploymentStatus, getDeployment, deleteDeployment, DEPLOYMENT_STATUSES } from "@/lib/deployments";
import { resolveMcAuth } from "@/lib/mcBridge";
import { logActivity, deleteActivityForDeployment } from "@/lib/activity";
import { deleteChecklist } from "@/lib/checklist";
import { logAdminActivity } from "@/lib/adminActivity";

const STATUS_LABELS = {
  deployed: "Deployed",
  calendar_connected: "Calendar connected",
  phone_live: "Phone live",
  qa_passed: "QA passed",
  live: "Live",
};

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deployments = await listDeployments(tenant);
    return NextResponse.json({ deployments });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { id, status, tenant } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    if (!DEPLOYMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const record = await updateDeploymentStatus(id, status, tenant);
    if (!record) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });

    await logActivity({
      tenant,
      deploymentId: id,
      businessName: record.businessName,
      type: status === "live" ? "go-live" : "setup",
      text: status === "live" ? "Marked as live" : `Status set to ${STATUS_LABELS[status] || status}`,
    });

    return NextResponse.json({ deployment: record });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Removes a deployment record from Mission Control - the dashboard entry,
// its checklist state, and its activity entries for this tenant only.
// Never touches the underlying GHL sub-account; that stays a manual step
// (see the confirmation modal copy in the client detail page).
export async function DELETE(req) {
  try {
    const { id, tenant: slug, confirmName } = await req.json();
    if (!(await authorized(req, slug))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const record = await getDeployment(id, slug);
    if (!record) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });

    const expectedName = record.businessName || "Unnamed business";
    if ((confirmName || "").trim() !== expectedName) {
      return NextResponse.json({ error: "Confirmation text doesn't match the client name" }, { status: 400 });
    }

    await deleteDeployment(id, slug);
    await deleteChecklist(slug, id);
    await deleteActivityForDeployment(slug, id);

    await logActivity({
      tenant: slug,
      deploymentId: null,
      businessName: expectedName,
      type: "general",
      text: `Removed client "${expectedName}" from the dashboard`,
    });

    await logAdminActivity({
      action: "client_removed",
      detail: { tenant: slug, deploymentId: id, businessName: expectedName, locationId: record.locationId || null },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
