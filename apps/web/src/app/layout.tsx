import type { Metadata, Viewport } from "next";
import { SEO_COPY, SITE_URL } from "@/constants/seo";
import { Playfair_Display, Inter } from "next/font/google";
import { themeInitScript } from "@/util/theme";
import { pwaInitScript } from "@/util/pwaInit";
import { PwaWrapper } from "./PwaWrapper";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Site-wide defaults. No canonical here: a page without its own would inherit
// it and tell search engines it's a copy of the homepage.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO_COPY.site.title,
  description: SEO_COPY.site.description,
  applicationName: "Kinkord",
  keywords: [...SEO_COPY.site.keywords],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kinkord",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Kinkord",
    locale: "en_NG",
    title: SEO_COPY.site.title,
    description: SEO_COPY.site.description,
  },
  twitter: { card: "summary", title: SEO_COPY.site.title, description: SEO_COPY.site.description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#0a0a0a] text-[#f5f5f0] antialiased overflow-x-hidden"
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: pwaInitScript }} />
        {children}
        <PwaWrapper />
      </body>
    </html>
  );
}
