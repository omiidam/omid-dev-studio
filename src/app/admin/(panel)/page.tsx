import { getInquiryStats } from "@/lib/project-store";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata = { title: "داشبورد مدیریت" };
export const dynamic = "force-dynamic";

/** Admin dashboard — every number comes from the real persisted store. */
export default async function AdminPage() {
  const stats = await getInquiryStats();
  return <AdminDashboard stats={stats} />;
}