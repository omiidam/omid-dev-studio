"use client";

import {
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/**
 * Subtle magnetic pull toward the cursor. Desktop, pointer-only,
 * and disabled under prefers-reduced-motion.
 */
export function MagneticButton({
  children,
  className,
  strength = 0.25,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 200, damping: 20, mass: 0.6 });

  // Always render motion.div for hydration safety. Under reduced motion,
  // skip pointer handlers so the springs never move.
  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x: sx, y: sy }}
      onMouseMove={
        reduce
          ? undefined
          : (event) => {
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return;
              const relX = event.clientX - (rect.left + rect.width / 2);
              const relY = event.clientY - (rect.top + rect.height / 2);
              x.set(relX * strength);
              y.set(relY * strength);
            }
      }
      onMouseLeave={
        reduce
          ? undefined
          : () => {
              x.set(0);
              y.set(0);
            }
      }
    >
      {children}
    </motion.div>
  );
}