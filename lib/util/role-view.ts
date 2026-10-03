export type ViewRole = "student" | "trainer";
const paths: Record<ViewRole, readonly string[]> = {
  student: ["/dashboard", "/contact", "/schedule", "/calendar", "/payment", "/db", "/updates", "/weekly-goals", "/captain"],
  trainer: ["/trainer", "/trainer/weekly-goals"],
};
/** No query/token, arbitrary URL, target email, admin or recruitment destination can persist. */
export function safeRolePath(role: ViewRole, value: unknown): string | null {
  return typeof value === "string" && paths[role].includes(value) ? value : null;
}
export type ViewMemory = {role: ViewRole; student?: string; trainer?: string};
export function parseViewMemory(value: string | undefined): ViewMemory | null {
  try {
    const data = JSON.parse(value ?? "null");
    if (!data || !["student","trainer"].includes(data.role)) return null;
    return {role:data.role,student:safeRolePath("student",data.student) ?? undefined,trainer:safeRolePath("trainer",data.trainer) ?? undefined};
  } catch { return null; }
}
