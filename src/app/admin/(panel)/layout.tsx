import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

/**
 * Server-side gate for the whole admin panel — in addition to the proxy, so
 * no render path can reach panel UI without a valid session cookie. The PWA
 * update box rides along here too, so the in-app update flow works across
 * the entire web app (the same single application).
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminAuthed())) redirect("/admin/login");
  return (
    <>
      <AdminShell>{children}</AdminShell>
      <ServiceWorkerRegistration />
    </>
  );
}