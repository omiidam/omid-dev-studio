import { z } from "zod";
import {
  MANAGED_PROJECT_STATUSES,
  PAYMENT_STATUSES,
  type ManagedProjectType,
} from "@/lib/managed-projects";

/**
 * Server-side validation for the managed-projects API (Phase 3).
 *
 * The canonical enums live in `managed-projects.ts` (shared with the UI, so
 * labels and codes can never drift). This module never trusts the client:
 * every field is re-validated on the server before it reaches the store.
 * Persian appears only in error messages; stored values are always
 * language-neutral codes.
 */

/** Project type codes — reuses the public inquiry taxonomy (single list). */
export const MANAGED_PROJECT_TYPES = [
  "website",
  "webapp",
  "saas",
  "ecommerce",
  "dashboard",
  "other",
] as const;

/** Optional-URL field: a real URL or an empty string (meaning "unset"). */
const optionalUrl = z
  .string()
  .trim()
  .max(2048, "آدرس نمی‌تواند بیشتر از ۲۰۴۸ کاراکتر باشد.")
  .refine(
    (value) => value === "" || z.string().url().safeParse(value).success,
    "آدرس واردشده معتبر نیست.",
  );

/** ISO calendar date (YYYY-MM-DD) or an empty string (meaning "unset"). */
const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))),
    "تاریخ واردشده معتبر نیست.",
  );

const managedProjectBase = z.object({
    name: z
      .string()
      .trim()
      .min(1, "نام پروژه الزامی است.")
      .max(120, "نام پروژه نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد."),
    client: z
      .string()
      .trim()
      .min(1, "نام مشتری الزامی است.")
      .max(120, "نام مشتری نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد."),
    type: z.enum(MANAGED_PROJECT_TYPES, {
      error: "نوع پروژه معتبر نیست.",
    }),
    description: z
      .string()
      .trim()
      .max(2000, "توضیحات نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد.")
      .default(""),
    status: z.enum(MANAGED_PROJECT_STATUSES, {
      error: "وضعیت پروژه معتبر نیست.",
    }),
    progress: z
      .number({ error: "درصد پیشرفت باید عدد باشد." })
      .int("درصد پیشرفت باید عدد صحیح باشد.")
      .min(0, "درصد پیشرفت نمی‌تواند منفی باشد.")
      .max(100, "درصد پیشرفت نمی‌تواند بیشتر از ۱۰۰ باشد."),
    startDate: optionalDate,
    deadline: optionalDate,
    budget: z
      .number({ error: "مبلغ پروژه باید عدد باشد." })
      .min(0, "مبلغ پروژه نمی‌تواند منفی باشد.")
      .max(1_000_000_000, "مبلغ پروژه خارج از محدوده‌ی مجاز است.")
      .default(0),
    payment: z.enum(PAYMENT_STATUSES, {
      error: "وضعیت پرداخت معتبر نیست.",
    }),
    demoUrl: optionalUrl,
    githubUrl: optionalUrl,
    technologies: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(40, "هر تکنولوژی نمی‌تواند بیشتر از ۴۰ کاراکتر باشد."),
      )
      .max(20, "حداکثر ۲۰ تکنولوژی مجاز است.")
      .default([]),
    notes: z
      .string()
      .trim()
      .max(5000, "یادداشت نمی‌تواند بیشتر از ۵۰۰۰ کاراکتر باشد.")
      .default(""),
});

export const managedProjectSchema = managedProjectBase.refine(
  (data) =>
    !data.startDate ||
    !data.deadline ||
    Date.parse(data.deadline) >= Date.parse(data.startDate),
  { message: "مهلت تحویل نمی‌تواند پیش از تاریخ شروع باشد.", path: ["deadline"] },
);

export type ManagedProjectPayload = z.infer<typeof managedProjectSchema>;

/** Full replace on create; PATCH accepts a partial of the same shape.
 * Note: the partial comes from the base object — zod's `.partial()` cannot
 * run on a schema with refinements. The deadline≥startDate rule is re-applied
 * server-side on update by validating the merged record below. */
export const managedProjectUpdateSchema = managedProjectBase.partial();

/** Validate a project identifier — opaque, bounded, no path characters. */
export function isValidProjectId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && !/[/\\\0]/.test(id);
}

/**
 * Cross-field check for PATCH: when both dates are present after merging the
 * update onto the current record, deadline must not precede startDate.
 */
export function datesAreConsistent(record: {
  startDate?: string;
  deadline?: string;
}): boolean {
  return (
    !record.startDate ||
    !record.deadline ||
    Date.parse(record.deadline) >= Date.parse(record.startDate)
  );
}

export type ManagedProjectTypeCode = ManagedProjectType;
