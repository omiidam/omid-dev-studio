"use client";

import { useParams } from "next/navigation";
import { ManagedProjectForm } from "@/components/admin/managed/ManagedProjectForm";
import {
  ManagedDetailSkeleton,
  ManagedDetailStateless,
} from "@/components/admin/managed/ManagedDetailStates";
import { useManagedProject } from "@/lib/managed-project-store";

/** Phase 3 — edit form, loaded from the real API. */
export default function EditManagedProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { project, error, notFound, loading } = useManagedProject(id);

  if (notFound) {
    return <ManagedDetailStateless message="پروژه پیدا نشد." />;
  }
  if (error) {
    return <ManagedDetailStateless message={error} />;
  }
  if (loading || !project) {
    return <ManagedDetailSkeleton />;
  }
  return <ManagedProjectForm project={project} />;
}
