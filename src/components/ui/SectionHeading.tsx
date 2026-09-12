import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/Reveal";

interface SectionHeadingProps {
  label: string;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}

/** Shared editorial heading: mono label above a large statement. */
export function SectionHeading({ label, title, aside, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Reveal>
        <p className="kicker">{label}</p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="max-w-3xl text-balance text-4xl font-medium leading-[1.05] tracking-tight text-paper sm:text-5xl lg:text-6xl">
          {title}
        </h2>
      </Reveal>
      {aside ? <Reveal delay={0.16}>{aside}</Reveal> : null}
    </div>
  );
}