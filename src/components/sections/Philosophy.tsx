import { cn } from "@/lib/utils";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";

const beliefs = [
  {
    index: "۰۱",
    label: "طراحی",
    text: "رابط‌هایی که عمدی به نظر می‌رسند و قابل پیش‌بینی رفتار می‌کنند. توجه، به همان جایی می‌رود که باید.",
  },
  {
    index: "۰۲",
    label: "مهندسی",
    text: "کدی تایپ‌شده، آزمایش‌شده و قابل نگهداری — از آن نوع که مهندس دیگری بدون راهنما بتواند ادامه دهد.",
  },
  {
    index: "۰۳",
    label: "کسب‌وکار",
    text: "هدف، محصولی است که برای کسب‌وکار کار کند. هر تصمیم بر اساس همین معیار سنجیده می‌شود.",
  },
];

export function Philosophy() {
  return (
    <section className="relative overflow-hidden py-28 md:py-40" aria-label="فلسفه‌ی استودیو">
      {/* atmospheric glow behind the statement */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[28rem] w-[60rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet/12 via-blue/10 to-cyan/12 blur-[110px]"
      />

      <div className="container-site relative">
        <Reveal>
          <p className="kicker text-center">فلسفه‌ی استودیو</p>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mx-auto mt-8 max-w-4xl text-balance text-center text-4xl font-medium leading-[1.15] tracking-tight text-paper sm:text-5xl md:text-6xl">
            &ldquo;طراحی خوب توجه می‌سازد؛{" "}
            <GradientText>مهندسی خوب آن را حفظ می‌کند.&rdquo;</GradientText>
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mx-auto mt-8 max-w-xl text-balance text-center text-base leading-relaxed text-muted md:text-lg">
            وب‌سایتی زیبا که زیر بار از پا درمی‌آید، یا محصولی محکم که هیچ‌کس
            دوست ندارد به آن نگاه کند — هر دو شکست‌خورده‌اند. استودیو جایی است
            که این دو به هم می‌رسند.
          </p>
        </Reveal>

        <div className="mx-auto mt-20 grid max-w-4xl gap-px md:grid-cols-3">
          {beliefs.map((belief, index) => (
            <Reveal key={belief.index} delay={0.1 + index * 0.08}>
              {/*
                Inline padding must stay on the card (so the border-t divider
                spans the full column), but `md:first:ps-0`/`md:last:pe-0` can
                never resolve here: each card is the only child of its Reveal
                wrapper, so every card matches both `:first-child` and
                `:last-child` and md:px-5 gets fully overridden. The result
                was numbers/text glued to the column dividers on desktop.
                Explicit index-based padding keeps the intended rhythm:
                first card flush on the start side, last card flush on the
                end side, middle card padded on both sides.
              */}
              <div
                className={cn(
                  "group h-full border-t border-line pt-7 transition-colors duration-500 hover:border-line-strong md:px-5",
                  index === 0 && "md:ps-0",
                  index === beliefs.length - 1 && "md:pe-0",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <span className="shrink-0 text-[11px] font-medium text-faint transition-colors duration-300 group-hover:text-cyan">
                    {belief.index}
                  </span>
                  <h3 className="text-lg font-medium tracking-tight text-paper">
                    {belief.label}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {belief.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}