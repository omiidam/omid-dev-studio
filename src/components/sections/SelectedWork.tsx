import { featuredProject, otherProjects } from "@/data/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

export function SelectedWork() {
  return (
    <section id="work" className="relative py-28 md:py-40" aria-label="پروژه‌های منتخب">
      {/* transition glow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent"
      />

      <div className="container-site">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            label="۰۳ — پروژه‌های منتخب"
            title={
              <>
                پروژه‌های <GradientText>اخیر.</GradientText>
              </>
            }
          />
          <Reveal delay={0.15}>
            <Button
              href="/work"
              variant="ghost"
              withArrow
              data-track="portfolio_view_click"
            >
              همه‌ی پروژه‌ها
            </Button>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-14 md:grid-cols-2">
          <Reveal className="md:col-span-2">
            <ProjectCard project={featuredProject} index={1} featured priority />
          </Reveal>
          {otherProjects.slice(0, 4).map((project, index) => (
            <Reveal key={project.slug} delay={0.08 * index}>
              <ProjectCard project={project} index={index + 2} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-20 flex flex-col items-center gap-4 text-center">
            <p className="text-[11px] font-medium text-faint">
              هر پروژه تا وقتی کار واقعی جایگزینش شود، نمونه است
            </p>
            <p className="max-w-md text-base text-muted">
              می‌خواهید ببینید یکی از این‌ها برای کسب‌وکار شما چگونه می‌شود؟
            </p>
            <Button
              href="#contact"
              withArrow
              data-track="contact_cta_click"
              data-track-prop-source="work-section"
            >
              شروع پروژه
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}