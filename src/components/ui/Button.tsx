import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonBaseProps = {
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
  withArrow?: boolean;
};

type ButtonAsLink = ButtonBaseProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className"> & {
    href: string;
  };

type ButtonAsAnchor = ButtonBaseProps &
  Omit<ComponentPropsWithoutRef<"a">, "href" | "className"> & {
    href: string;
    external?: boolean;
  };

type ButtonAsButton = ButtonBaseProps &
  Omit<ComponentPropsWithoutRef<"button">, "className"> & {
    href?: undefined;
  };

export type ButtonProps = ButtonAsLink | ButtonAsAnchor | ButtonAsButton;

const base = "group/btn btn";

const variants = {
  primary: "btn-primary",
  ghost: "btn-secondary",
} as const;

const sizes = {
  md: "h-11 px-6 text-sm",
  lg: "h-12 px-7 text-[15px]",
} as const;

const CUSTOM_PROPS = ["variant", "size", "className", "withArrow", "external"] as const;

/** Removes OMID Studio's own props, leaving only native element props. */
function nativeProps<T extends Record<string, unknown>>(props: T) {
  const rest = { ...props };
  for (const key of CUSTOM_PROPS) delete rest[key];
  return rest as Omit<T, (typeof CUSTOM_PROPS)[number]>;
}

/* Forward arrow — points left in the RTL layout, glides further on hover. */
const arrow = (
  <svg
    aria-hidden="true"
    className="size-4 transition-transform duration-300 group-hover/btn:-translate-x-0.5"
    viewBox="0 0 16 16"
    fill="none"
  >
    <path
      d="M13 8H3m0 0 3.5-3.5M3 8l3.5 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Button(props: ButtonProps) {
  const { children, withArrow } = props;
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";
  const classes = cn(base, variants[variant], sizes[size], props.className);
  const inner = (
    <>
      {children}
      {withArrow && arrow}
    </>
  );

  if (props.href === undefined) {
    return (
      <button {...nativeProps(props as ButtonAsButton)} className={classes}>
        {inner}
      </button>
    );
  }

  const isExternal = /^(https?:|mailto:)/.test(props.href);
  if (isExternal) {
    return (
      <a
        {...nativeProps(props as ButtonAsAnchor)}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link {...nativeProps(props as ButtonAsLink)} className={classes}>
      {inner}
    </Link>
  );
}