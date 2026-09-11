/** Invitation secrets must never reach analytics/referrer collection. */
export function isSensitiveRecruitmentUrl(value: string): boolean {
  try {
    const url=new URL(value,"https://local.invalid");
    if(url.pathname === "/trainer/invite") return true;
    const returnTo=url.searchParams.get("returnTo");
    return !!returnTo && new URL(returnTo,"https://local.invalid").pathname === "/trainer/invite";
  } catch {return false;}
}

/** Drop sensitive navigation breadcrumbs at collection, not only while on the invite page. */
export function containsRecruitmentUrl(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "string") {
    let decoded = value;
    for (let i = 0; i < 3; i++) {
      if (/\/trainer\/invite(?:[/?#\s]|$)/i.test(decoded)) return true;
      try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
    }
    return false;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some(v => containsRecruitmentUrl(v, seen));
}
/** Defense for queued errors/transactions sent after SPA navigation away from invitations.
 * Only strings containing the invitation path are redacted; unrelated telemetry is preserved.
 */
export function scrubRecruitmentTelemetry<T>(input: T): T {
  const seen = new WeakMap<object, unknown>();
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return containsRecruitmentUrl(value) ? "[REDACTED:trainer-invitation]" : value;
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
    const output: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) Object.defineProperty(output, key, {value:visit(item),enumerable:true,writable:true,configurable:true});
    return output;
  };
  return visit(input) as T;
}
