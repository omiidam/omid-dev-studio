import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

/** Only same-site admin paths may be restored as a post-login destination. */
function safeNextPath(raw: string | undefined): string {
  if (raw && raw.startsWith("/admin") && !raw.startsWith("/admin/login")) {
    return raw;
  }
  return "/admin";
}

/**
 * Admin login — server shell. Resolves the ?next= destination preserved by
 * the proxy (validated here: only same-site admin paths survive) and hands
 * it to the client form as a plain prop. The login layout already redirects
 * authenticated admins to /admin, so this page is only seen logged-out.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AdminLoginForm nextPath={safeNextPath(next)} />;
}
