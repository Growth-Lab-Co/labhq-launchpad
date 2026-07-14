// Core Netlify Blobs backup/restore logic, shared by three callers:
// netlify/functions/backup-blobs.mjs (daily scheduled run), the admin
// "Back up now" button (app/api/admin/backups/route.js), and the CLI restore
// script (scripts/restore-backup.mjs). All three pass an `auth` override
// ({siteID, token}) when they're not running inside a Netlify request (the
// CLI script always needs it - see that file for why); inside a Netlify
// Function or Next.js route on Netlify, blobStore() picks up the ambient
// context automatically and `auth` stays {}.
//
// Every value is captured as raw bytes (arrayBuffer) rather than typed
// (json/text), so encrypted strings (ghl-connections, accounts) and binary
// blobs (branding-assets) all round-trip byte-for-byte with no per-store
// special-casing, and nothing is ever decrypted in the process.

import zlib from "node:zlib";
import { blobStore } from "./blobsFetch.js";
import { BACKUP_STORE_NAMES } from "./backupStores.js";

const BACKUP_STORE_NAME = "backups";
const RETAIN_COUNT = 30;
const AEST_OFFSET_MS = 10 * 60 * 60 * 1000; // Queensland doesn't observe DST - fixed UTC+10 year-round

function backupsStore(auth = {}) {
  return blobStore({ name: BACKUP_STORE_NAME, consistency: "strong", ...auth });
}

function dataStore(name, auth = {}) {
  return blobStore({ name, consistency: "strong", ...auth });
}

export function aestDateLabel(date = new Date()) {
  return new Date(date.getTime() + AEST_OFFSET_MS).toISOString().slice(0, 10);
}

export function snapshotKey(dateLabel) {
  return `backup/${dateLabel}.json.gz`;
}

async function exportStore(name, auth) {
  const store = dataStore(name, auth);
  const { blobs } = await store.list();
  const entries = {};
  for (const { key } of blobs) {
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) continue;
    entries[key] = {
      data: Buffer.from(result.data).toString("base64"),
      metadata: result.metadata || {},
    };
  }
  return { count: blobs.length, entries };
}

export async function buildSnapshot({ trigger = "scheduled", auth = {} } = {}) {
  const dateLabel = aestDateLabel();
  const stores = {};
  for (const name of BACKUP_STORE_NAMES) {
    stores[name] = await exportStore(name, auth);
  }
  return { version: 1, createdAt: new Date().toISOString(), dateLabel, trigger, stores };
}

export async function runBackup({ trigger = "scheduled", auth = {} } = {}) {
  const snapshot = await buildSnapshot({ trigger, auth });
  const json = JSON.stringify(snapshot);
  const gz = zlib.gzipSync(Buffer.from(json, "utf8"));
  const key = snapshotKey(snapshot.dateLabel);

  const counts = Object.fromEntries(Object.entries(snapshot.stores).map(([k, v]) => [k, v.count]));
  const totalKeys = Object.values(counts).reduce((a, b) => a + b, 0);

  await backupsStore(auth).set(key, gz, {
    metadata: {
      dateLabel: snapshot.dateLabel,
      createdAt: snapshot.createdAt,
      trigger: snapshot.trigger,
      sizeBytes: gz.byteLength,
      totalKeys,
      counts,
    },
  });

  const pruned = await pruneSnapshots({ auth });
  return { key, dateLabel: snapshot.dateLabel, sizeBytes: gz.byteLength, totalKeys, counts, pruned };
}

export async function listSnapshots({ auth = {} } = {}) {
  const store = backupsStore(auth);
  const { blobs } = await store.list({ prefix: "backup/" });
  const results = await Promise.all(
    blobs.map(async ({ key }) => {
      const meta = await store.getMetadata(key);
      return { key, ...(meta?.metadata || {}) };
    })
  );
  return results.sort((a, b) => (a.dateLabel < b.dateLabel ? 1 : a.dateLabel > b.dateLabel ? -1 : 0));
}

export async function pruneSnapshots({ keep = RETAIN_COUNT, auth = {} } = {}) {
  const snapshots = await listSnapshots({ auth });
  const toDelete = snapshots.slice(keep);
  const store = backupsStore(auth);
  await Promise.all(toDelete.map((s) => store.delete(s.key)));
  return toDelete.map((s) => s.key);
}

export async function loadSnapshot(dateLabel, { auth = {} } = {}) {
  const raw = await backupsStore(auth).get(snapshotKey(dateLabel), { type: "arrayBuffer" });
  if (!raw) return null;
  const json = zlib.gunzipSync(Buffer.from(raw)).toString("utf8");
  return JSON.parse(json);
}

// Compares a snapshot's captured entries for one store against that store's
// live state right now. Read-only - safe to call from a dry run or as the
// first half of a real restore.
export async function diffStore(name, snapshotEntries, auth = {}) {
  const store = dataStore(name, auth);
  const { blobs } = await store.list();
  const liveKeys = new Set(blobs.map((b) => b.key));
  const snapKeys = Object.keys(snapshotEntries);

  const toAdd = [];
  const toUpdate = [];
  const unchanged = [];

  for (const key of snapKeys) {
    const snap = snapshotEntries[key];
    if (!liveKeys.has(key)) {
      toAdd.push(key);
      continue;
    }
    const live = await store.getWithMetadata(key, { type: "arrayBuffer" });
    const liveB64 = live ? Buffer.from(live.data).toString("base64") : null;
    const sameData = liveB64 === snap.data;
    const sameMeta = JSON.stringify(live?.metadata || {}) === JSON.stringify(snap.metadata || {});
    (sameData && sameMeta ? unchanged : toUpdate).push(key);
  }

  const extraneous = [...liveKeys].filter((key) => !(key in snapshotEntries));

  return { toAdd, toUpdate, unchanged, extraneous };
}

// dryRun (default) only ever calls diffStore - guaranteed no writes.
// A real restore upserts every toAdd/toUpdate key from the snapshot, and
// only deletes live-only (extraneous) keys if deleteExtraneous is explicitly
// set - restoring after data loss should never silently delete newer data
// that was created after the snapshot was taken.
export async function restoreStore(name, snapshotEntries, { dryRun = true, deleteExtraneous = false, auth = {} } = {}) {
  const diff = await diffStore(name, snapshotEntries, auth);
  if (dryRun) return diff;

  const store = dataStore(name, auth);
  for (const key of [...diff.toAdd, ...diff.toUpdate]) {
    const entry = snapshotEntries[key];
    await store.set(key, Buffer.from(entry.data, "base64"), { metadata: entry.metadata || {} });
  }
  if (deleteExtraneous) {
    for (const key of diff.extraneous) await store.delete(key);
  }
  return diff;
}
