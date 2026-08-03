"use client";

import { Suspense } from "react";
import { useAdminLoginPresenter } from "@/presenters/useAdminLoginPresenter";
import AdminLoginView from "@/components/admin/AdminLoginView";

function AdminLoginScreen() {
  const presenter = useAdminLoginPresenter();
  return <AdminLoginView {...presenter} />;
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginScreen />
    </Suspense>
  );
}
