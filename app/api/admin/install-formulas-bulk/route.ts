/**
 * POST /api/admin/install-formulas-bulk — admin only.
 *
 * 모든 trainee 시트에 자동 집계 수식 일괄 설치:
 *   - 04 업체관리 N/O/Q 컬럼 (per-row 수식, 1~1000행)
 *   - 01 영업관리 I~P 컬럼 (데이터 행에만)
 *
 * 사용 시점: 사용자가 시트 셀 서식·수식 실수로 지운 경우 일괄 복원.
 * installFormulas() 가 멱등이라 다시 호출해도 안전 (덮어쓰기).
 *
 * 응답: { processed, success: [...], failed: [{email, name, error}] }
 *
 * 전제: SA 가 각 trainee 시트의 writer 권한 보유 (폴더 공유 또는 명시).
 * writer 권한 없는 시트는 failed 에 사유 표시.
 */
import { NextResponse } from "next/server";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import { installFormulas } from "@/repo/setup-formulas";
import { withApiTiming } from "@/lib/analytics/api-timing";

export const dynamic = "force-dynamic";

interface SuccessItem {
  email: string;
  name: string;
  cohort: string;
  installed: number;
  /** 사용자 raw 값 보존된 셀 개수 (2026-05-14 사고 후 안전 가드). */
  preserved: number;
  /** 보존된 셀 A1 ref list (최대 50개까지만 클라이언트로 보냄). */
  preservedCells: string[];
}
interface FailedItem {
  email: string;
  name: string;
  cohort: string;
  error: string;
}

const INSTALL_CONCURRENCY = 5;
// installFormulas 는 시트당 read 1회 + write 1회. 5개 wave 사이 7.5초를 두면
// bulk 자체 상한이 종류별 약 40 req/min 이라 SA quota 60/min 에 headroom 이 남는다.
const INSTALL_WAVE_DELAY_MS = 7_500;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function POST_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdminEmail(sessionEmail))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const all = await listAllUsers();
  const trainees = all.filter(
    (u) => u.role === "trainee" && u.spreadsheetId,
  );

  // 같은 시트 공유하는 multi-account 중복 제거 — sheetId 기준 unique.
  const seen = new Set<string>();
  const targets: typeof trainees = [];
  for (const u of trainees) {
    if (seen.has(u.spreadsheetId)) continue;
    seen.add(u.spreadsheetId);
    targets.push(u);
  }

  const success: SuccessItem[] = [];
  const failed: FailedItem[] = [];

  for (let i = 0; i < targets.length; i += INSTALL_CONCURRENCY) {
    const batch = targets.slice(i, i + INSTALL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((u) => installFormulas(u.spreadsheetId)),
    );
    for (let j = 0; j < batch.length; j++) {
      const u = batch[j]!;
      const result = results[j]!;
      if (result.status === "fulfilled") {
        success.push({
          email: u.email,
          name: u.name,
          cohort: u.cohort,
          installed: result.value.installed,
          preserved: result.value.preserved,
          preservedCells: result.value.preservedCells.slice(0, 50),
        });
      } else {
        failed.push({
          email: u.email,
          name: u.name,
          cohort: u.cohort,
          error: result.reason instanceof Error ? result.reason.message : "unknown",
        });
      }
    }
    if (i + INSTALL_CONCURRENCY < targets.length) {
      await wait(INSTALL_WAVE_DELAY_MS);
    }
  }

  return NextResponse.json({
    processed: targets.length,
    success,
    failed,
  });
}

// API 타이밍 계측 (db-migration-pilot §1 P0)
export const POST = withApiTiming("api/admin/install-formulas-bulk:POST", POST_handler);
