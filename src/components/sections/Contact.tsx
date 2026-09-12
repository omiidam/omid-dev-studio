import { site } from "@/data/site";
import { ContactForm } from "@/components/contact/ContactForm";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";

export function Contact() {
  return (
    <section id="contact" className="relative py-28 md:py-40" aria-label="تماس">
      {/* closing glow — the page ends where the next project begins */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-1/2 h-[24rem] w-[70rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-r from-violet/12 via-blue/10 to-cyan/12 blur-[110px]"
      />

      <div className="container-site relative">
        <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div>
            <Reveal>
              <p className="kicker">۰۷ — شروع پروژه</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 text-balance text-4xl font-medium leading-[1.15] tracking-tight text-paper sm:text-5xl lg:text-6xl">
                ایده‌ای برای یک پروژه <GradientText>دارید؟</GradientText>
              </h2>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted md:text-lg">
                جزئیات پروژه‌تان را با OMID Studio در میان بگذارید. هرچه زمینه‌ی
                بیشتری بدهید بهتر — اهداف، مخاطب، زمان‌بندی و نمونه‌های مرجع.
              </p>
            </Reveal>

            <Reveal delay={0.22}>
              <div className="mt-10 flex flex-col gap-5">
                <a
                  href={`mailto:${site.email}`}
                  data-track="email_link_click"
                  data-track-prop-source="contact-section"
                  className="group inline-flex w-fit items-center gap-3 font-mono text-sm tracking-wide text-soft transition-colors hover:text-paper"
                >
                  <span className="size-1.5 rounded-full bg-gradient-to-r from-violet to-cyan" />
                  {site.email}
                  <span className="inline-block transition-transform duration-300 group-hover:-translate-x-0.5">
                    ←
                  </span>
                </a>
                <p className="text-[13px] text-faint">
                  معمولاً ظرف ۲ روز کاری پاسخ می‌دهیم
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}