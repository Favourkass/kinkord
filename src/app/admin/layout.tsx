import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Kinkord",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f5f0]">
      {children}
    </div>
  );
}
