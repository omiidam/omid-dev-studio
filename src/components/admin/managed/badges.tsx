import type {
  ManagedProjectStatus,
  PaymentStatus,
} from "@/lib/managed-projects";
import {
  MANAGED_STATUS_LABELS,
  MANAGED_STATUS_STYLE,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLE,
} from "@/lib/managed-projects";
import { cn, toFaDigits } from "@/lib/utils";

/** Status pill for managed projects — mirrors the admin badges visual. */
export function ManagedStatusBadge({
  status,
  className,
}: {
  status: ManagedProjectStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        MANAGED_STATUS_STYLE[status],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {MANAGED_STATUS_LABELS[status]}
    </span>
  );
}

/** Payment pill — same construction, payment palette. */
export function ManagedPaymentBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        PAYMENT_STATUS_STYLE[status],
        className,
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Animated progress bar — width transitions on mount/changes for a subtle
 * fill animation; respects the global reduced-motion kill-switch in CSS.
 */
export function ManagedProgress({
  value,
  className,
  showLabel = false,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-3 ring-1 ring-inset ring-line"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet to-cyan transition-[width] duration-700 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 shrink-0 font-mono text-[11px] text-muted">
          {toFaDigits(clamped)}٪
        </span>
      )}
    </div>
  );
}
