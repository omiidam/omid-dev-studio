export const metadata = { title: "تنظیمات" };

/**
 * Phase 1 placeholder — real settings (auth, integrations, defaults) belong
 * to later phases. This page states that honestly instead of faking controls.
 */
export default function ManageSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="kicker">مدیریت</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          تنظیمات
        </h1>
      </div>

      <div className="rounded-2xl border border-line bg-ink-2/80 px-5 py-10 text-center">
        <p className="text-[14px] text-muted">
          تنظیمات پنل در فازهای بعدی فعال می‌شود.
        </p>
        <p className="mt-2 text-[12px] text-faint">
          احراز هویت، دسترسی‌ها و یکپارچه‌سازی‌ها در همین بخش قرار می‌گیرند.
        </p>
      </div>
    </div>
  );
}
