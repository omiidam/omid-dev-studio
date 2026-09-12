import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/data/site";
import { getProject, projects } from "@/data/projects";
import { GradientText } from "@/components/ui/GradientText";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.tagline,
    alternates: { canonical: `${site.url}/work/${slug}` },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = projects.findIndex((p) => p.slug === project.slug);
  const nextProject = projects[(index + 1) % projects.length];

  return (
    <div className="relative overflow-x-clip pt-28 md:pt-40">
      {/* hero visual */}
      <div className="container-site">
        <Reveal>
          <p className="kicker">
            {project.category} — {project.year}
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-paper sm:text-6xl md:text-7xl">
            {project.title}
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-soft">
            {project.tagline}
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="relative mt-14 overflow-hidden rounded-2xl ring-1 ring-white/10 md:mt-16">
            {project.image ? (
              <Image
                src={project.image}
                alt={`${project.title} — ${project.category}`}
                width={1600}
                height={900}
                priority
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <div
                className="relative aspect-[16/9] w-full overflow-hidden"
                style={{
                  background: `linear-gradient(150deg, ${project.palette.from} 0%, ${project.palette.to} 100%)`,
                }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -top-1/4 right-[15%] h-[80%] w-[55%] rounded-full blur-3xl"
                  style={{ background: project.palette.glow, opacity: 0.4 }}
                />
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[0.12em] right-6 select-none text-[clamp(5rem,20vw,16rem)] font-bold leading-none tracking-tighter text-white/[0.05]"
                >
                  {project.title.charAt(0)}
                </span>
                <div className="absolute right-6 top-6 flex flex-wrap gap-2 md:right-8 md:top-8">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-white/15 bg-ink/30 px-3.5 py-1.5 font-mono text-[10px] tracking-wide text-white/70 backdrop-blur-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* body */}
      <div className="container-site mt-16 md:mt-24">
        <div className="grid gap-14 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          {/* meta */}
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="flex flex-col gap-8">
              <div>
                <p className="kicker">مرور کلی</p>
                <p className="mt-3 text-base leading-relaxed text-soft">
                  {project.description}
                </p>
              </div>
              <dl className="flex flex-col gap-5">
                <div>
                  <dt className="kicker">دسته‌بندی</dt>
                  <dd className="mt-1.5 text-[15px] text-paper">
                    {project.category}
                  </dd>
                </div>
                <div>
                  <dt className="kicker">سال</dt>
                  <dd className="mt-1.5 text-[15px] text-paper">
                    {project.year}
                  </dd>
                </div>
                <div>
                  <dt className="kicker">تکنولوژی‌ها</dt>
                  <dd className="mt-1.5">
                    <ul className="flex flex-col gap-1.5">
                      {project.technologies.map((tech) => (
                        <li key={tech} className="text-[15px] text-muted">
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              {project.external && (
                <a
                  href={project.external}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex w-fit items-center gap-2 text-[15px] font-medium text-paper"
                >
                  مشاهده‌ی پروژه‌ی زنده
                  <span className="inline-block transition-transform duration-300 group-hover:-translate-x-0.5">
                    ←
                  </span>
                </a>
              )}
            </div>
          </aside>

          {/* story */}
          <div className="flex flex-col gap-16">
            <Reveal>
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-paper">
                  چالش
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
                  {project.challenge}
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-paper">
                  رویکرد
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
                  {project.solution}
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-paper">
                  آنچه ساخته شد
                </h2>
                <ul className="mt-5 flex flex-col">
                  {project.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-baseline gap-4 border-b border-line py-4 text-[15px] text-soft first:border-t"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-gradient-to-r from-violet to-cyan"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal>
              <div>
                <h2 className="text-2xl font-medium tracking-tight text-paper">
                  نتایج
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {project.results.map((result) => (
                    <li key={result} className="flex items-baseline gap-3 text-[15px] text-muted">
                      <span className="text-[11px] text-cyan">←</span>
                      {result}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      {/* next project */}
      <div className="mt-24 md:mt-32">
        <Link
          href={`/work/${nextProject.slug}`}
          className="group block border-t border-line"
        >
          <div className="container-site py-16 md:py-20">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="kicker transition-colors duration-300 group-hover:text-cyan">
                  پروژه‌ی بعدی
                </p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-paper transition-transform duration-500 group-hover:-translate-x-2 md:text-6xl">
                  <GradientText>{nextProject.title}</GradientText>
                </p>
              </div>
              <span className="flex size-14 items-center justify-center rounded-full border border-line text-paper transition-all duration-500 group-hover:border-transparent group-hover:bg-gradient-to-tr group-hover:from-violet group-hover:to-cyan group-hover:text-ink md:size-16">
                <svg className="size-5 -scale-x-100 md:size-6" viewBox="0 0 16 16" fill="none">
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
        </Link>

        <div className="container-site pb-24">
          <Button href="/#contact" size="lg" withArrow>
            شروع پروژه‌ی شما
          </Button>
        </div>
      </div>
    </div>
  );
}