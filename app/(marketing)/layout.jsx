import { Suspense } from "react";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { Header } from "@/components/miia/Header";
import { Footer } from "@/components/miia/Footer";
import { ScrollbarTheme } from "@/components/miia/ScrollbarTheme";
import { MetaPixel } from "@/components/miia/MetaPixel";
import { MiiaWidgetEmbed } from "@/components/miia/MiiaWidgetEmbed";
import "@/components/miia/tokens.css";

// Turned off 2026-07-31 after live "Something went wrong" errors, then back
// on the same day once job 2 (background-function + polling rewrite,
// replacing the live-streaming design those errors came from) verified 5/5
// real messages with complete transcripts on a staging deploy.
const MARKETING_WIDGET_ENABLED = true;

// Per Miia-Brand-Guidelines.pdf v1.0: Space Grotesk carries everything
// (headlines, UI, body), Space Mono is accent-only. Scoped to this route
// group via the .miia wrapper below so the app shell (Mission Control,
// portal, admin) keeps its own Inter/Space Grotesk pairing from the root
// layout untouched.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-miia-display",
  display: "swap",
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-miia-mono",
  display: "swap",
});

export default function MarketingLayout({ children }) {
  return (
    <div className={`miia ${display.variable} ${mono.variable}`}>
      <ScrollbarTheme />
      <Suspense fallback={null}>
        <MetaPixel pixelId={process.env.META_PIXEL_ID} />
      </Suspense>
      <Header />
      {children}
      <Footer />
      {MARKETING_WIDGET_ENABLED && <MiiaWidgetEmbed />}
    </div>
  );
}
