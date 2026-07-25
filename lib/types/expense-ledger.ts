/** 비용 원장 도메인 계약. SSOT: docs/plans/active/expense-ledger.md */
import { z } from "zod";

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const IsoMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");
export const ExpenseId = z.string().uuid();
export const ExpenseName = z.string().trim().min(1).max(100);
export const CategoryName = z.string().trim().min(1).max(40);
export const AmountWon = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

export const SystemExpenseCategoryId = z.enum([
  "system:db_purchase",
  "system:db_production",
  "system:db_banner",
]);

export const ExpenseCategory = z.object({
  id: ExpenseId,
  name: CategoryName,
  isSystem: z.boolean().default(false),
  deletedAt: z.string().nullable().default(null),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExpenseCategory = z.input<typeof ExpenseCategory>;

export const ExpenseEntry = z.object({
  id: ExpenseId,
  categoryId: ExpenseId,
  categoryName: CategoryName,
  itemName: ExpenseName,
  amountWon: AmountWon,
  periodStart: IsoDate,
  periodEnd: IsoDate,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExpenseEntry = z.infer<typeof ExpenseEntry>;

export const RecurringRule = z.object({
  id: ExpenseId,
  categoryId: ExpenseId,
  categoryName: CategoryName,
  itemName: ExpenseName,
  amountWon: AmountWon,
  anchorDay: z.number().int().min(1).max(31),
  startsOn: IsoDate,
  endsOn: IsoDate.nullable(),
  status: z.enum(["active", "paused", "archived"]),
  supersedesRuleId: ExpenseId.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RecurringRule = z.infer<typeof RecurringRule>;

const CreateExpenseShape = z.object({
  categoryId: ExpenseId,
  itemName: ExpenseName,
  amountWon: AmountWon,
  periodStart: IsoDate,
  periodEnd: IsoDate.optional(),
});
export const CreateExpenseBody = CreateExpenseShape.superRefine((v, ctx) => {
  if (v.periodEnd && v.periodEnd < v.periodStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "종료일은 시작일보다 빠를 수 없어요.", path: ["periodEnd"] });
  }
});
export type CreateExpenseBody = z.infer<typeof CreateExpenseBody>;

export const PatchExpenseBody = CreateExpenseShape.partial();

const CreateRecurringRuleShape = z.object({
  categoryId: ExpenseId,
  itemName: ExpenseName,
  amountWon: AmountWon,
  anchorDay: z.number().int().min(1).max(31),
  startsOn: IsoDate,
  endsOn: IsoDate.optional(),
});
export const CreateRecurringRuleBody = CreateRecurringRuleShape.superRefine((v, ctx) => {
  if (v.endsOn && v.endsOn < v.startsOn) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "종료일은 시작일보다 빠를 수 없어요.", path: ["endsOn"] });
  }
});
export type CreateRecurringRuleBody = z.infer<typeof CreateRecurringRuleBody>;

export const PatchRecurringRuleBody = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("occurrence"),
    occurrenceMonth: IsoMonth,
    patch: z.object({ categoryId: ExpenseId.optional(), itemName: ExpenseName.optional(), amountWon: AmountWon.optional() }).refine((v) => Object.keys(v).length > 0, "수정할 값이 필요해요."),
  }),
  z.object({
    scope: z.literal("future"),
    effectiveMonth: IsoMonth,
    patch: CreateRecurringRuleShape.partial().refine((v) => Object.keys(v).length > 0, "수정할 값이 필요해요."),
  }),
]);
export type PatchRecurringRuleBody = z.infer<typeof PatchRecurringRuleBody>;

export const ExpenseReclassificationRef = z.object({
  kind: z.enum(["entry", "recurringRule", "recurringOccurrence"]),
  id: ExpenseId,
}).strict();
export type ExpenseReclassificationRef = z.infer<typeof ExpenseReclassificationRef>;

export const ReclassifyUnclassifiedBody = z.object({
  operationId: ExpenseId,
  targetCategoryId: ExpenseId,
  refs: z.array(ExpenseReclassificationRef).min(1).max(500),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  value.refs.forEach((ref, index) => {
    const key = `${ref.kind}:${ref.id.toLowerCase()}`;
    if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["refs", index], message: "duplicate typed ref" });
    seen.add(key);
  });
});
export type ReclassifyUnclassifiedBody = z.infer<typeof ReclassifyUnclassifiedBody>;

export interface ExpenseCategoryUsage {
  category: { id: string; name: string; isSystem: false; deletedAt: null };
  usage: { entryCount: number; ruleCount: number; occurrenceCount: number; overrideOccurrenceCount: number; totalCount: number };
}

export interface DeleteExpenseCategoryResult {
  ok: true;
  deletedCategoryId: string;
  unclassifiedCategoryId: string;
  movedEntryCount: number;
  movedRuleCount: number;
  movedOccurrenceCount: number;
}

export interface ReclassifyUnclassifiedResult {
  ok: true;
  operationId: string;
  unclassifiedCategoryId: string;
  targetCategoryId: string;
  movedEntryCount: number;
  movedRuleCount: number;
  movedOccurrenceCount: number;
}

export const ExpenseQuery = z.object({
  view: z.enum(["month", "all", "category"]).default("month"),
  month: IsoMonth.optional(),
  categoryId: z.union([ExpenseId, SystemExpenseCategoryId]).optional(),
}).superRefine((v, ctx) => {
  if (v.view === "month" && !v.month) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "month가 필요해요.", path: ["month"] });
  if (v.view === "category" && !v.categoryId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "categoryId가 필요해요.", path: ["categoryId"] });
});

export interface RecognizedExpense {
  source: "one_time" | "recurring" | "db_purchase" | "db_production" | "db_banner";
  id: string;
  categoryId: string;
  categoryName: string;
  itemName: string;
  amountWon: number;
  periodStart: string;
  periodEnd: string;
  system: boolean;
  readOnly: boolean;
  recognitionStatus: "allocated" | "recognized_on_date" | "recognized_on_start" | "unallocated";
  recognitionNote: string | null;
}

interface ExpenseCategoryTotal {
  categoryId: string;
  categoryName: string;
  amountWon: number;
  itemCount: number;
  sharePercent: number;
  system: boolean;
  archived: boolean;
}

interface ExpenseSelectedScope {
  view: "month" | "all" | "category";
  month: string | null;
  categoryId: string | null;
  label: string;
}

export interface ExpenseLedgerView {
  view: "month" | "all" | "category";
  month: string | null;
  categories: ExpenseCategory[];
  entries: RecognizedExpense[];
  categoryTotals: ExpenseCategoryTotal[];
  dbCostTotal: number;
  additionalCostTotal: number;
  totalCost: number;
  selectedScope: ExpenseSelectedScope;
}
