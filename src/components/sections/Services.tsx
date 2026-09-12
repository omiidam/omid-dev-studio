"use client";

import { useRef, type MouseEvent } from "react";
import { services } from "@/data/services";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";

export function Services() {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>, index: number) => {
    const row = rowRefs.current[index];
    if (!row) return;
    const rect = row.getBoundingClientRect();
    row.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    row.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };

  return (
    <section id="services" className="relative py-28 md:py-40" aria-label="خدمات">
      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading
              label="۰۲ — توانمندی‌ها"
              title={
                <>
                  آنچه استودیو <GradientText>می‌سازد.</GradientText>
                </>
              }
              aside={
                <p className="max-w-sm text-base leading-relaxed text-muted">
                  مجموعه‌ای متمرکز از خدمات — هرکدام کامل و سرتاسری، با طراحی و
                  مهندسی در یک تیم.
                </p>
              }
            />
          </div>

          <div className="flex flex-col">
            {services.map((service, index) => (
              <Reveal key={service.index} delay={0.06 * index}>
                <div
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  onMouseMove={(event) => handleMouseMove(event, index)}
                  className="group relative border-b border-line px-2 py-10 transition-colors duration-500 first:border-t md:px-5 md:py-12"
                >
                  {/* cursor spotlight */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgb(124 140 255 / 0.09), transparent 65%)",
                    }}
                  />

                  <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:gap-10">
                    <span className="text-xs font-medium text-faint transition-colors duration-300 group-hover:text-cyan">
                      {service.index}
                    </span>

                    <div className="flex-1">
                      <h3 className="text-balance text-2xl font-medium tracking-tight text-soft transition-all duration-300 group-hover:-translate-x-1 group-hover:text-paper md:text-3xl">
                        {service.title}
                      </h3>
                      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted md:text-[15px]">
                        {service.description}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {service.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-faint transition-colors duration-300 group-hover:border-line-strong group-hover:text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <span
                      aria-hidden="true"
                      className="hidden shrink-0 items-center justify-center self-center rounded-full border border-line p-3 text-paper opacity-40 transition-all duration-300 group-hover:border-transparent group-hover:bg-gradient-to-tr group-hover:from-violet group-hover:to-cyan group-hover:text-ink group-hover:opacity-100 md:flex"
                    >
                      <svg className="size-4 -scale-x-100" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8h10m0 0-3.5-3.5M13 8l-3.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}

            <Reveal delay={0.3}>
              <div className="flex items-center gap-3 pt-8">
                <span className="size-1.5 rounded-full bg-gradient-to-r from-violet to-cyan" />
                <p className="text-sm text-muted">
                  به چیزی بین این خطوط نیاز دارید؟{" "}
                  <a
                    href="#contact"
                    data-track="service_cta_click"
                    className="text-paper underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-cyan"
                  >
                    بگویید چه می‌سازید
                  </a>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}