// Per-tenant go-live checklist template, backed by Netlify Blobs. New
// deployments inherit whatever this returns at the moment their checklist is
// first read (see lib/checklist.js) - so editing the template here changes
// what NEW clients get, without touching clients already in flight.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "checklist-templates";

export const DEFAULT_CHECKLIST_TEMPLATE = [
  { id: "c1", group: "In the account", text: "Import snapshot", owner: "You" },
  { id: "c2", group: "In the account", text: "Configure custom values", owner: "You" },
  { id: "c3", group: "In the account", text: "Assign the client as a calendar staff member", owner: "You" },
  { id: "c4", group: "In the account", text: "Connect their Google or Outlook calendar", owner: "You" },
  { id: "c5", group: "In the account", text: "Tune calendar availability — days ahead, buffers, slot length", owner: "You" },
  { id: "c6", group: "In the account", text: "Attach or forward their phone number", owner: "You" },
  { id: "c7", group: "In the account", text: "Swap the AI receptionist's transfer number to the client's escalation contact", owner: "You" },
  { id: "c8", group: "In the account", text: "Connect Facebook Lead Ads, if they use it", owner: "You" },
  { id: "c9", group: "In the account", text: "Set up sub-account branding", owner: "You" },
  { id: "c10", group: "With the client", text: "Share onboarding form link", owner: "You" },
  { id: "c11", group: "With the client", text: "Client completes intake form", owner: "Client" },
  { id: "c12", group: "With the client", text: "Confirm contact details", owner: "You" },
  { id: "c13", group: "QA", text: "Run the four-question test call: are you a robot? a known FAQ? an unknown question? ask for a human?", owner: "You" },
  { id: "c14", group: "QA", text: "Verify lead form submission", owner: "You" },
  { id: "c15", group: "QA", text: "Check calendar booking end-to-end", owner: "You" },
  { id: "c16", group: "Go live", text: "Remove test contacts", owner: "You" },
  { id: "c17", group: "Go live", text: "Set live date in system", owner: "You" },
  { id: "c18", group: "Go live", text: "Notify client via email", owner: "You" },
];

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getChecklistTemplate(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return record?.items?.length ? record.items : DEFAULT_CHECKLIST_TEMPLATE;
}

export async function saveChecklistTemplate(tenant, items) {
  const record = { items, updatedAt: new Date().toISOString() };
  await store().setJSON(tenant, record);
  return record.items;
}

export async function restoreDefaultChecklistTemplate(tenant) {
  await store().delete(tenant);
  return DEFAULT_CHECKLIST_TEMPLATE;
}
