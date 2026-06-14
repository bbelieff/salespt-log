/**
 * AdminUserPicker 공용 타입·헬퍼.
 *
 * 분리 이유 (2026-05-13):
 *   AdminUserPickerSections.tsx 와 TraineeCard.tsx 가 서로 import 하면 순환
 *   의존 → 빌드 시 일부 모듈이 undefined 로 평가됨 → 페이지 unstyled 사고.
 *   타입·순수 함수만 별도 모듈로 빼서 사이클 차단.
 */

export interface Trainee {
  email: string;
  cohort: string;
  name: string;
  spreadsheetId: string;
  role: string;
  assignedTrainer?: string;
  /** 기수 내 팀 (예: "서울", "부산"). 빈값 = 미배정. */
  team?: string;
  /** 아레나 회장이 맡은 cohort(예 "A1-1"). 빈값=일반. 그룹키·👑 마커용. */
  captainOf?: string;
  courseStartISO?: string;
  graduationISO?: string;
  /** 8주 누적 funnel (시트 01 영업관리!E4/E5/E6). admin/trainer 카드 표시용.
   *  enrichUsersWithStats 가 채움. spreadsheetId 없거나 fetch 실패 시 undefined. */
  stats?: { 미팅예정: number; 미팅완료: number; 계약: number };
}

export interface Trainer {
  email: string;
  name: string;
}

/** registry G 컬럼(assignedTrainer) 콤마 구분 트레이너 email 파싱. */
export function parseAssigned(field: string | undefined): string[] {
  if (!field) return [];
  return Array.from(
    new Set(
      field
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

/** "2026-04-10" → "26/04/10". 빈 값 → null. */
export function fmtDateYY(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-");
  return `${y!.slice(-2)}/${m}/${d}`;
}

/** 기수 진행률 (%) + D-day 계산. */
export function cohortProgress(
  startISO: string | undefined,
  endISO: string | undefined,
): { pct: number | null; dday: number | null } {
  if (!startISO || !endISO) return { pct: null, dday: null };
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return { pct: null, dday: null };
  }
  const now = Date.now();
  const totalMs = end - start;
  const elapsedMs = Math.max(0, Math.min(totalMs, now - start));
  const pct = Math.round((elapsedMs / totalMs) * 100);
  const dday = Math.ceil((end - now) / 86_400_000);
  return { pct, dday };
}
