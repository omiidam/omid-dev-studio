import type { Metadata } from "next";
import { site } from "@/data/site";
import { projects } from "@/data/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "کارها",
  description:
    "گزیده‌ای از وب‌سایت‌ها، وب‌اپلیکیشن‌ها و محصولات دیجیتال که توسط OMID Studio طراحی و مهندسی شده‌اند.",
  alternates: { canonical: `${site.url}/work` },
};

export default function WorkPage() {
  return (
    <div className="relative overflow-x-clip pt-32 md:pt-44">
      <div
        aria-hidden="true"
        className="absolute -top-32 left-[-10%] h-[26rem] w-[26rem] rounded-full bg-violet/10 blur-[120px]"
      />
      <div className="container-site relative">
        <Reveal>
          <p className="kicker">پروژه‌های منتخب</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-6 max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-paper md:text-7xl">
            پروژه‌ها، <GradientText>مهندسی‌شده.</GradientText>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            وب‌سایت‌ها، اپلیکیشن‌ها و رابط‌هایی که سرتاسر ساخته شده‌اند — طراحی و
            مهندسی از یک استودیو.
          </p>
        </Reveal>

        <div className="mt-20 grid gap-x-8 gap-y-16 md:grid-cols-2">
          {projects.map((project, index) => (
            <Reveal
              key={project.slug}
              delay={0.06 * index}
              className={index === 0 ? "md:col-span-2" : undefined}
            >
              <ProjectCard
                project={project}
                index={index + 1}
                featured={index === 0}
                priority={index === 0}
              />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-24 flex flex-col items-start gap-5 border-t border-line py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-paper md:text-3xl">
                پروژه‌ی بعدی می‌تواند پروژه‌ی شما باشد.
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted md:text-base">
                به استودیو بگویید چه می‌سازید و ظرف دو روز کاری پاسخی دقیق
                دریافت کنید.
              </p>
            </div>
            <Button href="/#contact" withArrow>
              شروع پروژه
            </Button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}