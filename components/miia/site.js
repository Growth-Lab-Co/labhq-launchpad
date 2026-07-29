// Single edit point for the eventual domain move to meetmiia.com — see
// task brief ("build domain-agnostic"). Everything that needs an absolute
// URL (OG tags, JSON-LD, sitemap) reads from here.
export const SITE_URL = "https://meetmiia.com";
export const SITE_NAME = "Miia";

// Job 3 (2026-07-29 "simplification build") - the Miia Voice card's "Book a
// 15 minute demo" link. Real link, set 2026-07-29 - update this one const,
// no other file references a booking URL for Voice.
export const BOOKING_URL = "https://my.growthlabco.com.au/widget/booking/3b70X4ZzTZEWNuLDE8lG";
