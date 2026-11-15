import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, IBM_Plex_Mono, Inter } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { profile } from "@/content";
import { buildPersonJsonLd } from "@/content/jsonld";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// display: "optional" means a face that is not ready within the brief block period is
// skipped for that page view instead of swapped in later. next/font's metric-matched
// fallback is built on local Arial, which Linux and most Android phones lack, so a late
// swap reflowed whole paragraphs there (Lighthouse CLS 0.13 to 0.16 on Linux CI).
// The display and body faces are preloaded so they are usually ready in time; the mono
// face only sets small slot labels and loads from the stylesheet.
const display = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  display: "optional",
});

const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "optional",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: "500",
  display: "optional",
  preload: false,
});

const defaultTitle = `${profile.name} | ${profile.title}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: defaultTitle, template: `%s | ${profile.name}` },
  description: profile.roleLine,
  authors: [{ name: profile.name, url: SITE_URL }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: profile.name,
    title: defaultTitle,
    description: profile.roleLine,
  },
  twitter: { card: "summary_large_image", title: defaultTitle, description: profile.roleLine },
};

// No maximumScale: pinch zoom stays available.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <JsonLd data={buildPersonJsonLd()} />
      </body>
    </html>
  );
}
