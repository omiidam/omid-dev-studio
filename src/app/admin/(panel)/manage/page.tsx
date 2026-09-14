import { ManagedDashboard } from "@/components/admin/managed/ManagedDashboard";

export const metadata = { title: "مدیریت پروژه‌ها" };

/** Phase 1 — management dashboard (frontend-only data). Lives beside the
 * existing inquiry dashboard at /admin; this route is /admin/manage. */
export default function AdminManagePage() {
  return <ManagedDashboard />;
}
