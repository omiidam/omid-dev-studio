"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. Rendered only when the root layout itself
 * fails (or error.tsx throws), so it must provide its own <html>/<body>.
 * Kept deliberately small and dependency-free — global styles may not have
 * loaded at this point.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "#060609",
          color: "#f4f4f5",
          fontFamily: "system-ui, 'Segoe UI', Tahoma, sans-serif",
        }}
      >
        <p style={{ fontSize: "12px", color: "rgb(134 134 145)" }}>
          خطای غیرمنتظره
        </p>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", margin: 0 }}>
          چیزی درست پیش نرفت.
        </h1>
        <p style={{ maxWidth: "26rem", color: "rgb(134 134 145)", lineHeight: 1.8 }}>
          یک خطای غیرمنتظره رخ داد. برای بازگشت به حالت عادی، دوباره تلاش کنید.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.9rem 2rem",
            border: "none",
            borderRadius: "999px",
            background: "linear-gradient(135deg, #a78bfa, #55c1ff)",
            color: "#060609",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          تلاش دوباره
        </button>
      </body>
    </html>
  );
}
