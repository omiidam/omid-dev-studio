"use client";

import { toFaDigits } from "@/lib/utils";
import { useDisplayedVersion } from "@/hooks/useDisplayedVersion";

/**
 * Footer version badge.
 *
 * Renders the user's EFFECTIVE version (their last completed version, as
 * recorded by the backend) — never the freshly deployed build constant. A
 * new release being available does not make the user "be" on that release:
 * until they complete the update, the footer must keep showing the version
 * they are actually running.
 */
export function FooterVersionBadge() {
  const displayed = useDisplayedVersion();

  return (
    <span className="font-mono text-[11px] text-faint" title={`App version ${displayed}`}>
      نسخه {toFaDigits(displayed)}
    </span>
  );
}
