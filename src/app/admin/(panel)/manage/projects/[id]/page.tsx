"use client";

import { use } from "react";
import { notFound, useParams } from "next/navigation";
import { getManagedProject } from "@/lib/managed-project-store";
import { ManagedProjectDetail } from "@/components/admin/managed/ManagedProjectDetail";

/** Phase 1 — managed project details (frontend-only data). */
export default function ManagedProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const project = getManagedProject(id);
  if (!project) notFound();
  return <ManagedProjectDetail project={project} />;
}
