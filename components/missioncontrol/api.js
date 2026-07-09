// Thin fetch wrapper for Mission Control's client-side data calls. Every
// authenticated endpoint takes the operator's password via x-mc-key.

export async function mcFetch(url, { mcKey, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(mcKey ? { "x-mc-key": mcKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
