import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Inter drives all app UI (tables, buttons, forms). Space Grotesk is scoped
// to the wordmark/logo and marketing copy only — see --font-display in
// app/tokens.css.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata = {
  title: "Lab HQ — powered by Launchpad",
  description: "Your automated onboarding system, deployed through a conversation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
