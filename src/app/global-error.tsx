"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem" }}>
        <div
          role="alert"
          aria-live="assertive"
          style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 12 }}>
            Application error
          </h1>
          <p style={{ color: "#555", marginBottom: 24 }}>
            The app failed to load. Please retry; if the problem persists,
            refresh the page.
          </p>
          {error.digest && (
            <p style={{ color: "#999", fontSize: 12, marginBottom: 24 }}>
              Error ID: <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            style={{
              background: "#1B6B3A",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "none",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
