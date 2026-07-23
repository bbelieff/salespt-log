import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { expenseError } from "@/app/api/expenses/_response";

const ROOT = join(__dirname, "..", "..");
const EXPENSE_ROUTE_ROOTS = [
  "app/api/expenses",
  "app/api/expense-categories",
  "app/api/expense-recurring-rules",
];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? routeFiles(full)
      : name === "route.ts" ? [full] : [];
  });
}

async function result(error: unknown) {
  const response = expenseError(error);
  return { status: response.status, body: await response.json() };
}

describe("expense API error response", () => {
  it("returns a safe 401 response for the shared authentication error", async () => {
    await expect(result(new Error("[auth] 로그인이 필요합니다."))).resolves.toEqual({
      status: 401,
      body: { error: "unauthenticated" },
    });
  });

  it.each([
    ["expense_invalid_period", 400],
    ["expense_category_duplicate", 409],
    ["expense_entry_not_found", 404],
    ["expense_scope_not_found", 404],
    ["expense_ledger_unavailable", 503],
  ])("preserves the %s mapping", async (code, status) => {
    await expect(result(new Error(code))).resolves.toEqual({
      status,
      body: { error: code },
    });
  });

  it("does not expose unexpected error details", async () => {
    await expect(result(new Error("database credential leaked"))).resolves.toEqual({
      status: 500,
      body: { error: "expense_ledger_failed" },
    });
  });

  it("routes every expense endpoint through the shared safe mapper", () => {
    const files = EXPENSE_ROUTE_ROOTS.flatMap((dir) => routeFiles(join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(ROOT, file)).toMatch(
        /import \{ expenseError \} from "[^"]*_response"/,
      );
      expect(source, relative(ROOT, file)).toContain("return expenseError(e)");
    }
  });
});
