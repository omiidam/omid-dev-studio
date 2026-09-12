"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  budgetOptions,
  inquirySchema,
  projectTypeOptions,
  type InquiryInput,
} from "@/lib/project-schema";
import { EASE } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { site } from "@/data/site";

type Status = "idle" | "submitting" | "success" | "error";

const inputClasses =
  "w-full border-b border-line bg-transparent py-3 text-[15px] text-paper placeholder:text-faint transition-colors duration-300 focus:border-cyan focus:outline-none";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-[12px] text-danger">
      {message}
    </p>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute end-1 top-1/2 size-4 -translate-y-1/2 text-muted"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NETWORK_ERROR_MESSAGE =
  "درخواست شما ثبت نشد — اتصال برقرار نیست. پس از برقراری اتصال دوباره تلاش کنید، یا مستقیم به ایمیل ما بنویسید.";

interface ApiErrorBody {
  message?: string;
  fields?: Record<string, string>;
}

async function readApiError(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    const body: unknown = await response.json();
    const error =
      typeof body === "object" && body !== null
        ? (body as { error?: { message?: unknown; fields?: unknown } }).error
        : undefined;
    if (!error) return undefined;
    return {
      message:
        typeof error.message === "string" ? error.message : undefined,
      fields:
        error.fields && typeof error.fields === "object"
          ? (error.fields as Record<string, string>)
          : undefined,
    };
  } catch {
    return undefined;
  }
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  // Distinguishes "the server answered but something failed" from generic
  // submission errors, so the user gets precise Persian feedback.
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const formStartedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      projectType: "website",
      budget: "unsure",
      description: "",
      referenceUrl: "",
    },
  });

  // Cancel any in-flight submission when the form unmounts so a stale request
  // can never update state (or waste bandwidth) for a component that is gone.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onValid = useCallback(
    async (data: InquiryInput) => {
      if (submittingRef.current) return;
      const controller = new AbortController();
      submittingRef.current = true;
      abortRef.current = controller;
      setStatus("submitting");
      setServerMessage(null);
      try {
        const [response] = await Promise.all([
          fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            signal: controller.signal,
          }),
          // keep the loading state from feeling instantaneous
          new Promise((resolve) => setTimeout(resolve, 700)),
        ]);

        if (!response.ok) {
          const apiError = await readApiError(response);
          const fields = apiError?.fields;
          if (fields && Object.keys(fields).length > 0) {
            // Server-side field errors → inline Persian feedback next to each
            // field. The submitted values are preserved.
            for (const [field, message] of Object.entries(fields)) {
              setError(field as keyof InquiryInput, {
                type: "server",
                message,
              });
            }
            setStatus("idle");
            trackEvent("form_submit_error", { reason: "validation" });
          } else {
            setServerMessage(
              apiError?.message ?? NETWORK_ERROR_MESSAGE,
            );
            setStatus("error");
            trackEvent("form_submit_error", { reason: "server" });
          }
          return;
        }

        setStatus("success");
        reset();
        trackEvent("form_submit_success");
      } catch {
        // Aborted requests (unmount) are not user-facing errors.
        if (!controller.signal.aborted) {
          setServerMessage(NETWORK_ERROR_MESSAGE);
          setStatus("error");
          trackEvent("form_submit_error", { reason: "network" });
        }
      } finally {
        submittingRef.current = false;
        abortRef.current = null;
      }
    },
    [reset, setError],
  );

  // Fire "form started" exactly once per render cycle of the form — the first
  // time any field receives focus. The ref makes duplicate events impossible
  // across re-renders and React Strict Mode.
  const handleFormFocus = () => {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackEvent("form_start");
  };

  // Wire the validated submit handler in the event handler itself so the
  // refs above are only ever read in response to user interaction.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(onValid)(event);
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex min-h-[24rem] flex-col items-start justify-center gap-5"
            role="status"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-tr from-violet to-cyan text-ink">
              <svg className="size-5" viewBox="0 0 16 16" fill="none">
                <path
                  d="m3 8.5 3.5 3.5L13 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h3 className="text-2xl font-medium tracking-tight text-paper">
              درخواست شما ثبت شد.
            </h3>
            <p className="max-w-sm text-base leading-relaxed text-muted">
              ممنون از پیام شما — OMID Studio ظرف دو روز کاری پاسخ می‌دهد.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-2 text-[12px] font-medium text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-paper"
            >
              ارسال درخواست دیگر
            </button>
          </motion.div>
        ) : (
<motion.form
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: EASE }}
          onSubmit={onSubmit}
          onFocus={handleFormFocus}
          noValidate
        >
            <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
              <div>
                <label htmlFor="cf-name" className="text-[12px] font-medium text-faint">
                  نام
                </label>
                <input
                  id="cf-name"
                  type="text"
                  autoComplete="name"
                  placeholder="نام شما"
                  aria-invalid={!!errors.name}
                  className={cn(inputClasses, errors.name && "border-danger")}
                  {...register("name")}
                />
                <FieldError message={errors.name?.message} />
              </div>

              <div>
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${site.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track="email_link_click"
                  data-track-prop-source="contact-form"
                  className="text-[12px] font-medium text-faint transition-colors duration-300 hover:text-paper"
                  dir="ltr"
                  style={{ unicodeBidi: "isolate" }}
                >
                  Email
                </a>
                <input
                  id="cf-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-invalid={!!errors.email}
                  className={cn(inputClasses, errors.email && "border-danger")}
                  {...register("email")}
                />
                <FieldError message={errors.email?.message} />
              </div>

              <div>
                <label htmlFor="cf-company" className="text-[12px] font-medium text-faint">
                  شرکت یا برند <span className="text-faint/60">(اختیاری)</span>
                </label>
                <input
                  id="cf-company"
                  type="text"
                  autoComplete="organization"
                  placeholder="نام شرکت یا برند"
                  className={inputClasses}
                  {...register("company")}
                />
              </div>

              <div className="relative">
                <label htmlFor="cf-type" className="text-[12px] font-medium text-faint">
                  نوع پروژه
                </label>
                <select
                  id="cf-type"
                  aria-invalid={!!errors.projectType}
                  className={cn(inputClasses, "appearance-none pe-8", errors.projectType && "border-danger")}
                  {...register("projectType")}
                >
                  {projectTypeOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-ink-2 text-paper"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <Chevron />
                <FieldError message={errors.projectType?.message} />
              </div>

              <div className="relative sm:col-span-2">
                <label htmlFor="cf-budget" className="text-[12px] font-medium text-faint">
                  محدوده‌ی بودجه
                </label>
                <select
                  id="cf-budget"
                  aria-invalid={!!errors.budget}
                  className={cn(inputClasses, "appearance-none pe-8", errors.budget && "border-danger")}
                  {...register("budget")}
                >
                  {budgetOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-ink-2 text-paper"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <Chevron />
                <FieldError message={errors.budget?.message} />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="cf-description" className="text-[12px] font-medium text-faint">
                  توضیحات پروژه
                </label>
                <textarea
                  id="cf-description"
                  rows={4}
                  placeholder="چه می‌سازید و باید به چه چیزی برسد؟"
                  aria-invalid={!!errors.description}
                  className={cn(inputClasses, "resize-none", errors.description && "border-danger")}
                  {...register("description")}
                />
                <FieldError message={errors.description?.message} />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="cf-url" className="text-[12px] font-medium text-faint">
                  لینک مرجع <span className="text-faint/60">(اختیاری)</span>
                </label>
                <input
                  id="cf-url"
                  type="url"
                  dir="ltr"
                  placeholder="https://"
                  aria-invalid={!!errors.referenceUrl}
                  className={cn(inputClasses, errors.referenceUrl && "border-danger", "text-left")}
                  style={{ textAlign: "left", unicodeBidi: "plaintext" }}
                  {...register("referenceUrl")}
                />
                <FieldError message={errors.referenceUrl?.message} />
              </div>
            </div>

            {status === "error" && serverMessage && (
              <div
                role="alert"
                className="mt-8 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-paper"
              >
                <svg className="size-4 shrink-0 text-danger" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {serverMessage}{" "}
                <a href={`mailto:${site.email}`} className="text-cyan underline underline-offset-4" dir="ltr">
                  {site.email}
                </a>
                .
              </div>
            )}

            <div className="mt-10">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="group btn btn-primary h-12 px-8 text-[15px]"
              >
                {status === "submitting" ? (
                  <>
                    <svg
                      className="size-4 animate-spin"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    در حال ارسال…
                  </>
                ) : (
                  <>
                    ارسال درخواست پروژه
                    <svg
                      aria-hidden="true"
                      className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5"
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
                  </>
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}