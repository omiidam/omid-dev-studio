import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";

const principles = [
  {
    index: "الف",
    title: "طراحی و مهندسی، با هم",
    text: "همان دست‌هایی که رابط را طراحی می‌کنند، سیستمِ زیر آن را هم می‌سازند.",
  },
  {
    index: "ب",
    title: "سفارشی، نه قالبی",
    text: "هر محصول از مسئله شروع می‌شود، نه از قالبی که «تقریباً» مناسب است.",
  },
  {
    index: "ج",
    title: "عملکرد یک ویژگی است",
    text: "سریع، روان و قابل پیش‌بینی — روی سخت‌افزار معمولی، نه فقط در دموها.",
  },
];

export function Introduction() {
  return (
    <section className="relative py-28 md:py-40" aria-label="درباره‌ی استودیو">
      {/* soft transition glow into the section */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <div className="container-site">
        <Reveal>
          <p className="kicker">۰۱ — استودیو</p>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <Reveal delay={0.08}>
            <h2 className="text-balance text-3xl font-medium leading-[1.12] tracking-tight text-paper sm:text-4xl md:text-5xl">
              OMID Studio وب‌سایت‌ها، وب‌اپلیکیشن‌ها و محصولات دیجیتال را برای
              برندهایی طراحی و مهندسی می‌کند که به چیزی{" "}
              <GradientText>فراتر از یک قالب آماده</GradientText> نیاز دارند.
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="text-base leading-relaxed text-muted md:pt-3 md:text-lg">
              یک استودیوی مستقل و کوچک با تمام تخصص‌ها در خانه — استراتژی، طراحی
              رابط، فرانت‌اند و بک‌اند. یک تیم، از اولین طرح تا استقرار نهایی.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden md:grid-cols-3">
          {principles.map((principle, index) => (
            <Reveal key={principle.title} delay={0.1 + index * 0.08}>
              <div className="group h-full border-t border-line py-7 ps-8 transition-colors duration-500 hover:border-line-strong">
                <span className="text-[11px] font-medium text-faint transition-colors duration-300 group-hover:text-cyan">
                  {principle.index}
                </span>
                <h3 className="mt-4 text-lg font-medium tracking-tight text-paper">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {principle.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}