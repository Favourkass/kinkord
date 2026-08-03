"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lecture } from "@/domain/lecture";
import { lectureToVM, type LectureVM } from "@/domain/lecture";
import { Routes } from "@/constants/Routes";

export function useAdminDashboardPresenter() {
  const router = useRouter();
  const [lectures, setLectures] = useState<LectureVM[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLectures = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lectures?all=true");
    if (res.ok) {
      const data: Lecture[] = await res.json();
      setLectures(data.map(lectureToVM));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLectures();
  }, [fetchLectures]);

  async function deleteLecture(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await fetch(`/api/lectures/${id}`, { method: "DELETE" });
    fetchLectures();
  }

  async function togglePublish(lecture: LectureVM) {
    await fetch(`/api/lectures/${lecture.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !lecture.published }),
    });
    fetchLectures();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(Routes.adminLogin);
  }

  const publishedCount = lectures.filter((l) => l.published).length;
  const draftCount = lectures.length - publishedCount;

  return {
    lectures,
    loading,
    publishedCount,
    draftCount,
    lecturesHref: Routes.lectures,
    newLectureHref: Routes.adminLecturesNew,
    editHref: Routes.adminLectureEdit,
    deleteLecture,
    togglePublish,
    logout,
  };
}
