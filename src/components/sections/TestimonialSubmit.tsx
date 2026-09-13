"use client";

import { useRef, useState, type FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Feedback submission area below the testimonials marquee. Visitors can send
 * their own comment; it is routed to the existing validated inquiry endpoint
 * (mapped onto the same schema as the footer form — the backend stays
 * untouched and the recipient email stays canonical in `site.email`).
 *
 * Visual design (functionality untouched — same fields, same validation,
 * same submission flow): the reference form's structure — a contained card
 * with labelled fields on filled surfaces, decorative blurred accent blobs
 * bleeding from behind the card, and a gradient submit button — rebuilt in
 * the OMID Studio violet→blue→cyan system. Labels follow the reference's
 * "label above field" hierarchy (Persian-safe: no tracking/uppercase).
 */
export function TestimonialSubmit() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const submittingRef = useRef(false);

  const handleFocus = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent("form_start");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (name.length < 2 || !email.includes("@") || message.length < 20) {
      setError("لطفاً نام، Email معتبر و نظری با چند جمله وارد کنید.");
      setStatus("error");
      trackEvent("form_submit_error", { reason: "validation" });
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          projectType: "website",
          budget: "unsure",
          description: `نظر بازدیدکننده:\n${message}`,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus("success");
      form.reset();
      trackEvent("form_submit_success");
    } catch {
      setError("ارسال نظر انجام نشد — اتصال را بررسی کنید و دوباره تلاش کنید.");
      setStatus("error");
      trackEvent("form_submit_error", { reason: "network" });
    } finally {
      submittingRef.current = false;
    }
  };

  const labelClasses = "block text-[13px] font-medium text-soft";
  const fieldClasses =
    "mt-1.5 w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-paper placeholder:text-faint shadow-[inset_2px_5px_10px_rgb(0_0_0/0.35)] transition-colors duration-300 focus:border-cyan/50 focus:outline-none";

  return (
    <Reveal>
      <div className="relative mt-20 overflow-hidden md:mt-28">
        {/* Reference-style ambient accents — two blurred pools of the site's
            own accent system bleeding from behind the card's corners. */}
        <div
          aria-hidden="true"
          className="absolute -start-10 top-6 size-24 rounded-full bg-violet/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -end-12 top-28 size-32 rounded-full bg-cyan/30 blur-2xl"
        />

        <div className="relative z-10 mx-auto max-w-2xl overflow-hidden rounded-[1.5rem] border border-line bg-ink-2/95 p-6 shadow-[0_24px_70px_-32px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-8 md:p-10">
          {status === "success" ? (
            <div
              className="flex min-h-48 flex-col items-start justify-center gap-4"
              role="status"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-tr from-violet to-cyan text-ink">
                <svg className="size-5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="m3 8.5 3.5 3.5L13 4.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="text-lg font-medium text-paper">نظر شما ثبت شد.</p>
              <p className="text-sm leading-relaxed text-muted">
                ممنون از بازخورد ارزشمند شما.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="text-[12px] font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-paper"
              >
                ثبت نظر دیگر
              </button>
            </div>
          ) : (
            <div>
              <p className="kicker">نظر شما</p>
              <h3 className="mt-4 text-balance text-2xl font-medium leading-snug tracking-tight text-paper sm:text-3xl">
                با نظرات ارزشمند خود، ما را در جهت پیشرفت و بهبود این مسیر
                یاری کنید.
              </h3>

              <form
                onSubmit={onSubmit}
                onFocus={handleFocus}
                noValidate
                className="mt-8"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="testimonial-name" className={labelClasses}>
                      نام و نام خانوادگی
                    </label>
                    <input
                      id="testimonial-name"
                      name="name"
                      required
                      type="text"
                      autoComplete="name"
                      placeholder="نام شما"
                      className={fieldClasses}
                    />
                  </div>
                  <div>
                    <label htmlFor="testimonial-email" className={labelClasses}>
                      Email
                    </label>
                    <input
                      id="testimonial-email"
                      name="email"
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      dir="ltr"
                      className={cn(fieldClasses, "text-left")}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="testimonial-message" className={labelClasses}>
                    نظر شما
                  </label>
                  <textarea
                    id="testimonial-message"
                    name="message"
                    required
                    rows={4}
                    placeholder="تجربه‌ی شما از این وب‌سایت…"
                    className={cn(fieldClasses, "resize-none")}
                  />
                </div>

                {status === "error" && error && (
                  <p
                    role="alert"
                    className="mt-3 text-[12px] leading-relaxed text-danger"
                  >
                    {error}
                  </p>
                )}

                {/* Reference treatment: gradient submit button. */}
                <div className="mt-6 flex justify-start">
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="rounded-lg bg-gradient-to-r from-violet via-blue to-cyan px-8 py-2.5 text-sm font-bold text-ink shadow-[0_14px_36px_-14px_rgb(124_140_255/0.55)] transition-all duration-300 hover:opacity-85 disabled:opacity-55"
                  >
                    {status === "submitting" ? "در حال ارسال…" : "ارسال نظر"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}