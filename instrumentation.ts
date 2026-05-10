/**
 * Next.js 15 instrumentation hook — 런타임별 Sentry config 분기.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { onRequestError } from "@sentry/nextjs";
