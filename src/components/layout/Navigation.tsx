"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { site } from "@/data/site";
import { cn, toFaDigits } from "@/lib/utils";
import { EASE } from "@/lib/animations";

const SECTION_IDS = ["services", "work", "process", "contact"];

export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isHome, pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /** "#work" on the home page (Lenis glides smoothly), "/#work" elsewhere (router lands on it). */
  const toHref = (href: string) => {
    if (href.startsWith("/#")) return isHome ? href.slice(1) : href;
    return href.startsWith("#") && !isHome ? `/${href}` : href;
  };

  const navLinkProps = (item: (typeof site.nav)[number]) => {
    const anchor = item.href.slice(2); // "/#work" -> "work"
    return {
      href: toHref(item.href),
      isActive: isHome && active === anchor,
    };
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="container-site flex h-16 items-center justify-between md:h-20">
          <Link
            href="/"
            dir="ltr"
            className="group flex items-baseline gap-1.5 text-[17px] font-semibold tracking-tight text-paper"
            aria-label="OMID Studio — خانه"
          >
            <span className="transition-opacity group-hover:opacity-80">OMID</span>
            <span className="text-gradient font-medium">Studio</span>
          </Link>

          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label="ناوبری اصلی"
          >
            {site.nav.map((item) => {
              const { href, isActive } = navLinkProps(item);
              return (
<Link
                    key={item.label}
                    href={href}
                    data-track="nav_link_click"
                    data-track-prop-label={item.label}
                    data-track-prop-source="desktop"
                    className={cn(
                    "relative text-[13px] font-medium transition-colors duration-300 hover:text-paper",
                    isActive ? "text-paper" : "text-muted",
                  )}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -bottom-1.5 right-0 h-px w-full origin-right bg-gradient-to-r from-violet to-cyan transition-transform duration-300",
                      isActive ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={toHref("#contact")}
              data-track="contact_cta_click"
              data-track-prop-source="nav"
              className="group btn btn-secondary hidden h-10 px-5 text-[13px] md:inline-flex"
            >
              شروع پروژه
              <svg
                aria-hidden="true"
                className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5"
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
            </Link>

            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={open ? "بستن منو" : "باز کردن منو"}
              data-track="mobile_nav_open"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-paper transition-colors hover:border-line-strong md:hidden"
            >
              <span className="relative block h-3 w-4">
                <span
                  className={cn(
                    "absolute right-0 top-0 h-px w-full bg-current transition-all duration-300",
                    open && "top-1.5 rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "absolute right-0 top-1.5 h-px w-full bg-current transition-all duration-300",
                    open && "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "absolute right-0 top-3 h-px w-full bg-current transition-all duration-300",
                    open && "top-1.5 -rotate-45",
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-0 z-40 flex flex-col justify-between bg-ink/95 px-6 pb-10 pt-28 backdrop-blur-xl md:hidden"
          >
            <nav className="flex flex-col gap-2" aria-label="ناوبری موبایل">
              {site.nav.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.06, duration: 0.5, ease: EASE }}
                >
                  <Link
                    href={toHref(item.href)}
                    onClick={() => setOpen(false)}
                    data-track="nav_link_click"
                    data-track-prop-label={item.label}
                    data-track-prop-source="mobile"
                    className="flex border-b border-line py-4 text-3xl font-medium tracking-tight text-paper"
                  >
                    <span className="me-3 font-mono text-xs text-faint">
                      {toFaDigits(String(index + 1).padStart(2, "0"))}
                    </span>
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5, ease: EASE }}
              className="flex flex-col gap-4"
            >
              <Link
                href={toHref("#contact")}
                onClick={() => setOpen(false)}
                data-track="contact_cta_click"
                data-track-prop-source="mobile"
                className="text-2xl font-medium text-paper"
              >
                شروع پروژه
                <span className="ms-2 inline-block text-gradient">←</span>
              </Link>
              <a
                href={`mailto:${site.email}`}
                data-track="email_link_click"
                data-track-prop-source="mobile-menu"
                className="font-mono text-sm text-muted"
              >
                {site.email}
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}