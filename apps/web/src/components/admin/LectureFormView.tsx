"use client";

import { FormEvent } from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import type { LectureLink } from "@/domain/lecture";

interface Props {
  mode: "create" | "edit";
  categories: string[];
  title: string;
  category: string;
  body: string;
  links: LectureLink[];
  published: boolean;
  saving: boolean;
  error: string;
  setTitle: (value: string) => void;
  setCategory: (value: string) => void;
  setBody: (value: string) => void;
  setPublished: (value: boolean | ((prev: boolean) => boolean)) => void;
  addLink: () => void;
  updateLink: (i: number, field: keyof LectureLink, val: string) => void;
  removeLink: (i: number) => void;
  goBack: () => void;
  submit: (e: FormEvent) => void;
}

export default function LectureFormView({
  mode,
  categories,
  title,
  category,
  body,
  links,
  published,
  saving,
  error,
  setTitle,
  setCategory,
  setBody,
  setPublished,
  addLink,
  updateLink,
  removeLink,
  goBack,
  submit,
}: Props) {
  const inputClass =
    "w-full bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5f5f0] px-4 py-3 text-sm focus:outline-none focus:border-[#d4af37]/50 transition-colors placeholder:text-[#333]";
  const labelClass = "block text-[10px] uppercase tracking-widest text-[#888] mb-2";

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="border-b border-[#d4af37]/10 px-6 py-4 flex items-center gap-4">
        <button
          onClick={goBack}
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
        <form onSubmit={submit} className="space-y-7">
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

          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#0d0d0d]">
                  {c}
                </option>
              ))}
            </select>
          </div>

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
              placeholder={
                "Write the lecture content here.\n\nStart a new paragraph by leaving a blank line between sections.\n\nYou can add as many paragraphs as needed."
              }
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </div>

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

          <div className="flex items-center justify-between border border-[#d4af37]/10 px-5 py-4">
            <div>
              <p className="text-sm text-[#f5f5f0] font-medium">Publish Lecture</p>
              <p className="text-[10px] text-[#555] mt-0.5">
                {published
                  ? "Visible to the public on /lectures"
                  : "Draft — not visible to the public"}
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

          {error && (
            <p className="text-xs text-red-400 border border-red-400/20 px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#d4af37] text-[#0a0a0a] px-8 py-3 text-sm font-bold uppercase tracking-widest hover:bg-[#f5e27d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Create Lecture"
                  : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={goBack}
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
