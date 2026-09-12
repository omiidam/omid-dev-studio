import { processSteps } from "@/data/process";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";

export function Process() {
  return (
    <section id="process" className="relative py-28 md:py-40" aria-label="فرآیند">
      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              label="۰۴ — فرآیند"
              title={
                <>
                  کار چگونه <GradientText>انجام می‌شود.</GradientText>
                </>
              }
              aside={
                <p className="max-w-sm text-base leading-relaxed text-muted">
                  پنج گام، بدون پیچیدگی. همیشه می‌دانید پروژه کجاست و قدم بعدی
                  چیست.
                </p>
              }
            />
          </div>

          <ol className="flex flex-col">
            {processSteps.map((step, index) => (
              <Reveal key={step.index} delay={0.05 * index}>
                <li className="group relative border-b border-line py-10 first:border-t md:py-12">
                  <div className="flex flex-col gap-4 md:flex-row md:gap-10">
                    <span className="text-gradient text-5xl font-semibold tracking-tighter transition-transform duration-500 group-hover:-translate-x-1 md:text-6xl">
                      {step.index}
                    </span>
                    <div className="md:pt-2">
                      <h3 className="text-xl font-medium tracking-tight text-paper md:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted md:text-[15px]">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-violet to-cyan transition-all duration-700 group-hover:w-full"
                  />
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}