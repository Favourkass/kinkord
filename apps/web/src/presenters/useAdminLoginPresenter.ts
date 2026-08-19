"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Routes } from "@/constants/Routes";

export function useAdminLoginPresenter() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (res.ok) {
      const from = params.get("from") ?? Routes.admin;
      router.push(from);
      return;
    }

    setError("Invalid username or password.");
  }

  return {
    username,
    password,
    error,
    loading,
    setUsername,
    setPassword,
    submit,
  };
}
