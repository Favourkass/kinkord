import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meet the Team — Kinkord",
  description: "Discover the innovators behind our vision. Meet the people building Kinkord.",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
