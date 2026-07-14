// Restores (or dry-run diffs) a Netlify Blobs backup snapshot created by
// netlify/functions/backup-blobs.mjs / the admin "Back up now" button.
// See DEPLOY.md "Disaster recovery" for full docs.
//
// Usage:
//   node scripts/restore-backup.mjs --list
//   node scripts/restore-backup.mjs --date 2026-07-14 --dry-run
//   node scripts/restore-backup.mjs --date 2026-07-14 --store tenants --dry-run
//   node scripts/restore-backup.mjs --date 2026-07-14                  # restores everything, prompts to confirm
//   node scripts/restore-backup.mjs --date 2026-07-14 --store tenants  # restores one store
//   node scripts/restore-backup.mjs --date 2026-07-14 --delete-extraneous --yes
//
// --delete-extraneous also deletes live keys that exist now but weren't in
// the snapshot (a true point-in-time rollback). Without it (the default),
// restore only adds/overwrites keys from the snapshot and never deletes -
// the right default for "recover what we lost", since a disaster is data
// going missing, not new data appearing that needs to be erased.
//
// Auth: needs NETLIFY_API_TOKEN (a personal access token - see
// app.netlify.com/user/applications) and a site ID, either via
// NETLIFY_SITE_ID or (default) read from .netlify/state.json, same as the
// Netlify CLI itself uses for this linked project. Reads .env.local for
// convenience, same convention as scripts/test-ghl.mjs.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { BACKUP_STORE_NAMES } from "../lib/backupStores.js";
import { listSnapshots, loadSnapshot, restoreStore, aestDateLabel } from "../lib/backup.js";

try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.log("(.env.local not found - using shell env)");
}

function resolveSiteId() {
  if (process.env.NETLIFY_SITE_ID) return process.env.NETLIFY_SITE_ID;
  try {
    const state = JSON.parse(readFileSync(new URL("../.netlify/state.json", import.meta.url), "utf8"));
    if (state.siteId) return state.siteId;
  } catch {
    // fall through to the error below
  }
  return null;
}

function parseArgs(argv) {
  const args = { list: false, dryRun: false, yes: false, deleteExtraneous: false, date: null, store: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--delete-extraneous") args.deleteExtraneous = true;
    else if (a === "--date") args.date = argv[++i];
    else if (a === "--store") args.store = argv[++i];
    else {
      console.error(`Unrecognized argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} (type "yes" to proceed): `);
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

const args = parseArgs(process.argv.slice(2));

const token = process.env.NETLIFY_API_TOKEN;
const siteID = resolveSiteId();
if (!token || !siteID) {
  console.error(
    "Missing auth. Set NETLIFY_API_TOKEN in .env.local (a personal access token from app.netlify.com/user/applications)" +
      (siteID ? "" : ", and NETLIFY_SITE_ID (or run this from a directory with a linked .netlify/state.json).")
  );
  process.exit(1);
}
const auth = { siteID, token };

if (args.list) {
  const snapshots = await listSnapshots({ auth });
  if (!snapshots.length) {
    console.log("No snapshots yet.");
    process.exit(0);
  }
  console.log(`${"Date".padEnd(12)}  ${"Trigger".padEnd(10)}  ${"Keys".padEnd(6)}  ${"Size".padEnd(10)}  Created`);
  for (const s of snapshots) {
    console.log(
      `${(s.dateLabel || "-").padEnd(12)}  ${(s.trigger || "-").padEnd(10)}  ${String(s.totalKeys ?? "-").padEnd(6)}  ${formatSize(s.sizeBytes).padEnd(10)}  ${s.createdAt || "-"}`
    );
  }
  process.exit(0);
}

if (!args.date) {
  console.error("Missing --date YYYY-MM-DD (or use --list to see available snapshots). Today in AEST: " + aestDateLabel());
  process.exit(1);
}

if (args.store && !BACKUP_STORE_NAMES.includes(args.store)) {
  console.error(`Unknown store "${args.store}". Known stores: ${BACKUP_STORE_NAMES.join(", ")}`);
  process.exit(1);
}

const snapshot = await loadSnapshot(args.date, { auth });
if (!snapshot) {
  console.error(`No snapshot found for ${args.date}. Run with --list to see what's available.`);
  process.exit(1);
}

const targetStores = args.store ? [args.store] : BACKUP_STORE_NAMES;
console.log(
  `Snapshot ${args.date} - created ${snapshot.createdAt} (${snapshot.trigger}). Restoring ${targetStores.length} store(s)${args.dryRun ? " [DRY RUN]" : ""}.\n`
);

const grand = { toAdd: 0, toUpdate: 0, unchanged: 0, extraneous: 0 };
const diffs = {};

for (const name of targetStores) {
  const entries = snapshot.stores[name]?.entries;
  if (!entries) {
    console.log(`${name.padEnd(24)} (not present in this snapshot - skipped)`);
    continue;
  }
  const diff = await restoreStore(name, entries, { dryRun: true, auth });
  diffs[name] = diff;
  grand.toAdd += diff.toAdd.length;
  grand.toUpdate += diff.toUpdate.length;
  grand.unchanged += diff.unchanged.length;
  grand.extraneous += diff.extraneous.length;
  console.log(
    `${name.padEnd(24)} +${diff.toAdd.length} add  ~${diff.toUpdate.length} update  =${diff.unchanged.length} unchanged  ${diff.extraneous.length} extraneous${args.deleteExtraneous && diff.extraneous.length ? " (will delete)" : ""}`
  );
}

console.log(
  `\nTotal: +${grand.toAdd} add  ~${grand.toUpdate} update  =${grand.unchanged} unchanged  ${grand.extraneous} extraneous${
    args.deleteExtraneous ? " (will delete)" : " (kept - pass --delete-extraneous to remove)"
  }`
);

if (args.dryRun) {
  console.log("\nDry run only - nothing was written.");
  process.exit(0);
}

if (grand.toAdd === 0 && grand.toUpdate === 0 && (!args.deleteExtraneous || grand.extraneous === 0)) {
  console.log("\nNothing to change - live data already matches this snapshot.");
  process.exit(0);
}

if (!args.yes) {
  const ok = await confirm(
    `\nThis will write ${grand.toAdd + grand.toUpdate} key(s)${args.deleteExtraneous ? ` and delete ${grand.extraneous} key(s)` : ""} across ${targetStores.length} store(s). Proceed?`
  );
  if (!ok) {
    console.log("Aborted - nothing was written.");
    process.exit(1);
  }
}

for (const name of targetStores) {
  const entries = snapshot.stores[name]?.entries;
  if (!entries) continue;
  await restoreStore(name, entries, { dryRun: false, deleteExtraneous: args.deleteExtraneous, auth });
  console.log(`Restored ${name}`);
}

console.log("\nDone.");
