import { NextResponse } from "next/server";
import { resolveMcAuth } from "@/lib/mcBridge";
import { getTenant } from "@/lib/tenants";
import { listTeamMembers, inviteTeamMember, updateTeamMemberRole, removeTeamMember } from "@/lib/team";
import { sendEmail } from "@/lib/email";

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const members = await listTeamMembers(tenant);
    return NextResponse.json({ members });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { tenant, email, role } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantConfig = await getTenant(tenant);
    const { members, member } = await inviteTeamMember(tenant, { email, role });

    const portalUrl = `https://${tenant}.labhq.co`;
    const emailResult = await sendEmail({
      to: member.email,
      subject: `You've been invited to ${tenantConfig?.name || tenant}'s Lab HQ`,
      html: `
        <p>You've been added to <strong>${tenantConfig?.name || tenant}</strong>'s Lab HQ Mission Control as <strong>${role}</strong>.</p>
        <p>Sign in at <a href="${portalUrl}/missioncontrol">${portalUrl}/missioncontrol</a> using the dashboard password your admin gives you.</p>
      `,
      text: `You've been added to ${tenantConfig?.name || tenant}'s Lab HQ Mission Control as ${role}.\nSign in at ${portalUrl}/missioncontrol using the dashboard password your admin gives you.`,
    });

    return NextResponse.json({ members, emailSent: emailResult.ok, emailError: emailResult.ok ? null : emailResult.error });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  try {
    const { tenant, id, role } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const members = await updateTeamMemberRole(tenant, id, role);
    return NextResponse.json({ members });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { tenant, id } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const members = await removeTeamMember(tenant, id);
    return NextResponse.json({ members });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
