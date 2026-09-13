/**
 * Release metadata for the update box.
 *
 * When a new release is detected, the update card renders this data so the
 * user sees exactly what changed in that release — never a generic "new
 * version available" message. Keep the change list accurate: it must only
 * describe what the release actually does.
 *
 * `APP_VERSION` (src/config/version.ts) remains the canonical version; this
 * file's `version` field always equals it. `previousVersion` is what the
 * update box shows as "نسخه فعلی" for a user upgrading from the previous
 * release.
 *
 * Change entries are high-level and category-based: related low-level work
 * is consolidated into one meaningful line (e.g. all visual polish becomes
 * "Visual Improvements"), while major user-facing features are called out
 * explicitly. Changelog accuracy is verified against the real diff before
 * each release — no fabricated entries.
 */
import { APP_VERSION } from "./version";

export type ReleaseCategory =
  | "new"
  | "improvement"
  | "fix"
  | "optimization"
  | "security";

export interface ReleaseChange {
  category: ReleaseCategory;
  text: string;
}

export interface ReleaseInfo {
  version: string;
  previousVersion: string;
  changes: ReleaseChange[];
}

/** Persian labels for change categories — displayed only when present. */
export const RELEASE_CATEGORY_LABELS: Record<ReleaseCategory, string> = {
  new: "ویژگی‌های جدید",
  improvement: "بهبودها",
  fix: "رفع مشکلات",
  optimization: "بهینه‌سازی",
  security: "امنیت",
};

export const RELEASE_INFO: ReleaseInfo = {
  version: APP_VERSION,
  previousVersion: "1.0.24",
  changes: [
    {
      category: "improvement",
      text: "تنظیم دقیق‌تر نور محیطی و محو شدن لبه‌های امضای برند OMID",
    },
  ],
};