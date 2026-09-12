import { technologies } from "@/data/technologies";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";

export function Technology() {
  return (
    <section className="relative py-28 md:py-40" aria-label="تکنولوژی">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              label="۰۵ — تکنولوژی"
              title={
                <>
                  ساخته‌شده روی یک <GradientText>استک مدرن.</GradientText>
                </>
              }
              aside={
                <p className="max-w-sm text-base leading-relaxed text-muted">
                  ابزارها برای مسئله انتخاب می‌شوند — تایپ‌شده سرتاسری، سریع به
                  طور پیش‌فرض، و آسان برای تحویل.
                </p>
              }
            />
          </div>

          <div className="grid gap-x-12 gap-y-12 sm:grid-cols-3">
            {technologies.map((group, groupIndex) => (
              <Reveal key={group.label} delay={0.08 * groupIndex}>
                <div>
                  <p className="kicker">{group.label}</p>
                  <ul className="mt-5 flex flex-col gap-3.5">
                    {group.items.map((item) => (
                      <li key={item}>
                        <span className="group inline-flex cursor-default items-center gap-2 text-[15px] font-medium tracking-tight text-muted transition-colors duration-300 hover:text-paper">
                          <span className="size-1 rounded-full bg-line-strong transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-violet group-hover:to-cyan" />
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}