import type { Priority, ProjectStatus } from "@/lib/project-schema";

/**
 * Presentation styles for project status and lead priority — pure Tailwind
 * classes so both server and client components can render the same badges.
 * Colors stay inside the OMID Studio token family (violet/blue/cyan) with a
 * success green for completed and neutral treatment for cancelled.
 */

/** Pill classes toggling only the fill — callers supply the ring/text. */
export const STATUS_STYLE: Record<ProjectStatus, string> = {
  new: "bg-cyan/10 text-cyan ring-cyan/25",
  reviewing: "bg-violet/10 text-violet ring-violet/25",
  contacted: "bg-blue/10 text-blue ring-blue/25",
  proposal: "bg-gradient-to-r from-violet/15 to-cyan/15 text-cyan ring-blue/25",
  in_progress: "bg-blue/10 text-blue ring-blue/25",
  completed: "bg-success/10 text-success ring-success/25",
  cancelled: "bg-ink-3 text-muted ring-line-strong/40",
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-ink-3 text-muted ring-line-strong/40",
  normal: "bg-blue/10 text-blue ring-blue/25",
  high: "bg-danger/10 text-danger ring-danger/25",
};

/** Order used for filter menus — new through completed, cancelled last. */
export const STATUS_FILTER_ORDER = [
  "new",
  "reviewing",
  "contacted",
  "proposal",
  "in_progress",
  "completed",
  "cancelled",
] as const;