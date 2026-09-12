"use client";

import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Max translate distance in px (negative moves up). */
  offset?: number;
}

/**
 * Subtle scroll parallax. Disabled entirely under prefers-reduced-motion.
 */
export function Parallax({ children, className, offset = 40 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  // Always render motion.div for hydration safety. Under reduced motion,
  // pass undefined style so the transform never applies.
  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={cn("will-change-transform", className)}>
      {children}
    </motion.div>
  );
}