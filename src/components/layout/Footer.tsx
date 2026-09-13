import Link from "next/link";
import { site } from "@/data/site";
import { Reveal } from "@/components/ui/Reveal";
import { FooterGetInTouch } from "@/components/layout/FooterGetInTouch";
import { FooterWordmark } from "@/components/layout/FooterWordmark";
import { FooterVersionBadge } from "@/components/layout/FooterVersionBadge";

type SocialIconName = (typeof site.socials)[number]["icon"];

/** Minimal line icons for the footer social links — inherited `currentColor`,
    so the existing hover color transition covers both label and glyph. */
function SocialIcon({ icon }: { icon: SocialIconName }) {
  const className = "size-3.5 shrink-0 opacity-70 transition-opacity group-hover:opacity-100";
  switch (icon) {
    case "github":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      );
    case "telegram":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M14.38 1.37 1.13 6.48c-.9.36-.89 1.68.02 2.02l3.29 1.23 1.26 3.99c.28.88 1.4 1.09 1.98.38l1.42-1.75 2.98 2.19c.66.48 1.6.12 1.78-.68l2.02-9.9c.18-.84-.63-1.55-1.5-1.59ZM5.6 9.24l7.6-4.79c.19-.12.39.14.23.29L7.5 10.2c-.14.14-.23.32-.26.51l-.28 2.02c-.04.27-.42.3-.5.04L5.6 9.24Z" />
        </svg>
      );
    case "email":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
          <path d="m2 4.5 6 4.5 6-4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
      />
      <div className="container-site pb-10 pt-24 md:pt-32">
        {/* Row 1 — studio links + availability on the start side, the
            "Get in touch" card on the opposite side. */}
        <Reveal>
          <div className="flex flex-col gap-14 md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="flex flex-wrap gap-x-12 gap-y-8">
              <div>
                <p className="kicker">استودیو</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {site.nav.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        data-track="nav_link_click"
                        data-track-prop-label={item.label}
                        data-track-prop-source="footer"
                        className="text-sm text-muted transition-colors duration-300 hover:text-paper"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="kicker">ارتباط با ما</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {site.socials.map((social) => (
                    <li key={social.label}>
                      <a
                        href={social.href}
                        data-track={
                          social.href.startsWith("mailto")
                            ? "email_link_click"
                            : "external_link_click"
                        }
                        data-track-prop-source={
                          social.href.startsWith("mailto")
                            ? "footer"
                            : undefined
                        }
                        data-track-prop-label={
                          social.href.startsWith("mailto")
                            ? undefined
                            : social.label
                        }
                        target={social.href.startsWith("mailto") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 text-sm text-muted transition-colors duration-300 hover:text-paper"
                      >
                        <SocialIcon icon={social.icon} />
                        {social.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex w-full md:w-auto md:min-w-[30rem] md:flex-1 md:justify-end">
              <FooterGetInTouch />
            </div>
          </div>
        </Reveal>

        {/* Row 2 — the final brand statement, spanning below both columns. */}
        <Reveal delay={0.08}>
          <div className="mt-16 max-w-md md:mt-20">
            {/* Final brand statement — the closing conceptual frame of the
                page. `statement-text` is a dedicated semantic token reserved
                exclusively for this sentence. */}
            <p className="kicker">قاب آخر</p>
            <p className="statement-text mt-4 text-balance text-lg font-medium leading-relaxed md:text-xl">
              ایده‌های دقیق، محصولاتی ماندگار.
            </p>
          </div>

          {/* Row 3 — wordmark. The footer's links + form row now sits above
              the statement, so the wordmark remains the final anchor. */}
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-20 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-faint" suppressHydrationWarning>
              © {new Date().getFullYear()} OMID Studio — تمامی حقوق محفوظ است
            </p>
            <div className="flex items-center gap-6">
              {/* Effective (completed) version — NOT the deployed build constant.
                  A newer release being available must not change the version
                  the user sees before they complete the update. */}
              <FooterVersionBadge />
            </div>
          </div>
        </Reveal>
      </div>

      {/* Oversized wordmark — the closing brand signature. Sized in vw so it
          spans essentially the full viewport width at every breakpoint (never
          overflowing). The letters rise into place with a staggered
          scroll-triggered reveal; the violet→cyan sweep runs continuously
          across the whole word. */}
      <FooterWordmark />
    </footer>
  );
}
