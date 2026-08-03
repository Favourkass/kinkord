"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import type { Lecture, LectureLink } from "@/lib/types";

const CATEGORIES = [
  "Consent & Communication",
  "BDSM Fundamentals",
  "Relationship Dynamics",
  "Safety Practices",
  "Community Etiquette",
  "Lifestyle Exploration",
  "Workshops & Discussions",
  "General",
];

interface Props {
  initial?: Partial<Lecture>;
  mode: "create" | "edit";
}

export default function LectureForm({ initial = {}, mode }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title ?? "");
  const [category, setCategory] = useState(initial.category ?? CATEGORIES[0]);
  const [body, setBody] = useState(initial.body ?? "");
  const [links, setLinks] = useState<LectureLink[]>(initial.links ?? []);
  const [published, setPublished] = useState(initial.published ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "" }]);
  }

  function updateLink(i: number, field: keyof LectureLink, val: string) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = { title, category, body, links, published };
    const url = mode === "edit" ? `/api/lectures/${initial.id}` : "/api/lectures";
    const method = mode === "edit" ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Something went wrong. Please try again.");
    }
  }

  const inputClass =
    "w-full bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5f5f0] px-4 py-3 text-sm focus:outline-none focus:border-[#d4af37]/50 transition-colors placeholder:text-[#333]";
  const labelClass = "block text-[10px] uppercase tracking-widest text-[#888] mb-2";

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <header className="border-b border-[#d4af37]/10 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/admin")}
          className="text-[#555] hover:text-[#d4af37] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1
            className="text-lg font-bold tracking-[0.2em] uppercase gold-gradient"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {mode === "create" ? "New Lecture" : "Edit Lecture"}
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Title */}
          <div>
            <label className={labelClass}>Lecture Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Introduction to Consent Communication"
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-[#0d0d0d]">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Body */}
          <div>
            <label className={labelClass}>
              Lecture Body *
              <span className="ml-2 text-[#444] normal-case tracking-normal">
                (Each blank line = new paragraph)
              </span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={14}
              placeholder={"Write the lecture content here.\n\nStart a new paragraph by leaving a blank line between sections.\n\nYou can add as many paragraphs as needed."}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </div>

          {/* External Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={`${labelClass} mb-0`}>
                External Links
                <span className="ml-2 text-[#444] normal-case tracking-normal">
                  (optional — videos, resources)
                </span>
              </label>
              <button
                type="button"
                onClick={addLink}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#d4af37] hover:text-[#f5e27d] transition-colors"
              >
                <Plus size={12} /> Add Link
              </button>
            </div>

            {links.length === 0 && (
              <p className="text-[11px] text-[#333] border border-dashed border-[#d4af37]/08 py-4 text-center">
                No links added yet.
              </p>
            )}

            <div className="space-y-3">
              {links.map((link, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateLink(i, "label", e.target.value)}
                    placeholder="Button label (e.g. Watch Video)"
                    className="flex-[1] bg-[#0a0a0a] border border-[#d4af37]/15 text-[#f5f5f0] px-3 py-2.5 text-xs focus:outline-none focus:border-[#d4af37]/40 transition-colors placeholder:text-[#333]"
                  />
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    placeholder="https://..."
                    className="flex-[2] bg-[#0a0a0a] border border-[#d4af37]/15 text-[#f5f5f0] px-3 py-2.5 text-xs focus:outline-none focus:border-[#d4af37]/40 transition-colors placeholder:text-[#333]"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(i)}
                    className="text-[#555] hover:text-red-400 transition-colors pt-2.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Published toggle */}
          <div className="flex items-center justify-between border border-[#d4af37]/10 px-5 py-4">
            <div>
              <p className="text-sm text-[#f5f5f0] font-medium">Publish Lecture</p>
              <p className="text-[10px] text-[#555] mt-0.5">
                {published ? "Visible to the public on /lectures" : "Draft — not visible to the public"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPublished((p) => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                published ? "bg-[#d4af37]" : "bg-[#222]"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                  published ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 border border-red-400/20 px-4 py-3">{error}</p>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#d4af37] text-[#0a0a0a] px-8 py-3 text-sm font-bold uppercase tracking-widest hover:bg-[#f5e27d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : mode === "create" ? "Create Lecture" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="text-[#555] text-sm hover:text-[#888] transition-colors uppercase tracking-widest text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
