/**
 * Layer: service — 미팅 삭제·되돌리기 cascade (04 미팅 ↔ 02 계약카드).
 *
 * `contact.ts` 가 500줄 캡에 닿아 분리했다(R3-3 잔여 PR — PR-1 리뷰 후속⑤가 예고한 split).
 * 공개 API 는 그대로 `@/service/contact` 에서 재수출되므로 라우트·기존 테스트 경로는 바뀌지 않는다.
 *
 * R3-3 잔여: 이 파일의 02 쓰기는 파일럿(화면=DB read)에서 **DB 동기 정본**이다 — `syncDbOf(ctx)` 게이트.
 * 미러 최종 실패가 "시트엔 없는데 DB엔 남은 유령 계약"으로 굳는 것을 막는다(read-your-writes).
 */
import {
  clearMeetingRecord,
  findChildMeetingRecord,
  getMeetingRecord,
  patchMeetingRecord,
  type MeetingCtx,
} from "./meetings-write";
import { clearRowByLink as clearContractPaymentByLink } from "@/repo/contract-payment";
import { persistMeetingReservationCount } from "./sales-write";
import { resolveCtx, syncDbOf } from "./contact";

/** 자손 미팅 transitive cascade (post-order). 자식 계약이면 02 row 도 clear. */
export async function cascadeDescendantMeetings(
  ctx: MeetingCtx,
  parentId: string,
): Promise<{ count: number; paymentRows: number }> {
  let count = 0;
  let paymentRows = 0;
  async function walk(pid: string): Promise<void> {
    const c = await findChildMeetingRecord(ctx, pid);
    if (!c) return;
    await walk(c.id);
    if (c.상태 === "계약" && c.미팅날짜 && c.업체명) {
      const row = await clearContractPaymentByLink(ctx.spreadsheetId, c.미팅날짜, c.업체명, {
        syncDb: syncDbOf(ctx),
      });
      if (row !== null) paymentRows++;
    }
    // 자손 gcal 은 R2 무호출(gcal-2b) 보존 — 파일럿은 수렴 잡 cleared 브랜치가 멱등 제거.
    await clearMeetingRecord(ctx, c.id, { gcalRemove: false });
    count++;
  }
  await walk(parentId);
  return { count, paymentRows };
}

/** 미팅 삭제 (행 클리어). 미팅예약 -1은 호출 측 책임. cascade 없음. */
export async function removeMeeting(email: string, id: string): Promise<void> {
  const ctx = await resolveCtx(email);
  await clearMeetingRecord(ctx, id, { gcalRemove: true }); // 클리어 전 구글 이벤트 삭제 포함
}

/** 미팅 + 자손 transitive cascade + 본인 계약 02 row cascade. L1 -1은 호출 측. */
export async function removeMeetingWithCascade(
  email: string,
  id: string,
): Promise<{
  cascade: string;
  removedPaymentRow: number | null;
  removedDescendantCount: number;
  업체명: string;
  미팅날짜: string;
  상태: string;
}> {
  const ctx = await resolveCtx(email);
  const spreadsheetId = ctx.spreadsheetId;
  const m = await getMeetingRecord(ctx, id);
  if (!m) throw new Error(`[removeMeetingWithCascade] 미팅 못 찾음: ${id}`);

  // 1) Descendants 재귀 삭제.
  const { count: descCount, paymentRows: descPaymentRows } =
    await cascadeDescendantMeetings(ctx, id);
  // 2) 본인이 계약이면 02 row cascade.
  let removedPaymentRow: number | null = null;
  if (m.상태 === "계약" && m.미팅날짜 && m.업체명) {
    removedPaymentRow = await clearContractPaymentByLink(spreadsheetId, m.미팅날짜, m.업체명, {
      syncDb: syncDbOf(ctx),
    });
  }
  // 3) 본인 clear(클리어 전 구글 이벤트 삭제 포함) + 4) 영업관리 H -1 (좌표 실패 시 skip).
  await clearMeetingRecord(ctx, id, { gcalRemove: true });
  if (m.예약일 && m.channel) {
    // R3⑤: 파일럿은 DB 정본에 **카드수 절대 재계산**(±1 RMW 폐기, ADR-0010) + 시트 수렴 미러.
    try { await persistMeetingReservationCount(ctx, m.예약일, m.channel); } catch { /* skip */ }
  }
  const parts: string[] = ["영업관리 H -1"];
  if (descCount > 0) parts.push(`자손 미팅 ${descCount}건 cascade`);
  if (descPaymentRows > 0) parts.push(`자손 계약 ${descPaymentRows}건`);
  if (removedPaymentRow !== null) parts.push(`본인 계약카드 삭제`);

  return {
    cascade: parts.join(", "),
    removedPaymentRow,
    removedDescendantCount: descCount,
    업체명: m.업체명,
    미팅날짜: m.미팅날짜,
    상태: m.상태,
  };
}

/**
 * 미팅 결과 되돌리기 (2026-05-17 [2a]). 계약→예약: 02 row clear.
 * 완료/취소→예약: 사유 초기화. 변경→예약: 자손 미팅 cascade 삭제.
 */
export async function revertMeeting(
  email: string,
  id: string,
): Promise<{ status: string; cascade: string }> {
  const ctx = await resolveCtx(email);
  const spreadsheetId = ctx.spreadsheetId;
  const m = await getMeetingRecord(ctx, id);
  if (!m) throw new Error(`[revert] 미팅 못 찾음: ${id}`);
  const prevState = m.상태;

  if (prevState === "계약") {
    await patchMeetingRecord(ctx, id, {
      상태: "예약",
      계약여부: false,
      수임비: 0,
      계약조건: "",
    }); // gcal 갱신 포함
    const clearedRow = await clearContractPaymentByLink(
      spreadsheetId,
      m.미팅날짜,
      m.업체명,
      { syncDb: syncDbOf(ctx) },
    );
    return {
      status: "예약",
      cascade:
        clearedRow !== null
          ? `02 계약수납관리 row ${clearedRow} clear`
          : "02 계약수납관리 매칭 row 없음 (이미 정리됨)",
    };
  }

  if (prevState === "완료" || prevState === "취소") {
    await patchMeetingRecord(ctx, id, {
      상태: "예약",
      계약여부: false,
      미팅사유: "",
    }); // 취소/완료→예약 → gcal 재등록/갱신 포함
    return { status: "예약", cascade: "사유 초기화" };
  }

  if (prevState === "변경") {
    // 2026-05-19: 손자까지 transitive cascade (1→2→3 체인 전부 삭제).
    const { count } = await cascadeDescendantMeetings(ctx, id);
    await patchMeetingRecord(ctx, id, { 상태: "예약", 미팅사유: "" }); // gcal 갱신 포함
    return {
      status: "예약",
      cascade: count > 0 ? `변경 자손 미팅 ${count}건 cascade 삭제` : "변경 자식 미팅 없음",
    };
  }

  // 이미 예약이거나 알 수 없는 상태 → 노옵
  return { status: prevState, cascade: "되돌릴 항목 없음" };
}

/**
 * 케이스 종료 되살리기 (2026-05-19).
 *
 * 완료/취소/계약 카드의 자식 추가미팅(previousMeetingId 매칭) 을 삭제하여
 * 케이스를 다시 진행 가능 상태로 복원. 부모 상태는 유지.
 * 자식이 계약 상태면 02 계약수납관리 row 도 cascade clear.
 */
export async function reviveCaseClosure(
  email: string,
  parentId: string,
): Promise<{ cascade: string; childId: string | null }> {
  const ctx = await resolveCtx(email);
  const child = await findChildMeetingRecord(ctx, parentId);
  if (!child) {
    return { cascade: "자식 미팅 없음 — 되살릴 항목 없음", childId: null };
  }
  // 2026-05-19: 자식의 자손까지 transitive cascade.
  const { count: descCount } = await cascadeDescendantMeetings(ctx, child.id);
  let cascade02 = "";
  if (child.상태 === "계약" && child.미팅날짜 && child.업체명) {
    const row = await clearContractPaymentByLink(ctx.spreadsheetId, child.미팅날짜, child.업체명, {
      syncDb: syncDbOf(ctx),
    });
    if (row !== null) cascade02 = ` + 02 row ${row}`;
  }
  await clearMeetingRecord(ctx, child.id, { gcalRemove: true }); // 이벤트 삭제(클리어 전) 포함
  const descMsg = descCount > 0 ? ` (자손 ${descCount}건 포함)` : "";
  return {
    cascade: `자식 미팅(${child.업체명}) 삭제${descMsg}${cascade02}`,
    childId: child.id,
  };
}
