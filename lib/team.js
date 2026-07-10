// Per-tenant team roster, backed by Netlify Blobs. Roles are stored for real
// but there's no separate per-user login yet - everyone still signs into
// Mission Control with the one shared dashboard password, so a role is a
// record of who's on the team and what they're meant to have access to,
// not (yet) an enforced permission boundary.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "team-members";

export const ROLES = ["Owner", "Admin", "Member"];

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listTeamMembers(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return record?.members || [];
}

export async function inviteTeamMember(tenant, { email, role }) {
  const trimmed = (email || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) throw new Error("Enter a valid email address");
  if (!ROLES.includes(role)) throw new Error("Invalid role");

  const members = await listTeamMembers(tenant);
  if (members.some((m) => m.email.toLowerCase() === trimmed)) {
    throw new Error("That person has already been invited");
  }

  const now = new Date().toISOString();
  const member = { id: makeId(), email: trimmed, role, status: "invited", invitedAt: now };
  const next = [...members, member];
  await store().setJSON(tenant, { members: next });
  return { members: next, member };
}

export async function updateTeamMemberRole(tenant, id, role) {
  if (!ROLES.includes(role)) throw new Error("Invalid role");
  const members = await listTeamMembers(tenant);
  const next = members.map((m) => (m.id === id ? { ...m, role } : m));
  await store().setJSON(tenant, { members: next });
  return next;
}

export async function removeTeamMember(tenant, id) {
  const members = await listTeamMembers(tenant);
  const next = members.filter((m) => m.id !== id);
  await store().setJSON(tenant, { members: next });
  return next;
}

export async function deleteTeamMembers(tenant) {
  await store().delete(tenant);
}
