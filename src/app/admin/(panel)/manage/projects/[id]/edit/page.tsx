"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { getManagedProject } from "@/lib/managed-project-store";
import { ManagedProjectForm } from "@/components/admin/managed/ManagedProjectForm";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

/** Phase 1 — edit project form (frontend-only submission). */
export default function EditManagedProjectPage({ params }: EditPageProps) {
  const { id } = use(params);
  const project = getManagedProject(id);
  if (!project) notFound();
  return <ManagedProjectForm project={project} />;
}
