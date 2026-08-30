import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Kinkord — Where Kinksters Connect",
  description:
    "Where kinksters connect, explore their interests, build meaningful relationships, and find a community where they truly belong.",
  keywords: ["kinkord", "lifestyle community", "adult community", "consent", "education"],
  openGraph: {
    title: "Kinkord — Where Kinksters Connect",
    description:
      "Where kinksters connect, explore their interests, build meaningful relationships, and find a community where they truly belong.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-[#0a0a0a] text-[#f5f5f0] antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
