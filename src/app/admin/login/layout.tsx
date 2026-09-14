import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/auth";

export const metadata: Metadata = { title: "ورود مدیر" };

/**
 * Login entry — an authenticated administrator has no business on the login
 * page, so they are sent straight to the panel (refresh test). The ?next=
 * destination is resolved and validated by the page's server component.
 */
export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isAdminAuthed()) redirect("/admin");
  return <>{children}</>;
}
