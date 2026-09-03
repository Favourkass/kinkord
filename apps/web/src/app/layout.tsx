import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: "Kinkord — Where Kinksters Connect",
  description:
    "Where kinksters connect, explore their interests, build meaningful relationships, and find a community where they truly belong.",
  applicationName: "Kinkord",
  keywords: ["kinkord", "lifestyle community", "adult community", "consent", "education"],
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
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Kinkord — Where Kinksters Connect",
    description:
      "Where kinksters connect, explore their interests, build meaningful relationships, and find a community where they truly belong.",
    type: "website",
  },
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

