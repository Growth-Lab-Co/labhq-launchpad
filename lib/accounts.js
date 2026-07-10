// Self-serve portal accounts (agencies), backed by Netlify Blobs.
// Account records are encrypted at rest (lib/crypto.js, LAUNCHPAD_MASTER_KEY).
//
// Storage shape (three stores, since Blobs has no secondary indexes):
//   accounts/{accountId}        -> encrypted account record
//   account-email-index/{email} -> { accountId }  (login lookup, plaintext key
//                                    is a normalised email - not sensitive on
//                                    its own, the account record is what's
//                                    encrypted)
//   the tenant registry (lib/tenants.js) is the slug index - a portal account
//   is only ever created alongside a tenant record for the same slug.
//
// Signup claims the slug and the email atomically via onlyIfNew, so two
// people racing for the same subdomain or email can't both win.

import { getStore } from "@netlify/blobs";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { encrypt, decrypt } from "./crypto.js";
import { setJSONAtomic } from "./blobsAtomic.js";
import { createTenant, deleteTenant, slugAvailable, validateSlug } from "./tenants.js";

const ACCOUNTS_STORE = "accounts";
const EMAIL_INDEX_STORE = "account-email-index";
const KEY_LENGTH = 64;

function accountsStore() {
  return getStore({ name: ACCOUNTS_STORE, consistency: "strong" });
}

function emailIndexStore() {
  return getStore({ name: EMAIL_INDEX_STORE, consistency: "strong" });
}

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Same scrypt + salt + timingSafeEqual shape as lib/mcAuth.js - proven
// pattern, zero new dependency, avoids native bcrypt's serverless build risk.
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return { salt, hash };
}

export function matchesPassword(password, { salt, hash }) {
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function saveAccount(record) {
  await accountsStore().set(record.id, encrypt(record));
}

export async function getAccountById(id) {
  if (!id) return null;
  const raw = await accountsStore().get(id);
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch (e) {
    console.error(`[accounts] failed to decrypt account ${id}:`, e.message);
    return null;
  }
}

export async function getAccountByEmail(email) {
  const key = normaliseEmail(email);
  if (!key) return null;
  const index = await emailIndexStore().get(key, { type: "json" });
  if (!index?.accountId) return null;
  return getAccountById(index.accountId);
}

// Creates the tenant record + account together, atomically claiming both the
// slug and the email. Throws a user-facing Error on any conflict.
export async function createAccount({ agencyName, slug, contactEmail, password, acceptedTermsAt }) {
  const email = normaliseEmail(contactEmail);
  const cleanSlug = String(slug || "").trim().toLowerCase();

  if (!agencyName?.trim()) throw new Error("Enter your agency name");
  if (!validateSlug(cleanSlug) || !slugAvailable(cleanSlug)) {
    throw new Error("Choose a different subdomain");
  }
  if (!validateEmail(email)) throw new Error("Enter a valid contact email");
  if (!validatePassword(password)) throw new Error("Password must be at least 8 characters");
  if (!acceptedTermsAt) throw new Error("You must accept the licence terms");

  const accountId = randomUUID();

  // Step 1: claim the slug by creating its tenant record.
  const tenantCreated = await createTenant({
    slug: cleanSlug,
    name: agencyName.trim(),
    ownerAccountId: accountId,
  });
  if (!tenantCreated) throw new Error("That subdomain is already in use");

  // Step 2: claim the email.
  const { modified: emailClaimed } = await setJSONAtomic(
    emailIndexStore(),
    email,
    { accountId },
    { onlyIfNew: true }
  );
  if (!emailClaimed) {
    // Compensating action - nothing referenced the tenant record yet.
    await deleteTenant(cleanSlug).catch(() => {});
    throw new Error("An account with that email already exists");
  }

  // Step 3: write the account record - fresh UUID key, no contention.
  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  const record = {
    id: accountId,
    agencyName: agencyName.trim(),
    slug: cleanSlug,
    contactEmail: email,
    passwordSalt: salt,
    passwordHash: hash,
    acceptedTermsAt,
    onboarding: {
      activated: false,
      planLabel: null,
      ghlAgencyConnected: false,
      ghlLocationConnected: false,
      snapshotId: null,
      brandingDone: false,
      completedAt: null,
    },
    createdAt: now,
    updatedAt: now,
  };
  await saveAccount(record);
  return record;
}

export async function verifyAccountPassword(email, password) {
  const account = await getAccountByEmail(email);
  if (!account) return null;
  return matchesPassword(password, { salt: account.passwordSalt, hash: account.passwordHash }) ? account : null;
}

export async function updateAccount(id, patch) {
  const account = await getAccountById(id);
  if (!account) return null;
  const next = { ...account, ...patch, updatedAt: new Date().toISOString() };
  await saveAccount(next);
  return next;
}

export async function updateOnboarding(id, patch) {
  const account = await getAccountById(id);
  if (!account) return null;
  const next = {
    ...account,
    onboarding: { ...account.onboarding, ...patch },
    updatedAt: new Date().toISOString(),
  };
  await saveAccount(next);
  return next;
}

// Called after each onboarding step updates its own flag - flips
// onboarding.completedAt once all four are true, exactly once.
export async function maybeCompleteOnboarding(id) {
  const account = await getAccountById(id);
  if (!account) return null;
  const o = account.onboarding;
  const allDone = Boolean(o.activated && o.ghlAgencyConnected && o.ghlLocationConnected && o.snapshotId && o.brandingDone);
  if (allDone && !o.completedAt) {
    return updateOnboarding(id, { completedAt: new Date().toISOString() });
  }
  return account;
}

export async function setAccountPassword(id, password) {
  if (!validatePassword(password)) throw new Error("Password must be at least 8 characters");
  const { salt, hash } = hashPassword(password);
  return updateAccount(id, { passwordSalt: salt, passwordHash: hash });
}

// Redacted, client-safe view - never include passwordSalt/passwordHash.
export function publicAccount(account) {
  if (!account) return null;
  const { passwordSalt, passwordHash, ...safe } = account;
  return safe;
}

export async function listAccounts() {
  const { blobs } = await accountsStore().list();
  const records = await Promise.all(blobs.map(({ key }) => getAccountById(key)));
  return records.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
