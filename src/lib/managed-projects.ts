/**
 * Canonical data contract for the Project Management Panel.
 *
 * Mirrors the conventions of `project-schema.ts`: Persian appears ONLY as UI
 * labels; values are always language-neutral English codes, so the backend
 * adopts this shape directly without renaming anything in the UI.
 *
 * Persistence: the real SQLite store (`managed-project-db.ts`) via the
 * authenticated API — the Phase-1 mock seed was removed in Phase 5.
 */

/* ---------------------------------------------------------------------------
 * Status — the managed-project lifecycle.
 * ------------------------------------------------------------------------ */

export const MANAGED_PROJECT_STATUSES = [
  "negotiating",
  "pending",
  "in_progress",
  "completed",
  "halted",
] as const;

export type ManagedProjectStatus = (typeof MANAGED_PROJECT_STATUSES)[number];

/** Persian labels — UI presentation only. */
export const MANAGED_STATUS_LABELS: Record<ManagedProjectStatus, string> = {
  negotiating: "در حال مذاکره",
  pending: "در انتظار شروع",
  in_progress: "در حال انجام",
  completed: "تکمیل شده",
  halted: "متوقف شده",
};

/** Pill styles — same token family as `project-status.ts`, dark-mode safe. */
export const MANAGED_STATUS_STYLE: Record<ManagedProjectStatus, string> = {
  negotiating: "bg-violet/10 text-violet ring-violet/25",
  pending: "bg-blue/10 text-blue ring-blue/25",
  in_progress: "bg-cyan/10 text-cyan ring-cyan/25",
  completed: "bg-success/10 text-success ring-success/25",
  halted: "bg-ink-3 text-muted ring-line-strong/40",
};

/* ---------------------------------------------------------------------------
 * Payment status
 * ------------------------------------------------------------------------ */

export const PAYMENT_STATUSES = ["unpaid", "advance", "partial", "paid"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "پرداخت نشده",
  advance: "پیش‌پرداخت",
  partial: "تسویه بخشی",
  paid: "تسویه‌شده",
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  unpaid: "bg-danger/10 text-danger ring-danger/25",
  advance: "bg-blue/10 text-blue ring-blue/25",
  partial: "bg-violet/10 text-violet ring-violet/25",
  paid: "bg-success/10 text-success ring-success/25",
};

/* ---------------------------------------------------------------------------
 * Project type — reuses the public inquiry taxonomy so both surfaces stay
 * aligned without a second list drifting apart.
 * ------------------------------------------------------------------------ */

export type ManagedProjectType =
  | "website"
  | "webapp"
  | "saas"
  | "ecommerce"
  | "dashboard"
  | "other";

export const MANAGED_TYPE_LABELS: Record<ManagedProjectType, string> = {
  website: "وب‌سایت",
  webapp: "وب‌اپلیکیشن",
  saas: "محصول SaaS",
  ecommerce: "فروشگاه اینترنتی",
  dashboard: "داشبورد / پنل مدیریت",
  other: "چیز دیگر",
};

/* ---------------------------------------------------------------------------
 * Milestones (Phase 6) — each belongs to exactly one project.
 * ------------------------------------------------------------------------ */

export const MILESTONE_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "paused",
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "در انتظار",
  in_progress: "در حال انجام",
  completed: "تکمیل شده",
  paused: "متوقف شده",
};

/** Same token family as the project status pills — dark-mode safe. */
export const MILESTONE_STATUS_STYLE: Record<MilestoneStatus, string> = {
  pending: "bg-blue/10 text-blue ring-blue/25",
  in_progress: "bg-cyan/10 text-cyan ring-cyan/25",
  completed: "bg-success/10 text-success ring-success/25",
  paused: "bg-ink-3 text-muted ring-line-strong/40",
};

export const milestoneStatusOptions = MILESTONE_STATUSES.map((value) => ({
  value,
  label: MILESTONE_STATUS_LABELS[value],
}));

/** Everything the milestone create/edit form collects, exactly. */
export interface MilestoneInput {
  title: string;
  description: string;
  status: MilestoneStatus;
  progress: number;
  startDate: string;
  deadline: string;
  order: number;
}

/** Persisted milestone — server adds identity, timestamps and completion. */
export interface ManagedMilestoneRecord extends MilestoneInput {
  id: string;
  projectId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------------------
 * Record shape
 * ------------------------------------------------------------------------ */

export interface ManagedMilestone {
  id: string;
  title: string;
  dueDate?: string;
  done: boolean;
}

export interface ManagedTimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
}

export interface ManagedActivity {
  id: string;
  at: string;
  text: string;
}

export interface ManagedFileItem {
  id: string;
  name: string;
  size: string;
  kind: string;
  updatedAt: string;
}

/** Everything the create/edit form collects, exactly. */
export interface ManagedProjectInput {
  name: string;
  client: string;
  type: ManagedProjectType;
  description: string;
  status: ManagedProjectStatus;
  progress: number;
  startDate: string;
  deadline: string;
  budget: number;
  payment: PaymentStatus;
  demoUrl: string;
  githubUrl: string;
  technologies: string[];
  notes: string;
}

export interface ManagedProject extends ManagedProjectInput {
  id: string;
  /** Soft-deleted projects stay in the database with this flag (Phase 5). */
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  timeline: ManagedTimelineEvent[];
  milestones: ManagedMilestone[];
  activity: ManagedActivity[];
  files: ManagedFileItem[];
}

/** Options for select controls (code value → Persian label). */
export const managedStatusOptions = MANAGED_PROJECT_STATUSES.map((value) => ({
  value,
  label: MANAGED_STATUS_LABELS[value],
}));

export const managedPaymentOptions = PAYMENT_STATUSES.map((value) => ({
  value,
  label: PAYMENT_STATUS_LABELS[value],
}));

export const managedTypeOptions = (
  Object.keys(MANAGED_TYPE_LABELS) as ManagedProjectType[]
).map((value) => ({ value, label: MANAGED_TYPE_LABELS[value] }));
