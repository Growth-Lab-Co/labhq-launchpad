// Workaround for a real bug in @netlify/blobs (confirmed present through the
// latest published version, 10.7.9): Store.setJSON() spreads its resolved
// `conditions` object into the top-level request options instead of nesting
// it under a `conditions` key that Client.makeRequest() actually reads, so
// onlyIfNew/onlyIfMatch are silently dropped and every "atomic" setJSON call
// succeeds unconditionally - verified by inspecting the outgoing request
// (no if-none-match/if-match header ever sent) against a local Blobs server
// that DOES enforce the precondition correctly when sent directly.
// Store.set() (the raw string/Buffer variant) passes conditions correctly,
// so every atomic write in this codebase goes through this helper instead of
// store.setJSON(..., {onlyIfNew|onlyIfMatch}) directly.
export async function setJSONAtomic(store, key, data, options) {
  return store.set(key, JSON.stringify(data), options);
}
