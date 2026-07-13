/**
 * Layer: service — 기수 생성 pending 큐 **재시도** 유스케이스 (R3-5).
 *
 * create-cohort-members 라우트가 Drive 복제 실패 시 DB pending 큐에 적재한 잡을, 이 함수가
 * 나중에(관리자 "재시도" 버튼 / Secret 등록 후) 꺼내 복제→prep row 등록→(아레나) roster 로 완주.
 *
 * 멱등: 재시도는 findExistingSheetIdByCohortName 로 기존 시트를 먼저 재사용(중복 복제 방지),
 * addTraineePrepRow 도 (cohort,name) upsert 라 중복 행 안 생김(#546). done 마킹은 큐에서 제외.
 */
import {
  listPendingCohortCreates,
  markCohortCreateDone,
  markCohortCreateFailed,
  type PendingCohortRow,
} from "@/repo/db/cohort-pending";
import { copyTemplateSheet } from "@/repo/drive-client";
import { appendArenaRoster } from "@/repo/cohorts";
import { addTraineePrepRow } from "@/repo/users-prep";
import { findExistingSheetIdByCohortName } from "@/repo/users";
import { writeCourseDates } from "@/repo/course-dates";
import { computeGraduationISO, isValidISODate } from "@/service/cohort-dates";

const sheetUrlOf = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
const folderUrlOf = (id: string) => `https://drive.google.com/drive/folders/${id}`;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export interface RetrySummary {
  processed: number;
  done: { name: string; sheetId: string }[];
  stillPending: { name: string; reason: string }[];
}

/**
 * pending 잡 1건을 완주시켜 최종 sheetId 반환. 실패면 throw(호출자가 markFailed).
 *  - 이미 등록된 (cohort,name) 시트가 있으면 재사용(멱등).
 *  - create 모드 + 시트 없음 → 템플릿 복제(folderId 필수). link 모드는 job.sheetId 사용.
 */
export async function completeOnePending(job: PendingCohortRow): Promise<string> {
  // 1) 기존 시트 재사용(부분 성공/재시도 멱등).
  const existing = await findExistingSheetIdByCohortName(job.cohortLabel, job.name);
  let sheetId = existing ?? job.sheetId;

  // 2) 없으면 복제(create 모드). link 모드는 job.sheetId 가 정본이라 여기 안 옴.
  //    제목은 enqueue 시 라우트가 계산한 sheetTitle 을 그대로 사용(일반/아레나 규칙 divergence 방지).
  if (!sheetId) {
    if (job.mode !== "create") throw new Error("link 모드인데 sheetId 없음");
    if (!job.folderId) throw new Error("복제 대상 폴더 미해석(folderId 빈값)");
    if (!job.templateId) throw new Error("템플릿 id 빈값");
    if (!job.sheetTitle) throw new Error("시트 제목 미저장(sheetTitle 빈값)");
    sheetId = await copyTemplateSheet(job.templateId, job.sheetTitle, job.folderId);
  }

  // 3) 레지스트리 prep row(멱등 upsert — #546 결정좌표).
  await addTraineePrepRow(job.cohortLabel, job.name, sheetId);

  // 4) 새 시트 O1/O2 날짜 세팅(R3-5). O2=O1+50(ADR-0005). §2.5 가드로 사용자 수기값 보존.
  //    DB 값 방어: 외부 경로(백필·수동편집)로 course_start_iso 가 오염될 수 있어 재검증.
  //    실패해도 prep 은 이미 성공이므로 흡수(warn).
  if (job.courseStartISO && isValidISODate(job.courseStartISO)) {
    try {
      const r = await writeCourseDates(
        sheetId,
        job.courseStartISO,
        computeGraduationISO(job.courseStartISO),
      );
      if (r.written.length === 0 && r.preserved.length > 0) {
        console.warn(
          `[cohort-create] O1/O2 기존값 보존 — 입력 날짜 미반영: ${job.name} (${r.preserved.join(",")})`,
        );
      }
    } catch (e) {
      console.warn(
        `[cohort-create] O1/O2 세팅 실패(재시도는 성공): ${job.name}`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  // 5) 아레나 roster 1행(있으면).
  if (job.cohortType === "arena" && job.rosterSheetId) {
    await appendArenaRoster(job.rosterSheetId, {
      name: job.name,
      sheetUrl: sheetUrlOf(sheetId),
      folderUrl: job.folderId ? folderUrlOf(job.folderId) : "",
      regDateISO: todayISO(),
    });
  }
  return sheetId;
}

/** pending 큐 배치 재시도. 부분 실패 허용(실패는 pending 유지, 다음 배치 재시도). */
export async function processPendingCohortCreates(limit = 100): Promise<RetrySummary> {
  const jobs = await listPendingCohortCreates(limit);
  const done: RetrySummary["done"] = [];
  const stillPending: RetrySummary["stillPending"] = [];
  for (const job of jobs) {
    try {
      const sheetId = await completeOnePending(job);
      await markCohortCreateDone(job.id, sheetId);
      done.push({ name: job.name, sheetId });
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown";
      await markCohortCreateFailed(job.id, reason);
      stillPending.push({ name: job.name, reason });
    }
  }
  return { processed: jobs.length, done, stillPending };
}
