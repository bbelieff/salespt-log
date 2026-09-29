/**
 * Layer: service — 「영업기록 없이 추가」 업체(02 AK=manual:…)를 영업기록 미팅(04)에 연결(belie 2026-09-29).
 *
 * 양방향 진입: ① 일정·계약에서 미팅을 계약으로 바꿀 때 같은 이름의 수동 업체가 있으면 연결 제안,
 * ② 실무/수납 1뎁스의 「영업기록 없음」 을 눌러 미팅을 고른다. 둘 다 이 서비스 하나를 쓴다.
 *
 * 연결하면: 02 행의 계약일 = 미팅 날짜(앱의 계약일 규칙), AK = 미팅 id, 업체명·수임비 = 고른 값.
 * 미팅은 상태 계약·수임비·업체명·업체정보(합친 값)로. 계약일|업체명 으로 묶인 할일·업체정보(06)는
 * 새 키로 옮긴다 — 안 옮기면 할일·업체정보가 사라진 것처럼 보인다.
 * 값 충돌은 화면(MeetingLinkDialog)이 "최근 저장 쪽" 을 기본으로 고르게 하고, 이 서비스는 받은 값만 쓴다.
 * 행은 새로 만들지 않는다 — 매출 이중계상 방지(#558 교훈).
 */
import type { CompanyInfo, ContractPayment, Meeting } from "@/types";
import { CompanyInfo as CompanyInfoSchema } from "@/types";
import { isManualContractLink } from "@/util/contract-link";
import { relinkContractRow } from "@/repo/contract-payment";
import {
  companyContractRef,
  readCompanyInfoArchiveRow,
  renameCompanyInfoKey,
  upsertCompanyInfoArchive,
} from "@/repo/company-info-archive";
import { readCompanyInfoFromDb, readContractsFromDb } from "@/repo/db/read-daily";
import { persistCompanyArchiveRename } from "@/repo/db/company-archive-sync";
import { readRowsUpdatedAt } from "@/repo/db/row-updated-at";
import { getMeetingRecord, listAllMeetingsRecord, patchMeetingRecord } from "./meetings-write";
import { loadContractPayments, resolveSheetWithSyncDb } from "./contract-payment";
import { listTodos, patchTodo } from "./todos";

export class ContractLinkError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type LinkableMeeting = Pick<Meeting, "id" | "미팅날짜" | "업체명" | "상태" | "수임비" | "channel">;

export interface MeetingLinkPreview {
  contract: { row: number; 계약일: string; 업체명: string; 수임비: number; 업체정보: CompanyInfo | null };
  meeting: { id: string; 미팅날짜: string; 업체명: string; 상태: string; 수임비: number; 업체정보: CompanyInfo | null };
  /** 마지막 저장 시각(ISO) — 모르면 null. contractInfo = 06 업체정보, contract = 02 행. */
  updatedAt: { contract: string | null; contractInfo: string | null; meeting: string | null };
}

/**
 * 계약 행 전체 — DB 기수는 DB 만 읽는다(시트 읽기 0). 2026-09-29 운영 확인에서 비교 팝업이 Sheets 분당
 * 읽기 한도(프로젝트 공용)에 걸려 실패했다. 찾는 행이 DB 에 없을 때만(append 미러 누락) 시트 합본으로 한 번 더.
 */
async function contractRows(email: string, spreadsheetId: string, syncDb: boolean, row?: number): Promise<ContractPayment[]> {
  if (syncDb) {
    try {
      const rows = await readContractsFromDb(spreadsheetId);
      if (row === undefined || rows.some((c) => c.row === row)) return rows;
    } catch {
      // DB 읽기 실패 — 아래 기존 경로
    }
  }
  return loadContractPayments(email);
}

/** 06 업체정보 — DB 기수는 DB 만(시트·미팅 fallback 없음: 수동 업체는 미팅이 없다). */
async function contractCompanyInfo(spreadsheetId: string, syncDb: boolean, 계약일: string, 업체명: string): Promise<CompanyInfo | null> {
  return syncDb ? readCompanyInfoFromDb(spreadsheetId, 계약일, 업체명) : readCompanyInfoArchiveRow(spreadsheetId, 계약일, 업체명);
}

function manualRow(rows: ContractPayment[], row: number): ContractPayment {
  const cp = rows.find((c) => c.row === row);
  if (!cp) throw new ContractLinkError("업체를 찾지 못했어요. 새로고침 후 다시 해 주세요.", 404);
  if (!isManualContractLink(cp.linkedMeetingId)) {
    throw new ContractLinkError("이미 영업기록과 연결된 업체예요.", 409);
  }
  return cp;
}

/** 다른 계약 행에 이미 연결된 미팅 id 모음. */
function linkedIds(rows: ContractPayment[]): Set<string> {
  return new Set(rows.map((c) => c.linkedMeetingId ?? "").filter((id) => id && !isManualContractLink(id)));
}

/** 연결할 수 있는 미팅 — 취소 제외, 다른 계약에 이미 붙은 미팅 제외. 최근 미팅날짜 순. */
export async function listLinkableMeetings(email: string): Promise<LinkableMeeting[]> {
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);
  const [meetings, rows] = await Promise.all([listAllMeetingsRecord(ctx), contractRows(email, spreadsheetId, syncDb)]);
  const taken = linkedIds(rows);
  return meetings
    .filter((m) => m.상태 !== "취소" && !taken.has(m.id) && m.업체명.trim())
    .sort((a, b) => b.미팅날짜.localeCompare(a.미팅날짜))
    .map((m) => ({ id: m.id, 미팅날짜: m.미팅날짜, 업체명: m.업체명, 상태: m.상태, 수임비: m.수임비, channel: m.channel }));
}

/** 연결 전 비교 자료 — 두 쪽의 값과 마지막 저장 시각. */
export async function previewMeetingLink(email: string, row: number, meetingId: string): Promise<MeetingLinkPreview> {
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);
  const cp = manualRow(await contractRows(email, spreadsheetId, syncDb, row), row);
  const meeting = await getMeetingRecord(ctx, meetingId);
  if (!meeting) throw new ContractLinkError("미팅을 찾지 못했어요.", 404);
  const [contractInfo, stamps] = await Promise.all([
    contractCompanyInfo(spreadsheetId, syncDb, cp.계약일, cp.업체명),
    readRowsUpdatedAt(spreadsheetId, [
      { tab: "contracts", rowKey: `r${row}` },
      { tab: "company_archive", rowKey: companyContractRef(cp.계약일, cp.업체명) },
      { tab: "meetings", rowKey: meetingId },
    ]).catch(() => ({}) as Record<string, string>),
  ]);
  return {
    contract: { row, 계약일: cp.계약일, 업체명: cp.업체명, 수임비: cp.수임비, 업체정보: contractInfo },
    meeting: {
      id: meeting.id, 미팅날짜: meeting.미팅날짜, 업체명: meeting.업체명, 상태: meeting.상태,
      수임비: meeting.수임비, 업체정보: meeting.업체정보 ?? null,
    },
    updatedAt: {
      contract: stamps[`contracts:r${row}`] ?? null,
      contractInfo: stamps[`company_archive:${companyContractRef(cp.계약일, cp.업체명)}`] ?? null,
      meeting: stamps[`meetings:${meetingId}`] ?? null,
    },
  };
}

export interface LinkInput {
  row: number;
  meetingId: string;
  업체명: string;
  수임비: number;
  업체정보: unknown;
}

/** 연결 실행. 02 행 → 미팅 → 06 업체정보 → 할일 순. 02·미팅 실패는 throw, 06·할일 실패는 failures 로 알린다. */
export async function linkMeetingToContract(email: string, input: LinkInput): Promise<{ row: number; failures: string[] }> {
  const { spreadsheetId, syncDb, ctx } = await resolveSheetWithSyncDb(email);
  const rows = await contractRows(email, spreadsheetId, syncDb, input.row);
  const cp = manualRow(rows, input.row);
  const meeting = await getMeetingRecord(ctx, input.meetingId);
  if (!meeting) throw new ContractLinkError("미팅을 찾지 못했어요.", 404);
  if (linkedIds(rows).has(meeting.id)) throw new ContractLinkError("이 미팅은 이미 다른 업체와 연결돼 있어요.", 409);
  const 업체명 = input.업체명.trim();
  if (!업체명) throw new ContractLinkError("업체명을 골라 주세요.");
  if (!meeting.미팅날짜) throw new ContractLinkError("미팅 날짜가 없는 미팅은 연결할 수 없어요.");
  const 수임비 = Math.max(0, Math.round(input.수임비));
  const 업체정보 = CompanyInfoSchema.parse(input.업체정보 ?? {});
  const 계약일 = meeting.미팅날짜;
  const failures: string[] = [];

  await relinkContractRow(
    spreadsheetId,
    input.row,
    { 계약일, 업체명, 수임비, meetingId: meeting.id, 이월원본행id: meeting.구분 === "이월" ? meeting.이월원본행id || meeting.id : undefined },
    { syncDb },
  );
  await patchMeetingRecord(ctx, meeting.id, { 상태: "계약", 계약여부: true, 수임비, 업체명, 업체정보 });

  const oldKey = { 계약일: cp.계약일, 업체명: cp.업체명 };
  const next = { 계약일, 업체명 };
  try {
    if (companyContractRef(oldKey.계약일, oldKey.업체명) !== companyContractRef(계약일, 업체명)) {
      const { moved } = await renameCompanyInfoKey(spreadsheetId, oldKey, next, { syncDb });
      // 시트에 옛 행이 아직 없어도(DB 정본만) 옛 DB 키는 지워 둔다 — 같은 업체가 두 번 보이지 않게.
      if (!moved && syncDb) {
        await persistCompanyArchiveRename(
          spreadsheetId,
          companyContractRef(oldKey.계약일, oldKey.업체명),
          { rowKey: companyContractRef(계약일, 업체명), payload: { _cleared: false, 업체명, 계약일 } },
          { syncDb },
        );
      }
    }
    await upsertCompanyInfoArchive(spreadsheetId, { 업체명, 계약일, 업체정보 }, { syncDb });
  } catch {
    failures.push("업체정보");
  }

  try {
    const oldRefs = new Set([`${cp.계약일}|${cp.업체명}`, companyContractRef(cp.계약일, cp.업체명)]);
    const newRef = companyContractRef(계약일, 업체명);
    const todos = (await Promise.all([...oldRefs].map((r) => listTodos(email, r)))).flat();
    const seen = new Set<string>();
    for (const t of todos) {
      if (seen.has(t.id) || t.contractRef === newRef) continue;
      seen.add(t.id);
      await patchTodo(email, t.id, { contractRef: newRef, 업체명 });
    }
  } catch {
    failures.push("할일·History");
  }
  return { row: input.row, failures };
}
