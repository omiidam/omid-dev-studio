import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/types";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  index: number;
  featured?: boolean;
  priority?: boolean;
}

/** Art-directed placeholder visual used until a real screenshot exists. */
function PlaceholderVisual({
  project,
  index,
}: {
  project: Project;
  index: number;
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(150deg, ${project.palette.from} 0%, ${project.palette.to} 100%)`,
      }}
    >
      {/* glow */}
      <div
        aria-hidden="true"
        className="absolute -top-1/4 right-[10%] h-[70%] w-[60%] rounded-full blur-3xl"
        style={{ background: project.palette.glow, opacity: 0.35 }}
      />
      {/* fine grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* oversized index */}
      <span
        aria-hidden="true"
        className="absolute -bottom-[0.18em] right-3 select-none text-[7rem] font-bold leading-none tracking-tighter text-white/[0.05] md:text-[9rem]"
      >
        {String(index)
          .padStart(2, "0")
          .replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])}
      </span>
      {/* corner marks */}
      <span className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
        {project.category}
      </span>
      <span className="absolute right-5 top-5 font-mono text-[10px] tracking-[0.2em] text-white/30">
        {project.year}
      </span>
    </div>
  );
}

export function ProjectCard({ project, index, featured, priority }: ProjectCardProps) {
  return (
    <Link
      href={`/work/${project.slug}`}
      data-track="portfolio_item_click"
      data-track-prop-slug={project.slug}
      className={cn(
        "group relative block",
        featured && "md:col-span-2",
      )}
      aria-label={`${project.title} — ${project.category}`}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all duration-500 group-hover:ring-white/25",
          featured ? "aspect-[16/9]" : "aspect-[16/10]",
        )}
      >
        {project.image ? (
          <Image
            src={project.image}
            alt={`${project.title} — ${project.category}`}
            fill
            sizes={featured ? "(min-width: 1024px) 74rem, 100vw" : "(min-width: 768px) 40rem, 100vw"}
            priority={priority}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.04]">
            <PlaceholderVisual project={project} index={index} />
          </div>
        )}

        {/* hover sheen */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-80"
        />
        {/* view chip */}
        <span className="absolute bottom-5 right-5 flex size-11 translate-y-2 items-center justify-center rounded-full bg-paper text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <svg
            aria-hidden="true"
            className="size-4 -scale-x-100"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M3 8h10m0 0-3.5-3.5M13 8l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">مشاهده‌ی پروژه</span>
        </span>
      </div>

      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <h3
            className={cn(
              "tracking-tight text-paper transition-colors duration-300",
              featured ? "text-2xl font-semibold md:text-3xl" : "text-xl font-medium",
            )}
          >
            {project.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {project.tagline}
          </p>
        </div>
        <span className="mt-1 shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          {project.category}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {project.technologies.slice(0, 4).map((tech) => (
          <span
            key={tech}
            className="font-mono text-[11px] tracking-wide text-faint transition-colors duration-300 group-hover:text-muted"
          >
            {tech}
          </span>
        ))}
      </div>
    </Link>
  );
}