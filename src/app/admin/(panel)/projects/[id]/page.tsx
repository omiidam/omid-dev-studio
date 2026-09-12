import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInquiry } from "@/lib/project-store";
import { StatusBadge, PriorityBadge } from "@/components/admin/badges";
import { ProjectDetailPanel } from "@/components/admin/ProjectDetailPanel";

export const dynamic = "force-dynamic";

interface InquiryDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: InquiryDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const inquiry = await getInquiry(id);
  return { title: inquiry ? `درخواست — ${inquiry.name}` : "درخواست پروژه" };
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  website: "وب‌سایت",
  webapp: "وب‌اپلیکیشن",
  saas: "محصول SaaS",
  ecommerce: "فروشگاه اینترنتی",
  dashboard: "داشبورد / پنل مدیریت",
  other: "چیز دیگر",
};

const BUDGET_LABELS: Record<string, string> = {
  under_2000: "زیر ۲٬۰۰۰ دلار",
  "2000_5000": "۲٬۰۰۰ تا ۵٬۰۰۰ دلار",
  "5000_15000": "۵٬۰۰۰ تا ۱۵٬۰۰۰ دلار",
  over_15000: "بیش از ۱۵٬۰۰۰ دلار",
  unsure: "هنوز مطمئن نیستم",
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function InquiryDetailPage({
  params,
}: InquiryDetailPageProps) {
  const { id } = await params;
  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper"
      >
        <svg
          aria-hidden="true"
          className="size-4 -scale-x-100"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M13 8H3m0 0 3.5-3.5M3 8l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        بازگشت به درخواست‌ها
      </Link>

      {/* header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-ink-2/80 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="kicker">درخواست پروژه</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
            {inquiry.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={inquiry.status} />
            {inquiry.priority && <PriorityBadge priority={inquiry.priority} />}
          </div>
        </div>
        <dl className="flex flex-col gap-1 text-[12px]">
          <dt className="sr-only">تاریخ ارسال</dt>
          <dd className="text-faint">ارسال: {formatDate(inquiry.createdAt)}</dd>
          <dt className="sr-only">آخرین تغییر</dt>
          <dd className="text-faint">
            آخرین تغییر: {formatDate(inquiry.updatedAt)}
          </dd>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* client + requirements */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-ink-2/80">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold text-paper">
                اطلاعات مشتری
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <Field label="نام" value={inquiry.name} />
              <Field label="ایمیل" value={inquiry.email} dir="ltr" />
              <Field label="شرکت" value={inquiry.company ?? "—"} />
              <Field label="شماره تماس" value={inquiry.phone ?? "—"} dir="ltr" />
              <div className="sm:col-span-2">
                <dt className="kicker">مرجع پروژه</dt>
                <dd className="mt-1 break-all text-[13px] text-soft" dir="ltr">
                  {inquiry.referenceUrl ? (
                    <a
                      href={inquiry.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan transition-colors duration-200 hover:text-paper"
                    >
                      {inquiry.referenceUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-ink-2/80">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold text-paper">
                نیازمندی‌های پروژه
              </h2>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <Field
                label="نوع پروژه"
                value={PROJECT_TYPE_LABELS[inquiry.projectType] ?? inquiry.projectType}
              />
              <Field
                label="بودجه"
                value={BUDGET_LABELS[inquiry.budget] ?? inquiry.budget}
              />
              <div className="sm:col-span-2">
                <dt className="kicker">توضیحات پروژه</dt>
                <dd className="mt-2 whitespace-pre-wrap text-[13px] leading-7 text-soft">
                  {inquiry.description}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* admin editor */}
        <ProjectDetailPanel inquiry={inquiry} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr";
}) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd
        className="mt-1 break-words text-[13px] text-soft"
        dir={dir}
        style={dir ? { textAlign: "left" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}