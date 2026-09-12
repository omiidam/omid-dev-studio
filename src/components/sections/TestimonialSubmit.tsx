"use client";

import { useRef, useState, type FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error";

const fieldClasses =
  "w-full bg-transparent px-1 py-2 text-sm text-paper placeholder:text-faint focus:outline-none";

/**
 * Feedback submission area below the testimonials marquee. Visitors can send
 * their own comment; it is routed to the existing validated inquiry endpoint
 * (mapped onto the same schema as the footer form — the backend stays
 * untouched and the recipient email stays canonical in `site.email`).
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

  return (
    <Reveal>
      <div className="relative mt-20 rounded-[1.5rem] border border-line bg-gradient-to-br from-violet/20 via-line/50 to-cyan/20 p-px shadow-[0_24px_70px_-32px_rgb(0_0_0/0.8)] md:mt-28">
        <div className="rounded-[1.45rem] border border-line bg-ink-2/95 p-6 backdrop-blur-sm sm:p-8 md:p-10">
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
            <div className="mx-auto max-w-2xl">
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
                  <div className="rounded-xl border border-line bg-ink transition-colors duration-300 focus-within:border-cyan/50">
                    <input
                      name="name"
                      required
                      type="text"
                      autoComplete="name"
                      placeholder="نام و نام خانوادگی"
                      aria-label="نام و نام خانوادگی"
                      className={fieldClasses}
                    />
                  </div>
                  <div className="rounded-xl border border-line bg-ink transition-colors duration-300 focus-within:border-cyan/50">
                    <input
                      name="email"
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      aria-label="Email"
                      dir="ltr"
                      className={cn(fieldClasses, "text-left")}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-line bg-ink transition-colors duration-300 focus-within:border-cyan/50">
                  <textarea
                    name="message"
                    required
                    rows={4}
                    placeholder="تجربه‌ی شما از این وب‌سایت…"
                    aria-label="متن نظر"
                    className={cn(fieldClasses, "resize-none py-3")}
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

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="mt-6 w-full rounded-xl border border-cyan/70 py-3 text-sm font-bold text-cyan transition-all duration-300 hover:bg-cyan hover:text-ink disabled:opacity-55 sm:w-auto sm:px-10"
                >
                  {status === "submitting" ? "در حال ارسال…" : "ارسال نظر"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}