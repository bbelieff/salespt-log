/**
 * Layer: repo/db — 기수 생성 **pending 큐**(DB 정본, R3-5).
 *
 * 왜: admin 기수 생성 시 Drive 시트 복제가 실패(토큰 미설정·429·권한·네트워크)하면 그 멤버가
 * 통째로 누락됐다(생성이 Drive 에 막힘). R3-5 = 복제 실패해도 멤버를 **DB pending 큐에 정본으로
 * 적재**하고(생성 비차단), 이후 재시도 잡이 복제→prep row 등록을 완주시킨다.
 *
 * 정본 = 이 테이블. 시트(레지스트리)는 재시도가 성공한 뒤에 채워진다.
 * pg 격리: 이 파일은 lib/repo/db/ 전용 구역(구조 테스트). getDbPool 공유.
 */
import { getDbPool, dbEnabled } from "./client";

export interface PendingCohortJob {
  /** parseCohortToken 의 label — 일반 "8", 아레나 "A1-1기". */
  cohortLabel: string;
  /** "cohort" | "arena". */
  cohortType: string;
  name: string;
  /** "create"(템플릿 복제) | "link"(기존 시트 URL). */
  mode: string;
  /** link 모드는 미리 있음. create 는 복제 성공 후 채워짐(enqueue 시엔 보통 빈값). */
  sheetId: string;
  /** create 모드: 복제 대상 폴더 id(enqueue 시점에 이미 해석됨). */
  folderId: string;
  /** create 모드: 복제 원본 템플릿 id. */
  templateId: string;
  /** 복제 시 쓸 시트 제목(라우트가 decideMemberAction 으로 이미 계산 — 재시도가 그대로 사용,
   *  일반/아레나 제목 규칙 divergence 방지). */
  sheetTitle: string;
  /** 아레나: roster 시트 id(있으면 재시도 성공 후 1행 append). */
  rosterSheetId: string;
}

export interface PendingCohortRow extends PendingCohortJob {
  id: number;
  status: "pending" | "done" | "failed";
  attempts: number;
  lastError: string;
}

/**
 * 순수 — 라우트 입력에서 pending 잡 레코드 구성(정규화). SQL·pg 무의존이라 단위테스트 대상.
 * cohortLabel 은 "기" 정규화(레지스트리 매칭 키와 동일 규약).
 */
export function buildPendingCohortJob(input: {
  cohortLabel: string;
  cohortType: string;
  name: string;
  mode: string;
  sheetId?: string;
  folderId?: string;
  templateId?: string;
  sheetTitle?: string;
  rosterSheetId?: string;
}): PendingCohortJob {
  return {
    cohortLabel: String(input.cohortLabel).replace(/기\s*$/, "").trim(),
    cohortType: input.cohortType === "arena" ? "arena" : "cohort",
    name: String(input.name).trim(),
    mode: input.mode === "link" ? "link" : "create",
    sheetId: String(input.sheetId ?? "").trim(),
    folderId: String(input.folderId ?? "").trim(),
    templateId: String(input.templateId ?? "").trim(),
    sheetTitle: String(input.sheetTitle ?? "").trim(),
    rosterSheetId: String(input.rosterSheetId ?? "").trim(),
  };
}

let schemaReady: Promise<void> | null = null;

/** cohort_pending_creates 스키마 보장 — 첫 사용 시 1회(promise 캐시), 멱등. */
export function ensureCohortPendingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = doEnsure().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

async function doEnsure(): Promise<void> {
  await getDbPool().query(`
    create table if not exists cohort_pending_creates (
      id bigserial primary key,
      cohort_label text not null,
      cohort_type text not null default 'cohort',
      name text not null,
      mode text not null default 'create',
      sheet_id text not null default '',
      folder_id text not null default '',
      template_id text not null default '',
      sheet_title text not null default '',
      roster_sheet_id text not null default '',
      status text not null default 'pending',
      attempts int not null default 0,
      last_error text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (cohort_label, name)
    )`);
  await getDbPool().query(
    `create index if not exists cohort_pending_status on cohort_pending_creates (status)`,
  );
}

/**
 * pending 잡 적재 — (cohort_label, name) 자연키 upsert(멱등: 같은 기수·이름 재제출은 갱신).
 * 이미 done 인 행은 pending 으로 되돌리지 않는다(재완료 방지). 실패 카운터(attempts)는 보존.
 */
export async function enqueueCohortCreate(job: PendingCohortJob): Promise<void> {
  if (!dbEnabled()) throw new Error("[cohort-pending] DATABASE_URL 미설정 — pending 큐 불가");
  await ensureCohortPendingSchema();
  await getDbPool().query(
    `insert into cohort_pending_creates
       (cohort_label, name, cohort_type, mode, sheet_id, folder_id, template_id, sheet_title, roster_sheet_id, status, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending', now())
     on conflict (cohort_label, name) do update set
       cohort_type = excluded.cohort_type, mode = excluded.mode,
       sheet_id = excluded.sheet_id, folder_id = excluded.folder_id,
       template_id = excluded.template_id, sheet_title = excluded.sheet_title,
       roster_sheet_id = excluded.roster_sheet_id,
       status = case when cohort_pending_creates.status = 'done' then 'done' else 'pending' end,
       updated_at = now()`,
    [
      job.cohortLabel, job.name, job.cohortType, job.mode,
      job.sheetId, job.folderId, job.templateId, job.sheetTitle, job.rosterSheetId,
    ],
  );
}

function toRow(r: Record<string, unknown>): PendingCohortRow {
  return {
    id: Number(r.id),
    cohortLabel: String(r.cohort_label ?? ""),
    cohortType: String(r.cohort_type ?? "cohort"),
    name: String(r.name ?? ""),
    mode: String(r.mode ?? "create"),
    sheetId: String(r.sheet_id ?? ""),
    folderId: String(r.folder_id ?? ""),
    templateId: String(r.template_id ?? ""),
    sheetTitle: String(r.sheet_title ?? ""),
    rosterSheetId: String(r.roster_sheet_id ?? ""),
    status: (r.status as PendingCohortRow["status"]) ?? "pending",
    attempts: Number(r.attempts ?? 0),
    lastError: String(r.last_error ?? ""),
  };
}

/** status='pending' 잡 목록(오래된 순). limit 로 배치 크기 제한. */
export async function listPendingCohortCreates(limit = 100): Promise<PendingCohortRow[]> {
  if (!dbEnabled()) return [];
  await ensureCohortPendingSchema();
  const res = await getDbPool().query(
    `select * from cohort_pending_creates where status = 'pending' order by created_at asc limit $1`,
    [limit],
  );
  return res.rows.map(toRow);
}

/** 재시도 성공 → done(생성된 시트 id 기록). */
export async function markCohortCreateDone(id: number, sheetId: string): Promise<void> {
  if (!dbEnabled()) return;
  await getDbPool().query(
    `update cohort_pending_creates set status='done', sheet_id=$2, updated_at=now() where id=$1`,
    [id, sheetId],
  );
}

/** 재시도 실패 → attempts++ + last_error(상태는 pending 유지 → 다음 배치 재시도). */
export async function markCohortCreateFailed(id: number, error: string): Promise<void> {
  if (!dbEnabled()) return;
  await getDbPool().query(
    `update cohort_pending_creates set attempts = attempts + 1, last_error=$2, updated_at=now() where id=$1`,
    [id, error.slice(0, 500)],
  );
}

/** pending 잔량(admin 관찰성 — 드리프트 배너용). 미설정이면 null. */
export async function countPendingCohortCreates(): Promise<number | null> {
  if (!dbEnabled()) return null;
  await ensureCohortPendingSchema();
  const res = await getDbPool().query(
    `select count(*)::int as n from cohort_pending_creates where status='pending'`,
  );
  return res.rows[0]?.n ?? 0;
}
