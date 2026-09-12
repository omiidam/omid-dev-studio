import Link from "next/link";
import { GradientText } from "@/components/ui/GradientText";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[80svh] flex-col items-center justify-center px-6 pt-24 text-center">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[22rem] w-[40rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet/12 via-blue/10 to-cyan/12 blur-[110px]"
      />
      <p className="relative text-[12px] font-medium tracking-wide text-faint">
        خطای ۴۰۴
      </p>
      <h1 className="relative mt-6 text-5xl font-semibold leading-[1.1] tracking-tight text-paper md:text-7xl">
        <GradientText>گمشده در فرآیند ساخت.</GradientText>
      </h1>
      <p className="relative mt-6 max-w-md text-base leading-relaxed text-muted">
        صفحه‌ای که دنبالش هستید وجود ندارد — شاید منتقل شده، یا هرگز منتشر نشده
        است.
      </p>
      <Link href="/" className="btn btn-primary relative mt-10 h-12 px-8 text-[15px]">
        بازگشت به استودیو
        <span aria-hidden="true">←</span>
      </Link>
    </div>
  );
}