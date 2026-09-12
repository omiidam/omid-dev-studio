"use client";

import { useRef, useState, type FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error";

const fieldClasses =
  "w-full bg-transparent px-1 py-2 text-sm text-paper placeholder:text-faint focus:outline-none";

/**
 * Footer "Get in touch" card — the attached reference form's structure
 * (gradient-border card, inset-shadow fields, outlined accent button that
 * fills on hover) rebuilt with the OMID Studio violet→cyan system and
 * Persian labels. Submissions go to the same POST /api/projects endpoint
 * as the main inquiry form, mapped onto the same validated schema:
 * the subject line is folded into the description so nothing new is
 * required from the backend.
 */
export function FooterGetInTouch() {
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
    const subject = String(data.get("subject") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    // The inquiry schema requires a 20+ character description — the subject
    // is folded in so a short subject + message still satisfies it.
    const description = subject ? `موضوع: ${subject}\n\n${message}` : message;
    if (name.length < 2 || !email.includes("@") || description.length < 20) {
      setError("لطفاً نام، ایمیل معتبر و پیام بیشتر از چند کلمه وارد کنید.");
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
          description,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus("success");
      form.reset();
      trackEvent("form_submit_success");
    } catch {
      setError("ارسال پیام انجام نشد — اتصال را بررسی کنید و دوباره تلاش کنید.");
      setStatus("error");
      trackEvent("form_submit_error", { reason: "network" });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-[1.4rem] border border-line bg-gradient-to-br from-violet/30 via-line/60 to-cyan/30 p-px shadow-[0_24px_64px_-28px_rgb(0_0_0/0.75)]">
      <div className="rounded-[1.35rem] border border-line bg-ink-2/95 p-6 backdrop-blur-sm md:p-8">
        {status === "success" ? (
          <div className="flex min-h-72 flex-col items-start justify-center gap-4" role="status">
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-tr from-violet to-cyan text-ink">
              <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="m3 8.5 3.5 3.5L13 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-lg font-medium text-paper">پیام شما ارسال شد.</p>
            <p className="text-sm leading-relaxed text-muted">
              ممنون از تماس شما — به‌زودی پاسخ می‌دهیم.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="text-[12px] font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-paper"
            >
              ارسال پیام دیگر
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} onFocus={handleFocus} noValidate>
            <p className="text-center text-base font-semibold text-cyan">
              در تماس باشیم
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-ink shadow-[inset_2px_5px_10px_rgb(0_0_0/0.4)] transition-colors duration-300 focus-within:border-cyan/50">
                <input
                  name="name"
                  required
                  type="text"
                  autoComplete="name"
                  placeholder="نام"
                  aria-label="نام"
                  className={fieldClasses}
                />
              </div>
              <div className="rounded-xl border border-line bg-ink shadow-[inset_2px_5px_10px_rgb(0_0_0/0.4)] transition-colors duration-300 focus-within:border-cyan/50">
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="ایمیل"
                  aria-label="ایمیل"
                  className={fieldClasses}
                />
              </div>
              <div className="rounded-xl border border-line bg-ink shadow-[inset_2px_5px_10px_rgb(0_0_0/0.4)] transition-colors duration-300 focus-within:border-cyan/50">
                <input
                  name="subject"
                  type="text"
                  placeholder="موضوع"
                  aria-label="موضوع"
                  className={fieldClasses}
                />
              </div>
              <div className="rounded-xl border border-line bg-ink shadow-[inset_2px_5px_10px_rgb(0_0_0/0.4)] transition-colors duration-300 focus-within:border-cyan/50">
                <textarea
                  name="message"
                  required
                  rows={3}
                  placeholder="پیام"
                  aria-label="پیام"
                  className={cn(fieldClasses, "resize-none")}
                />
              </div>
            </div>

            {status === "error" && error && (
              <p role="alert" className="mt-3 text-[12px] leading-relaxed text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-5 w-full rounded-xl border border-cyan/70 py-3 text-sm font-bold text-cyan transition-all duration-300 hover:bg-cyan hover:text-ink disabled:opacity-55"
            >
              {status === "submitting" ? "در حال ارسال…" : "ارسال پیام"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
