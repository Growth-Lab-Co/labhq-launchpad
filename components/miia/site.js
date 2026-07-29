// Single edit point for the eventual domain move to meetmiia.com — see
// task brief ("build domain-agnostic"). Everything that needs an absolute
// URL (OG tags, JSON-LD, sitemap) reads from here.
export const SITE_URL = "https://meetmiia.com";
export const SITE_NAME = "Miia";

// Job 3 (2026-07-29 "simplification build") - the Miia Voice card's "Book a
// 15 minute demo" link. PLACEHOLDER until the real calendar link is
// provided - update this one const, no other file references a booking
// URL for Voice. See MORNING-REPORT-style summary for this build: flagged
// there as a blocker needing the real link.
export const BOOKING_URL = "https://calendly.com/miia-voice-demo/15min";
