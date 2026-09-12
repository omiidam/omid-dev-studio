import Link from "next/link";
import { site } from "@/data/site";
import { Reveal } from "@/components/ui/Reveal";
import { FooterGetInTouch } from "@/components/layout/FooterGetInTouch";
import { FooterWordmark } from "@/components/layout/FooterWordmark";
import { FooterVersionBadge } from "@/components/layout/FooterVersionBadge";

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
                <p className="kicker">در دسترس</p>
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
                        className="text-sm text-muted transition-colors duration-300 hover:text-paper"
                      >
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
