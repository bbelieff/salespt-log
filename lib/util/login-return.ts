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

/** `/login` 별칭이 보낼 곳 — app/login/page.tsx. 목적지는 경로만 꺼내 다시 검증한다. */
export type LoginAliasParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** `https://host/dashboard?x=1` → `/dashboard?x=1`. 경로만 쓰므로 호스트는 버린다. */
function pathOnly(v: string | undefined): string | undefined {
  if (!v) return undefined;
  if (v.startsWith("/")) return v;
  try {
    const u = new URL(v);
    return u.pathname + u.search;
  } catch {
    return undefined;
  }
}

export function loginRedirectTarget(params: LoginAliasParams): string {
  const returnTo =
    safeLoginReturn(pathOnly(first(params.returnTo))) ??
    safeLoginReturn(pathOnly(first(params.callbackUrl)));
  const q = new URLSearchParams();
  if (returnTo) q.set("returnTo", returnTo);
  if (first(params.error)) q.set("loginError", "1");
  const qs = q.toString();
  return qs ? `/?${qs}` : "/";
}
