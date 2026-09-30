"use client";

/**
 * Runs a snippet synchronously during HTML parsing, before first paint.
 * Pattern from Next's "preventing flash before hydration" guide: `text/plain`
 * on the client stops React re-running it or warning about script tags.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
