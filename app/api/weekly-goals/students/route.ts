import { listGoalStudents } from "@/service/weekly-goals";
import { goalResponse } from "../response";
export const dynamic = "force-dynamic";
export async function GET() { return goalResponse(listGoalStudents); }
