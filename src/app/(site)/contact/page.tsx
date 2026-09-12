import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "تماس",
  description:
    "شروع یک پروژه با OMID Studio — بگویید چه می‌سازید و ظرف دو روز کاری پاسخ بگیرید.",
  alternates: { canonical: `${site.url}/contact` },
};

export default function ContactPage() {
  return (
    <div className="relative overflow-x-clip pt-32 md:pt-44">
      <div
        aria-hidden="true"
        className="absolute -top-24 right-[-10%] h-[24rem] w-[24rem] rounded-full bg-violet/10 blur-[120px]"
      />
      <div className="container-site relative">
        <Reveal>
          <p className="kicker">تماس</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-paper md:text-7xl">
            ایده‌ای برای یک پروژه <GradientText>دارید؟</GradientText>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            جزئیات پروژه‌تان را با OMID Studio در میان بگذارید. هرچه زمینه‌ی
            بیشتری بدهید بهتر — اهداف، مخاطب، زمان‌بندی و نمونه‌های مرجع.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-12 md:mt-20 md:grid-cols-[0.3fr_0.7fr] md:gap-20">
          <Reveal delay={0.2}>
            <div className="flex flex-col gap-5">
              <a
                href={`mailto:${site.email}`}
                className="font-mono text-sm tracking-wide text-soft transition-colors hover:text-paper"
              >
                {site.email}
              </a>
              <p className="text-[13px] text-faint">
                معمولاً ظرف ۲ روز کاری پاسخ می‌دهیم
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.26}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </div>
  );
}