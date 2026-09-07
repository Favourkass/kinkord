import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — Kinkord",
  description: "Reach out to Kinkord for support, inquiries, or to report any issues.",
  openGraph: {
    title: "Contact Us — Kinkord",
    description: "Reach out to Kinkord for support, inquiries, or to report any issues.",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
