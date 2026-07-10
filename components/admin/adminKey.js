const SESSION_KEY = "labhq:admin:key";

export function getAdminKey() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SESSION_KEY);
}

export function adminFetch(url, { method = "GET", body } = {}) {
  return fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-mc-key": getAdminKey() || "",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  });
}

export { SESSION_KEY };
