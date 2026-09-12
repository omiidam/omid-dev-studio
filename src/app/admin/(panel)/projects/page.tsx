import type { Metadata } from "next";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/project-schema";
import { listInquiries } from "@/lib/project-store";
import { AdminProjectsTable } from "@/components/admin/AdminProjectsTable";

export const metadata: Metadata = { title: "درخواست‌های پروژه" };
export const dynamic = "force-dynamic";

interface ProjectsPageProps {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    q?: string;
  }>;
}

/** Validate + normalize raw search params to safe canonical values. */
function parseFilters(params: Awaited<ProjectsPageProps["searchParams"]>) {
  const statusParam = params.status ?? "";
  const status = (PROJECT_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as ProjectStatus)
    : null;
  const sort = params.sort === "oldest" ? "oldest" : "newest";
  return { status, sort, query: (params.q ?? "").trim() };
}

/** Server-side filtering and sorting over the real persisted store. */
export default async function AdminProjectsPage({ searchParams }: ProjectsPageProps) {
  const filters = parseFilters(await searchParams);
  const all = await listInquiries();

  const byStatus = filters.status
    ? all.filter((inquiry) => inquiry.status === filters.status)
    : all;

  const byQuery = filters.query
    ? byStatus.filter((inquiry) =>
        [inquiry.name, inquiry.email, inquiry.company, inquiry.description]
          .filter(Boolean)
          .some((field) =>
            field!.toLowerCase().includes(filters.query.toLowerCase()),
          ),
      )
    : byStatus;

  const inquiries = [...byQuery].sort((a, b) => {
    const delta =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return filters.sort === "oldest" ? -delta : delta;
  });

  const statusOptions = PROJECT_STATUSES.map((status) => ({
    value: status,
    label: PROJECT_STATUS_LABELS[status],
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker">پروژه‌ها</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          درخواست‌های پروژه
        </h1>
      </div>

      <AdminProjectsTable
        inquiries={inquiries}
        total={all.length}
        statusOptions={statusOptions}
      />
    </div>
  );
}