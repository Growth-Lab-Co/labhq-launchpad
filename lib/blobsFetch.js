// @netlify/blobs' Client uses whatever `fetch` it's given (defaulting to
// globalThis.fetch) with no cache-busting options of its own. Next.js patches
// globalThis.fetch server-side to cache GET requests by default, and the
// Blobs SDK never opts out - verified directly: writing a new value to an
// EXISTING key and reading it back immediately, through the SDK, kept
// returning the value from before the write (for as long as a minute),
// while the exact same sequence against the Blobs server's raw HTTP API
// (bypassing Next's fetch) was correct every time. That makes any
// read-after-write in this codebase unreliable - a password just set, a
// session just created, a rate-limit counter just incremented - without
// this. Every getStore() call in the app should go through blobStore()
// instead of importing getStore directly, so reads always hit the network.
import { getStore } from "@netlify/blobs";

function noStoreFetch(url, options) {
  return fetch(url, { ...options, cache: "no-store" });
}

export function blobStore(options) {
  return getStore({ ...options, fetch: noStoreFetch });
}
