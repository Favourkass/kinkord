import type { ReactNode } from "react";
import { Manrope, Sora } from "next/font/google";

// The Silver screens' own type (Figma: Sora for headings and prices, Manrope for
// the rest), loaded here so only these routes fetch it.
const sora = Sora({ variable: "--font-sora-face", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope-face", subsets: ["latin"], display: "swap" });

export default function SubscriptionLayout({ children }: { children: ReactNode }) {
  // Line height is each font's own, as Figma sets it ("auto"), not the app's 1.5.
  return (
    <div className={`${sora.variable} ${manrope.variable} font-manrope leading-[1.366]`}>
      {children}
    </div>
  );
}
