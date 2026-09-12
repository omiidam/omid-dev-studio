import { z } from "zod";

/**
 * Canonical data contract for project inquiries — the single source of truth
 * shared by the UI (client-side validation + labels) and the API (server-side
 * validation + storage).
 *
 * Rule: Persian appears ONLY as UI labels. Values exchanged with the API and
 * stored are always language-neutral English codes, so a future admin panel,
 * email template or analytics tool never has to parse Persian.
 */

/* ---------------------------------------------------------------------------
 * projectType
 * ------------------------------------------------------------------------ */

export const PROJECT_TYPES = [
  "website",
  "webapp",
  "saas",
  "ecommerce",
  "dashboard",
  "other",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

/** Persian labels, index-aligned with PROJECT_TYPES. UI presentation only. */
const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "وب‌سایت",
  webapp: "وب‌اپلیکیشن",
  saas: "محصول SaaS",
  ecommerce: "فروشگاه اینترنتی",
  dashboard: "داشبورد / پنل مدیریت",
  other: "چیز دیگر",
};

/* ---------------------------------------------------------------------------
 * budget
 * ------------------------------------------------------------------------ */

export const BUDGETS = [
  "under_2000",
  "2000_5000",
  "5000_15000",
  "over_15000",
  "unsure",
] as const;

export type Budget = (typeof BUDGETS)[number];

/** Persian labels, index-aligned with BUDGETS. UI presentation only. */
const BUDGET_LABELS: Record<Budget, string> = {
  under_2000: "زیر ۲٬۰۰۰ دلار",
  "2000_5000": "۲٬۰۰۰ تا ۵٬۰۰۰ دلار",
  "5000_15000": "۵٬۰۰۰ تا ۱۵٬۰۰۰ دلار",
  over_15000: "بیش از ۱۵٬۰۰۰ دلار",
  unsure: "هنوز مطمئن نیستم",
};

/* ---------------------------------------------------------------------------
 * Select options for the UI (code as value, Persian as visible label)
 * ------------------------------------------------------------------------ */

export const projectTypeOptions = PROJECT_TYPES.map((value) => ({
  value,
  label: PROJECT_TYPE_LABELS[value],
}));

export const budgetOptions = BUDGETS.map((value) => ({
  value,
  label: BUDGET_LABELS[value],
}));

/* ---------------------------------------------------------------------------
 * Project status — the inquiry/project lifecycle.
 *
 * Canonical backend values are language-neutral English and stored as-is.
 * Persian appears ONLY in the presentation labels below, never in storage.
 * The list is intentionally extensible: adding a state here (and a label)
 * is the only change needed to grow the workflow.
 * ------------------------------------------------------------------------ */

export const PROJECT_STATUSES = [
  "new",
  "reviewing",
  "contacted",
  "proposal",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Persian labels — UI presentation only. */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  new: "جدید",
  reviewing: "در حال بررسی",
  contacted: "تماس گرفته شد",
  proposal: "ارسال پیشنهاد",
  in_progress: "در حال انجام",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [...PROJECT_STATUSES];

/* ---------------------------------------------------------------------------
 * Lead priority (lightweight CRM) — low / normal / high.
 * ------------------------------------------------------------------------ */

export const PRIORITY_LEVELS = ["low", "normal", "high"] as const;

export type Priority = (typeof PRIORITY_LEVELS)[number];

/** Persian labels — UI presentation only. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "کم",
  normal: "عادی",
  high: "بالا",
};

/* ---------------------------------------------------------------------------
 * Validation schema
 *
 * Shared by react-hook-form (UX layer) and the API route (security layer).
 * The server never trusts the client; it always re-validates.
 * ------------------------------------------------------------------------ */

export const MAX_BODY_BYTES = 32_000;

export const inquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "لطفاً نام خود را بنویسید.")
    .max(120, "نام نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("آدرس ایمیل معتبر نیست.")
    .max(254, "آدرس ایمیل نمی‌تواند بیشتر از ۲۵۴ کاراکتر باشد."),
  phone: z
    .string()
    .trim()
    .max(30, "شماره تماس نمی‌تواند بیشتر از ۳۰ کاراکتر باشد.")
    .optional()
    .or(z.literal("")),
  company: z
    .string()
    .trim()
    .max(200, "نام شرکت نمی‌تواند بیشتر از ۲۰۰ کاراکتر باشد.")
    .optional()
    .or(z.literal("")),
  projectType: z.enum(PROJECT_TYPES, {
    error: "یک نوع پروژه انتخاب کنید.",
  }),
  budget: z.enum(BUDGETS, { error: "یک محدوده‌ی بودجه انتخاب کنید." }),
  description: z
    .string()
    .trim()
    .min(20, "جزئیات بیشتری کمک می‌کند — حداقل ۲۰ کاراکتر.")
    .max(2000, "لطفاً متن را زیر ۲۰۰۰ کاراکتر نگه دارید."),
  referenceUrl: z
    .string()
    .trim()
    .url("آدرس واردشده معتبر نیست.")
    .max(2048, "آدرس نمی‌تواند بیشتر از ۲۰۴۸ کاراکتر باشد.")
    .optional()
    .or(z.literal("")),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

/* ---------------------------------------------------------------------------
 * Admin login payload — the smallest contract that lets the login route
 * validate input before it ever touches credential comparison.
 * ------------------------------------------------------------------------ */

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(256),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/* ---------------------------------------------------------------------------
 * Admin project update — the ONLY fields an administrator may change, each
 * strictly validated server-side. Status/priority are bounded by their
 * canonical enums; unknown values are rejected before they reach storage.
 * ------------------------------------------------------------------------ */

export const adminProjectUpdateSchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITY_LEVELS).nullable().optional(),
  adminNotes: z.string().trim().max(5000).nullable().optional(),
});

export type AdminProjectUpdate = z.infer<typeof adminProjectUpdateSchema>;
