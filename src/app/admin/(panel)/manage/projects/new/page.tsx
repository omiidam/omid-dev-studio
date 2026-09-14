import { ManagedProjectForm } from "@/components/admin/managed/ManagedProjectForm";

export const metadata = { title: "ایجاد پروژه" };

/** Phase 1 — create project form (frontend-only submission). */
export default function NewManagedProjectPage() {
  return <ManagedProjectForm />;
}
