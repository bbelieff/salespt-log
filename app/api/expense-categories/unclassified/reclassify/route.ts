import { NextRequest, NextResponse } from "next/server";
import { getWritableUserEmail } from "@/auth/identity";
import { ReclassifyUnclassifiedBody } from "@/types/expense-ledger";
import { reclassifyUnclassifiedForUser } from "@/service/expense-ledger";
import { expenseError } from "@/app/api/expenses/_response";
import { withApiTiming } from "@/lib/analytics/api-timing";

async function POST_handler(req: NextRequest) {
  try {
    const parsed = ReclassifyUnclassifiedBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    return NextResponse.json(await reclassifyUnclassifiedForUser(await getWritableUserEmail(), parsed.data));
  } catch (e) { return expenseError(e); }
}
export const POST = withApiTiming("expense_ledger_unclassified_reclassify:POST", POST_handler);
