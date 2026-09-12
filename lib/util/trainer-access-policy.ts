/** Import-free util: exported contracts live in types/trainer-access.ts.
 * Type compatibility is checked by the policy regression test, not a util dependency.
 */

/**
 * NormalizedTrainerStudent only: the caller resolves labels and trustworthy cohort metadata.
 * Missing/failed metadata is NOT an active cohort. Exclusion precedes archived, then arena.
 */
export function classifyTrainerStudent(input: unknown): "active" | "arena" | "archived" | null {
  if (!hasExactKeys(input, [
    "rowStatus", "cohortStatus", "cohortType", "cohortMetadataTrusted", "isArenaLabel", "isReserved",
  ])) return null;
  if (input.cohortMetadataTrusted !== true || input.isReserved !== false
    || typeof input.isArenaLabel !== "boolean") return null;
  if (input.rowStatus !== "active" && input.rowStatus !== "archived") return null;
  if (input.cohortStatus !== "active" && input.cohortStatus !== "archived") return null;
  if (input.cohortType !== "cohort" && input.cohortType !== "arena") return null;
  if (input.rowStatus === "archived" || input.cohortStatus === "archived") return "archived";
  if (input.cohortType === "arena" || input.isArenaLabel) return "arena";
  return "active";
}

/**
 * Trainer-to-other-student policy only, NOT authentication or own-CRM/admin authorization.
 * Caller supplies NormalizedTrainerActor with explicit, server-owned grants. Grants may
 * restrict the grade defaults, never expand them. Invalid grants deny all categories.
 */
export function canTrainerAccessStudent(
  actor: unknown, student: unknown, operation: unknown,
): boolean {
  if (operation !== "read" && operation !== "write") return false;
  if (!hasExactKeys(actor, ["grade", "status", "grants"]) || actor.status !== "active") return false;
  if (!isTrainerGrants(actor.grants)) return false;
  const category = classifyTrainerStudent(student);
  if (category === null) return false;
  return defaultTrainerGrants(actor.grade)[category][operation] && actor.grants[category][operation];
}

const categories = ["active", "arena", "archived"] as const;

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/** Validate, never coerce or repair. Every write requires the same category's read. */
export function isTrainerGrants(value: unknown): value is ReturnType<typeof defaultTrainerGrants> {
  return hasExactKeys(value, categories) && categories.every((category) => {
    const grant = value[category];
    return hasExactKeys(grant, ["read", "write"])
      && typeof grant.read === "boolean" && typeof grant.write === "boolean"
      && (!grant.write || grant.read);
  });
}

export function defaultTrainerGrants(grade: unknown) {
  const senior = grade === "senior";
  const active = senior || grade === "regular" || grade === "apprentice";
  return {
    active: { read: active, write: active },
    arena: { read: senior, write: senior },
    archived: { read: senior, write: senior },
  };
}
