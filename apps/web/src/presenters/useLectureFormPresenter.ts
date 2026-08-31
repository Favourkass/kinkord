"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lecture, LectureLink } from "@/domain/lecture";
import { LECTURE_CATEGORIES } from "@/constants/landing";
import { Routes } from "@/constants/Routes";

interface Args {
  initial?: Partial<Lecture>;
  mode: "create" | "edit";
}

export function useLectureFormPresenter({ initial = {}, mode }: Args) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title ?? "");
  const [category, setCategory] = useState(initial.category ?? LECTURE_CATEGORIES[0]);
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

  function goBack() {
    router.push(Routes.admin);
  }

  async function submit(e: FormEvent) {
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
      router.push(Routes.admin);
      router.refresh();
      return;
    }

    const d = await res.json().catch(() => ({}));
    setError(d.error ?? "Something went wrong. Please try again.");
  }

  return {
    mode,
    categories: [...LECTURE_CATEGORIES],
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
  };
}
