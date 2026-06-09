/**
 * Layer: service — 아레나 명단 원문 파서 (순수, I/O 없음).
 *
 * 관리자가 붙여넣는 원문을 참가자 목록으로 변환한다. 줄 단위 스캔:
 *   - 시즌: 첫 `A{n}` 토큰 (없으면 fallbackSeason). "A1 / 1기 …" 의 선두 A1 도 흡수.
 *   - 기수 헤더: `N기` 로 시작하는 줄 → 현재 자기기수 = N. 그 줄 뒤에 이름이 붙어
 *     있으면(`1기 김지훈*, 김소라`) 그 줄도 명단으로 처리.
 *   - 그 외 줄 = 현재 기수의 명단. 콤마/탭 분리, trim, 빈값 제거.
 *   - 마커: `*`=회장, `$`=입금 → 이름에서 제거(접두/접미 무관).
 *   - 괄호 `(…)` = 부부 → 표시이름에 그대로 보존("류서하(심나영)").
 *   - 동명이인은 (기수, 이름) 키로 구분 — 같은 기수 내 완전 중복만 1회로 dedupe.
 */

export interface ArenaParticipant {
  gisu: number;
  displayName: string; // "류서하(심나영)" / "김지훈"
  isPresident: boolean; // *
  isDeposit: boolean; // $
}

export interface ArenaParseResult {
  season: number;
  participants: ArenaParticipant[];
  errors: string[];
}

const SEASON_TOKEN = /A\s*(\d+)/i;
// 기수 헤더: 줄 선두의 "N기" + (선택) 나머지 명단.
const GISU_HEADER = /^(\d+)\s*기\s*(.*)$/;
// 줄 선두의 시즌 표기 "A1", "A1 /", "A1:" 제거용.
const SEASON_PREFIX = /^A\s*\d+\s*[/:]?\s*/i;

/** 토큰 1개 → 참가자(기수는 호출부가 채움). 마커 추출 후 빈 이름이면 null. */
function parseToken(raw: string): Omit<ArenaParticipant, "gisu"> | null {
  const isPresident = raw.includes("*");
  const isDeposit = raw.includes("$");
  const displayName = raw.replace(/[*$]/g, "").trim();
  if (!displayName) return null;
  return { displayName, isPresident, isDeposit };
}

export function parseArenaRoster(
  text: string,
  fallbackSeason: number,
): ArenaParseResult {
  const errors: string[] = [];
  let season = fallbackSeason;
  const sm = text.match(SEASON_TOKEN);
  if (sm) season = Number(sm[1]);

  const participants: ArenaParticipant[] = [];
  const seen = new Set<string>(); // `${gisu}|${displayName}`
  let curGisu: number | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(SEASON_PREFIX, "").trim(); // 선두 A1 제거
    if (!line) continue; // 시즌 단독 라인

    let nameChunk = line;
    const gm = line.match(GISU_HEADER);
    if (gm) {
      curGisu = Number(gm[1]);
      nameChunk = (gm[2] ?? "").trim();
      if (!nameChunk) continue; // 헤더만 있는 줄
    }
    if (curGisu === null) {
      errors.push(`기수 미지정 상태의 이름 줄: "${line}"`);
      continue;
    }
    for (const tok of nameChunk.split(/[,\t]/)) {
      const t = tok.trim();
      if (!t) continue;
      const p = parseToken(t);
      if (!p) continue;
      const key = `${curGisu}|${p.displayName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      participants.push({ gisu: curGisu, ...p });
    }
  }

  return { season, participants, errors };
}

/** 참가자 → 레지스트리 메모(Q) 문자열. "회장"/"입금"/"회장,입금"/"". */
export function participantMemo(p: {
  isPresident: boolean;
  isDeposit: boolean;
}): string {
  return [p.isPresident ? "회장" : "", p.isDeposit ? "입금" : ""]
    .filter(Boolean)
    .join(",");
}
