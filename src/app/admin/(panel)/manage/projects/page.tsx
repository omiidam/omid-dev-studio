import { ManagedProjectsList } from "@/components/admin/managed/ManagedProjectsList";
import { ManagedProjectsHeading } from "@/components/admin/managed/ManagedProjectsList";

export const metadata = { title: "پروژه‌ها" };

/** Phase 1 — managed projects list (frontend-only data). */
export default function ManageProjectsPage() {
  return (
    <div className="space-y-6">
      <ManagedProjectsHeading />
      <ManagedProjectsList />
    </div>
  );
}
