import type { Priority, ProjectStatus } from "@/lib/project-schema";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/project-schema";
import { PRIORITY_STYLE, STATUS_STYLE } from "@/lib/project-status";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

/** Small status pill — the shared visual for the whole admin area. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "cancelled" && "bg-faint",
        )}
      />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

/** Priority pill — only rendered when a priority is actually set. */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        PRIORITY_STYLE[priority],
        className,
      )}
    >
      اولویت {PRIORITY_LABELS[priority]}
    </span>
  );
}