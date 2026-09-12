"use client";

import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRef } from "react";
import { EASE } from "@/lib/animations";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Button } from "@/components/ui/Button";
import { GradientText } from "@/components/ui/GradientText";

const heroTech = [
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "PostgreSQL",
  "Tailwind CSS",
];

const entrance = {
  hidden: { opacity: 0, y: 32 },
  visible: (custom: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE, delay: 0.05 + custom * 0.1 },
  }),
};

export function Hero() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
      aria-label="معرفی استودیو"
    >
      {/* ── Atmosphere: the provided image as a living background ── */}
      <div aria-hidden="true" className="absolute inset-0">
        {/* Blurred, darkened pass of the image — its tones become the canvas */}
        <div className="absolute inset-0 scale-110">
          {/* Decorative blurred pass — NOT the LCP image, so no priority: it
              is fetched lazily and must not be preloaded. */}
          <Image
            src="/images/omid-studio-hero.png"
            alt=""
            fill
            loading="lazy"
            sizes="100vw"
            className="object-cover opacity-[0.22] blur-2xl"
          />
        </div>
        {/* Palette unification — pull the photo's tones into the violet/blue system */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet/25 via-transparent to-cyan/20 mix-blend-color" />
        {/* Directional glows */}
        <div className="absolute -top-40 left-[-10%] h-[34rem] w-[34rem] rounded-full bg-violet/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-8%] h-[30rem] w-[30rem] rounded-full bg-blue/15 blur-[120px]" />
        {/* Grounding fade to the base ink */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-ink to-transparent" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/80 to-transparent" />
      </div>

      {/* ── Foreground content ── */}
      <motion.div
        style={reduce ? undefined : { y: textY }}
        className="container-site relative z-10 flex flex-1 flex-col justify-center pb-16 pt-32 md:pt-36"
      >
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Copy */}
          <div>
            <motion.h1
              custom={0}
              variants={entrance}
              initial={reduce ? false : "hidden"}
              animate="visible"
              className="text-balance text-[clamp(2.6rem,7vw,5.2rem)] font-semibold leading-[1.05] tracking-tight text-paper"
            >
              محصولات دیجیتال،
              <br />
              <GradientText>با مهندسی دقیق.</GradientText>
            </motion.h1>

            <motion.p
              custom={1}
              variants={entrance}
              initial={reduce ? false : "hidden"}
              animate="visible"
              className="mt-7 max-w-md text-balance text-base leading-relaxed text-soft md:text-lg"
            >
              OMID Studio وب‌سایت‌ها، وب‌اپلیکیشن‌ها و رابط‌های کاربری را طراحی و
              مهندسی می‌کند؛ برای تیم‌هایی که به چیزی فراتر از یک قالب آماده
              نیاز دارند.
            </motion.p>

            <motion.div
              custom={2}
              variants={entrance}
              initial={reduce ? false : "hidden"}
              animate="visible"
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <MagneticButton>
                <Button href="#contact" size="lg" withArrow data-track="hero_cta_click">
                  شروع پروژه
                </Button>
              </MagneticButton>
              <Button
                href="#work"
                variant="ghost"
                size="lg"
                data-track="hero_portfolio_click"
              >
                مشاهده پروژه‌ها
              </Button>
            </motion.div>

            <motion.p
              custom={3}
              variants={entrance}
              initial={reduce ? false : "hidden"}
              animate="visible"
              className="mt-10 flex items-center gap-2.5 text-[13px] text-soft"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan/60" />
                <span className="relative inline-flex size-2 rounded-full bg-cyan" />
              </span>
              آماده‌ی پذیرش پروژه‌های جدید
            </motion.p>
          </div>

          {/* Visual — the provided image, blended into the canvas */}
          <motion.div
            style={reduce ? undefined : { y: imageY }}
            initial={reduce ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.25 }}
            className="relative"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-violet/30 via-transparent to-cyan/25 blur-2xl"
            />
            <div className="hero-image-frame relative overflow-hidden rounded-[1.5rem]">
              {/* Luminous pass — dark areas of the photo vanish into the ink */}
              <div className="relative aspect-[4/3]">
                <Image
                  src="/images/omid-studio-hero.png"
                  alt="لپ‌تاپ با صفحه‌ای روشن در تاریکی — فضای کار OMID Studio"
                  fill
                  priority
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover mix-blend-lighten"
                  quality={88}
                />
                {/* Unify the photo's palette with the studio gradient */}
                <div className="absolute inset-0 bg-gradient-to-tr from-violet/40 via-transparent to-cyan/30 mix-blend-color" />
                {/* Soft vignette so the frame melts into the page */}
                <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_45%,transparent_55%,rgb(6_6_9/0.55)_100%)]" />
              </div>
            </div>

            {/* Internal design & engineering mark — below the image,
                inside the image column so it belongs to the same grid
                column at every breakpoint. Right-aligned to the image's
                right edge (the column's start side in RTL); never floats
                over or overlaps the image. */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
              className="mt-5 flex"
            >
              <div className="flex items-center gap-2.5 rounded-full border border-line bg-ink-2/90 px-4 py-2.5 backdrop-blur-md">
                <span className="text-xs font-medium text-muted">
                  طراحی و مهندسی
                </span>
                <span className="size-1 rounded-full bg-gradient-to-r from-violet to-cyan" />
                <span className="text-xs font-medium text-paper">داخلی</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Tech line ── */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:mt-24"
        >
          <span className="text-xs font-medium text-faint">تکنولوژی‌ها</span>
          {heroTech.map((tech, index) => (
            <span key={tech} className="flex items-center gap-6">
              <span className="text-sm font-medium text-muted transition-colors duration-300 hover:text-paper">
                {tech}
              </span>
              {index < heroTech.length - 1 && (
                <span className="size-1 rounded-full bg-line-strong" aria-hidden="true" />
              )}
            </span>
          ))}
        </motion.div>
      </motion.div>

    </section>
  );
}