"use client";

import { useParams } from "next/navigation";
import { ManagedProjectDetail } from "@/components/admin/managed/ManagedProjectDetail";
import {
  ManagedDetailSkeleton,
  ManagedDetailStateless,
} from "@/components/admin/managed/ManagedDetailStates";
import { useManagedProject } from "@/lib/managed-project-store";

/** Phase 3 — managed project details, loaded from the real API. */
export default function ManagedProjectPage() {
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
  return <ManagedProjectDetail project={project} />;
}
