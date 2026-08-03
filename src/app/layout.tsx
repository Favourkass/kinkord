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
  title: "Kinkord — Global Luxury Lifestyle Community",
  description:
    "A global luxury lifestyle community for adults built on consent, education, connection and expression. Coming July 3, 2027.",
  keywords: ["kinkord", "lifestyle community", "adult community", "consent", "education"],
  openGraph: {
    title: "Kinkord — Global Luxury Lifestyle Community",
    description:
      "A global luxury lifestyle community for adults built on consent, education, connection and expression.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-[#0a0a0a] text-[#f5f5f0] antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
