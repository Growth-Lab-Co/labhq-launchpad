# Lab HQ — Launchpad

Multi-tenant deployment engine for Lab HQ onboarding systems.
A business owner has a 10-minute chat; Launchpad configures and deploys their
CRM, pipelines, nurture sequences and Mia (AI voice receptionist) into
GoHighLevel from the Lab HQ snapshot.

- `obm.labhq.co` → On Brand Marketing's branded intake
- `demo.labhq.co` → sales demo (never touches GHL)
- `growthlab.labhq.co` → Growth Lab direct SMB clients

See **DEPLOY.md** for the full launch guide.

Stack: Next.js 14 · Claude API (claude-sonnet-4-6) · GoHighLevel API v2 · Vercel.
