"use client";

import { useEffect } from "react";

/**
 * Last resort: an error in the root layout itself, before any styling or shell
 * exists. It must render its own <html> and <body> and cannot rely on the
 * design tokens, so the styles here are inline on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root] unhandled error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f4f6f8",
          color: "#141c25",
        }}
      >
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            StockSense could not start
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#5d6976", margin: "0 0 1.25rem" }}>
            Something failed before the application loaded. Reloading usually clears it.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#5d6976",
                margin: "0 0 1.25rem",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              height: "2.25rem",
              padding: "0 1rem",
              borderRadius: "0.375rem",
              border: 0,
              background: "#0e7c6b",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
