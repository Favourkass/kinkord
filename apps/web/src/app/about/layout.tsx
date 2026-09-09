import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Kinkord — The World's Kink Community",
  description: "What Kinkord is, our mission, and the people behind our vision.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
