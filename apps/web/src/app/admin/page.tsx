"use client";

import { useAdminDashboardPresenter } from "@/presenters/useAdminDashboardPresenter";
import AdminDashboardView from "@/components/admin/AdminDashboardView";

export default function AdminDashboardPage() {
  const presenter = useAdminDashboardPresenter();
  return <AdminDashboardView {...presenter} />;
}
