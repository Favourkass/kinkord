"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff, LogOut } from "lucide-react";
import type { Lecture } from "@/lib/types";

export default function AdminDashboard() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLectures = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lectures?all=true");
    if (res.ok) setLectures(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await fetch(`/api/lectures/${id}`, { method: "DELETE" });
    fetchLectures();
  }

  async function handleTogglePublish(lecture: Lecture) {
    await fetch(`/api/lectures/${lecture.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !lecture.published }),
    });
    fetchLectures();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <header className="border-b border-[#d4af37]/10 px-6 py-4 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-[0.2em] uppercase gold-gradient"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            KINKORD
          </h1>
          <p className="text-[9px] uppercase tracking-widest text-[#555] mt-0.5">
            Admin Dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/lectures"
            target="_blank"
            className="text-[10px] uppercase tracking-widest text-[#888] hover:text-[#d4af37] transition-colors"
          >
            View Site ↗
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#888] hover:text-[#d4af37] transition-colors"
          >
            <LogOut size={12} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2
              className="text-2xl font-bold text-[#f5f5f0]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Lectures
            </h2>
            <p className="text-xs text-[#555] mt-1">
              {lectures.filter((l) => l.published).length} published · {lectures.filter((l) => !l.published).length} drafts
            </p>
          </div>
          <Link
            href="/admin/lectures/new"
            className="flex items-center gap-2 bg-[#d4af37] text-[#0a0a0a] px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[#f5e27d] transition-colors"
          >
            <Plus size={14} /> New Lecture
          </Link>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-[#444] text-sm">Loading…</div>
        ) : lectures.length === 0 ? (
          <div className="border border-dashed border-[#d4af37]/10 py-20 text-center">
            <p className="text-[#555] text-sm mb-4">No lectures yet.</p>
            <Link
              href="/admin/lectures/new"
              className="text-[#d4af37] text-xs uppercase tracking-widest hover:underline"
            >
              Create your first lecture →
            </Link>
          </div>
        ) : (
          <div className="border border-[#d4af37]/10 overflow-hidden">
            {/* Table head */}
            <div className="grid grid-cols-[1fr_140px_90px_120px_90px] bg-[#0d0d0d] border-b border-[#d4af37]/10 px-4 py-3">
              {["Title", "Category", "Status", "Date", "Actions"].map((h) => (
                <span key={h} className="text-[9px] uppercase tracking-widest text-[#555]">
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {lectures.map((lec, i) => (
              <div
                key={lec.id}
                className={`grid grid-cols-[1fr_140px_90px_120px_90px] px-4 py-4 items-center border-b border-[#d4af37]/05 hover:bg-[#0f0f0f] transition-colors ${i % 2 === 0 ? "" : "bg-[#0b0b0b]"}`}
              >
                {/* Title */}
                <div>
                  <p className="text-sm text-[#f5f5f0] font-medium truncate max-w-[280px]">
                    {lec.title}
                  </p>
                  <p className="text-[10px] text-[#444] mt-0.5 truncate max-w-[280px]">
                    /{lec.slug}
                  </p>
                </div>

                {/* Category */}
                <span className="text-[10px] text-[#888] uppercase tracking-wider truncate">
                  {lec.category || "—"}
                </span>

                {/* Status */}
                <span
                  className={`text-[9px] uppercase tracking-widest px-2 py-1 w-fit ${
                    lec.published
                      ? "bg-[#008751]/15 text-[#00bb71]"
                      : "bg-[#d4af37]/10 text-[#d4af37]"
                  }`}
                >
                  {lec.published ? "Live" : "Draft"}
                </span>

                {/* Date */}
                <span className="text-[10px] text-[#555]">
                  {new Date(lec.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleTogglePublish(lec)}
                    title={lec.published ? "Unpublish" : "Publish"}
                    className="text-[#555] hover:text-[#d4af37] transition-colors"
                  >
                    {lec.published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <Link
                    href={`/admin/lectures/${lec.id}/edit`}
                    title="Edit"
                    className="text-[#555] hover:text-[#d4af37] transition-colors"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={() => handleDelete(lec.id, lec.title)}
                    title="Delete"
                    className="text-[#555] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
