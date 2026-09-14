/** Shared loading / error shells for managed-project detail-level pages. */

export function ManagedDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="h-4 w-28 animate-pulse rounded bg-ink-3" />
      <div className="h-40 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-ink-2/60" />
      </div>
    </div>
  );
}

export function ManagedDetailStateless({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-[13px] text-danger"
    >
      {message}
    </div>
  );
}
