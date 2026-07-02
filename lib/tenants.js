// One record per agency (or Growth Lab itself for direct SMB deployments).
// Adding a tenant = adding an object here + their env vars in .env.
// envPrefix maps to {PREFIX}_GHL_TOKEN / {PREFIX}_GHL_COMPANY_ID / {PREFIX}_GHL_SNAPSHOT_ID.
// Growth Lab's own tenant uses the base GHL_* vars (envPrefix: null).

export const TENANTS = {
  growthlab: {
    slug: "growthlab",
    name: "Growth Lab Co.",
    assistantName: "Mia",
    logoText: "Growth Lab Co.",
    logoUrl: null,
    accent: "#A070F8",
    accentSoft: "#9878F0",
    envPrefix: null,
    welcome: "the team at Growth Lab Co. is setting up your automated onboarding system",
  },
  obm: {
    slug: "obm",
    name: "On Brand Marketing",
    assistantName: "Mia",
    logoText: "On Brand Marketing",
    logoUrl: null, // drop their logo into /public and set e.g. "/obm-logo.png"
    accent: "#A070F8", // swap to OBM brand colour when they send assets
    accentSoft: "#9878F0",
    envPrefix: "OBM",
    welcome: "the team at On Brand Marketing is setting up your automated onboarding system",
  },
  demo: {
    slug: "demo",
    name: "Lab HQ Demo",
    assistantName: "Mia",
    logoText: "Lab HQ",
    logoUrl: null,
    accent: "#A070F8",
    accentSoft: "#9878F0",
    envPrefix: "DEMO", // no DEMO_* vars exist -> always demo mode (no real GHL calls)
    welcome: "we're setting up your automated onboarding system",
  },
};

export function getTenant(slug) {
  return TENANTS[slug] || null;
}

export function ghlCredsFor(tenant) {
  const p = tenant.envPrefix;
  const token = p ? process.env[`${p}_GHL_TOKEN`] : process.env.GHL_AGENCY_TOKEN;
  const companyId = p ? process.env[`${p}_GHL_COMPANY_ID`] : process.env.GHL_COMPANY_ID;
  const snapshotId = p ? process.env[`${p}_GHL_SNAPSHOT_ID`] : process.env.GHL_SNAPSHOT_ID;
  const configured = Boolean(token && companyId && snapshotId);
  return { token, companyId, snapshotId, configured };
}
