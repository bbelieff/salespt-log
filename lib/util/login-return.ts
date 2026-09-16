/** Internal login destinations only. Destination selection never grants access. */
const DESTINATIONS = [
  "/dashboard", "/contact", "/schedule", "/calendar", "/payment", "/db",
  "/admin", "/trainer", "/claim",
];

export function safeLoginReturn(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Reject browser URL normalization tricks, including percent-encoded variants.
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
  const path = value.split(/[?#]/, 1)[0]!;
  if (path.includes("%") || path.split("/").some((part) => part === "." || part === "..")) return null;
  // Invitation secrets live only in a browser fragment/tab storage, never OAuth return URLs.
  if (path === "/trainer/invite" || path.startsWith("/trainer/invite/")) return "/trainer/invite";
  return DESTINATIONS.some((root) => path === root || path.startsWith(`${root}/`))
    ? value
    : null;
}
