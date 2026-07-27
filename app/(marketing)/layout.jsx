import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/miia/Header";
import { Footer } from "@/components/miia/Footer";
import "@/components/miia/tokens.css";

// Marketing-only font pair. Scoped to this route group via the .miia
// wrapper below so the app shell (Mission Control, portal, admin) keeps
// its own Inter/Space Grotesk pairing from the root layout untouched.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-miia-display",
  display: "swap",
});
const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-miia-body",
  display: "swap",
});

export default function MarketingLayout({ children }) {
  return (
    <div className={`miia ${display.variable} ${body.variable}`}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
