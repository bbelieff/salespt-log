import { loadGoalOverview } from "@/service/weekly-goals-overview";
import { goalResponse } from "../response";
export const dynamic = "force-dynamic";
export async function GET() { return goalResponse(loadGoalOverview); }
