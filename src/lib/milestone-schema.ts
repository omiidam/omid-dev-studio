import { z } from "zod";
import { MILESTONE_STATUSES } from "@/lib/managed-projects";

/**
 * Server-side validation for the milestone API (Phase 6).
 *
 * Mirrors `managed-project-schema.ts`: the canonical status enum lives in
 * `managed-projects.ts` (shared with the UI so labels and codes never
 * drift), Persian appears only in error messages, and nothing from the
 * client is trusted — including the project id, which comes from the URL
 * and is re-checked against the database by the route handlers.
 */

/** Optional date: ISO calendar date or empty ("unset"). Defaults to empty
 * so payloads may omit the field entirely. */
const optionalDate = z
  .string()
  .trim()
  .default("")
  .refine(
    (value) =>
      value === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))),
    "تاریخ واردشده معتبر نیست.",
  );

export const milestoneBase = z.object({
  title: z
    .string()
    .trim()
    .min(1, "عنوان مرحله الزامی است.")
    .max(120, "عنوان مرحله نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد."),
  description: z
    .string()
    .trim()
    .max(1000, "توضیحات مرحله نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.")
    .default(""),
  status: z.enum(MILESTONE_STATUSES, {
    error: "وضعیت مرحله معتبر نیست.",
  }),
  progress: z
    .number({ error: "درصد پیشرفت باید عدد باشد." })
    .int("درصد پیشرفت باید عدد صحیح باشد.")
    .min(0, "درصد پیشرفت نمی‌تواند منفی باشد.")
    .max(100, "درصد پیشرفت نمی‌تواند بیشتر از ۱۰۰ باشد."),
  startDate: optionalDate,
  deadline: optionalDate,
  order: z
    .number({ error: "ترتیب مرحله باید عدد باشد." })
    .int("ترتیب مرحله باید عدد صحیح باشد.")
    .min(0, "ترتیب مرحله نمی‌تواند منفی باشد.")
    .max(9999, "ترتیب مرحله خارج از محدوده‌ی مجاز است.")
    .default(0),
});

export const milestoneSchema = milestoneBase.refine(
  (data) =>
    !data.startDate ||
    !data.deadline ||
    Date.parse(data.deadline) >= Date.parse(data.startDate),
  { message: "مهلت مرحله نمی‌تواند پیش از تاریخ شروع آن باشد.", path: ["deadline"] },
);

export type MilestonePayload = z.infer<typeof milestoneSchema>;

/** Partial of the same shape for PATCH; the base object avoids the
 * `.partial()`-on-refined-schema pitfall handled in Phase 3. */
export const milestoneUpdateSchema = milestoneBase.partial();

/** Cross-field date rule for PATCH, validated against the merged record. */
export function milestoneDatesAreConsistent(record: {
  startDate?: string;
  deadline?: string;
}): boolean {
  return (
    !record.startDate ||
    !record.deadline ||
    Date.parse(record.deadline) >= Date.parse(record.startDate)
  );
}

/** Milestone id — opaque, bounded, no path characters (same rule as projects). */
export function isValidMilestoneId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && !/[/\\\0]/.test(id);
}
