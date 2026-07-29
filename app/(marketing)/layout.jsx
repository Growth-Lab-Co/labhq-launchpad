import { Suspense } from "react";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { Header } from "@/components/miia/Header";
import { Footer } from "@/components/miia/Footer";
import { ScrollbarTheme } from "@/components/miia/ScrollbarTheme";
import { MetaPixel } from "@/components/miia/MetaPixel";
import "@/components/miia/tokens.css";

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
    </div>
  );
}
