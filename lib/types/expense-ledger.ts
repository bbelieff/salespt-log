/** 비용 원장 도메인 계약. SSOT: docs/plans/active/expense-ledger.md */
import { z } from "zod";

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const IsoMonth = z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM");
export const ExpenseId = z.string().uuid();
export const ExpenseName = z.string().trim().min(1).max(100);
export const CategoryName = z.string().trim().min(1).max(40);
export const AmountWon = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

export const ExpenseCategory = z.object({
  id: ExpenseId,
  name: CategoryName,
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

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

export const ExpenseQuery = z.object({
  view: z.enum(["month", "all", "category"]).default("month"),
  month: IsoMonth.optional(),
  categoryId: ExpenseId.optional(),
}).superRefine((v, ctx) => {
  if (v.view === "month" && !v.month) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "month가 필요해요.", path: ["month"] });
  if (v.view === "category" && !v.categoryId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "categoryId가 필요해요.", path: ["categoryId"] });
});

export interface RecognizedExpense {
  source: "one_time" | "recurring";
  id: string;
  categoryId: string;
  categoryName: string;
  itemName: string;
  amountWon: number;
  periodStart: string;
  periodEnd: string;
}

export interface ExpenseLedgerView {
  view: "month" | "all" | "category";
  month: string | null;
  categories: ExpenseCategory[];
  entries: RecognizedExpense[];
  categoryTotals: Array<{ categoryId: string; categoryName: string; amountWon: number }>;
  additionalCostTotal: number;
}
