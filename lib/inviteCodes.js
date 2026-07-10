// Operator-issued invite codes - the live activation path for onboarding
// (see app/api/portal/onboarding/activate). Single-use, backed by Netlify
// Blobs, redeemed atomically via setJSONAtomic so two people racing to use
// the same code can't both win.

import { blobStore } from "./blobsFetch.js";
import { randomBytes } from "crypto";
import { setJSONAtomic } from "./blobsAtomic.js";

const STORE_NAME = "invite-codes";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function generateCode() {
  const bytes = randomBytes(10);
  let code = "";
  for (let i = 0; i < 10; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export async function createInviteCode({ planLabel }) {
  const label = (planLabel || "Founding partner").trim();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const record = { code, planLabel: label, createdAt: new Date().toISOString(), usedAt: null, usedByAccountId: null };
    const { modified } = await setJSONAtomic(store(), code, record, { onlyIfNew: true });
    if (modified) return record;
  }
  throw new Error("Couldn't generate a unique invite code - try again");
}

export async function listInviteCodes() {
  const { blobs } = await store().list();
  const records = await Promise.all(blobs.map(({ key }) => store().get(key, { type: "json" }).catch(() => null)));
  return records.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Returns { ok, planLabel, error }. Atomic single-use via compare-and-swap -
// if two requests race for the same code, only one can win.
export async function redeemInviteCode(rawCode, accountId) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter an invite code" };

  const result = await store().getWithMetadata(code, { type: "json" });
  if (!result) return { ok: false, error: "That invite code isn't valid" };
  const { data: record, etag } = result;
  if (!record || record.usedAt) return { ok: false, error: "That invite code has already been used" };

  const { modified } = await setJSONAtomic(
    store(),
    code,
    { ...record, usedAt: new Date().toISOString(), usedByAccountId: accountId },
    { onlyIfMatch: etag }
  );
  if (!modified) return { ok: false, error: "That invite code has already been used" };
  return { ok: true, planLabel: record.planLabel };
}
