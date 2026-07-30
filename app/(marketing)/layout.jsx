import { Suspense } from "react";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { Header } from "@/components/miia/Header";
import { Footer } from "@/components/miia/Footer";
import { ScrollbarTheme } from "@/components/miia/ScrollbarTheme";
import { MetaPixel } from "@/components/miia/MetaPixel";
import { MiiaWidgetEmbed } from "@/components/miia/MiiaWidgetEmbed";
import "@/components/miia/tokens.css";

// Turned off 2026-07-31: the widget was returning "Something went wrong -
// try again." live on the homepage - a broken chat is worse than no chat.
// Flip back to true once job 2 (background-function + polling rewrite) is
// verified 5/5 on staging - see MiiaWidgetEmbed.jsx.
const MARKETING_WIDGET_ENABLED = false;

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
