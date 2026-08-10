/**
 * Diff 원인 자동분류 — parity 스크립트(dashboard-parity·scoreboard-parity·registry-parity)
 * 공용 모듈. 순수 함수만(I/O 없음) — 각 스크립트가 자기 데이터를 정해진 형태로 넘겨 호출한다.
 *
 * belie 지시(2026-08-10, BBE-66 실측 — 손분류에 카드 하나당 4일): "지금 세션들이 diff 를
 * 손으로 분류하느라 시간을 쓴다. 유형별 건수 + 샘플 3건 + '진짜 불일치'만 목록으로 뽑아라."
 *
 * 4개 분류축(belie 가 실측으로 이미 확인한 원인들):
 *   ① 시차     — 백필 이후 시트에 쌓인 신규 행(= 그 행 자체가 DB 에 아예 없음).
 *   ② 렌더옵션 — SERIAL_NUMBER vs FORMATTED_STRING(#752 — 날짜 셀이 raw 숫자로 샘).
 *   ③ 로직차이 — 이월 포함/제외, 계약여부 vs 상태 등 계산식 자체가 다름(대안식 재계산이 sheet 와 일치).
 *   ④ 진짜불일치 — 위 어디에도 안 걸리는 것. 이것만 사람이 본다.
 *
 * 판정 순서는 위 번호 순(먼저 걸리는 것으로 확정) — ①②③ 다 아니면 ④.
 */

/** 시트 날짜 셀 값이 렌더옵션 사고로 raw serial 로 샜는지 판별(#752 패턴).
 * Sheets serial epoch=1899-12-30, 대략 20000~60000 = 서기 1954~2064 — 실사용 범위로 안전. */
export function looksLikeUnrenderedSerial(v) {
  if (typeof v !== "string") return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return false; // 이미 ISO 문자열
  const n = Number(v);
  return Number.isFinite(n) && n >= 20000 && n <= 60000;
}

export function serialToISO(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return new Date((n - 25569) * 86400000).toISOString().slice(0, 10);
}

/** 필드명이 날짜류인지(휴리스틱 — "날짜"·"일"로 끝남). 오탐 방지로 "수임비" 등은 제외. */
const DATE_FIELD_RE = /(날짜|_iso|계약일)$/;

/**
 * 한 diff 항목을 분류한다.
 *
 * @param {{field: string, sheetValue: unknown, dbValue: unknown}} d
 * @param {object} ctx
 * @param {Record<string, unknown>[]} [ctx.contributingDbRows] - 이 필드 계산에 실제로 쓰인
 *   DB row(payload 형태) 목록. 날짜 필드 스캔 범위를 그 필드에 진짜 관련된 행으로 좁혀 오탐을 줄인다.
 * @param {{name: string, recompute: (rows: Record<string, unknown>[]) => unknown}[]} [ctx.alternates]
 *   "로직차이" 후보 — 대안 계산식 목록. recompute(contributingDbRows) 결과가 sheetValue 와
 *   같으면 그 대안이 근인이라고 판정.
 * @param {unknown} [ctx.sheetRowRecount] - 같은 필드를 시트 **row 데이터**(수식이 아니라 원본 행)
 *   로 똑같은 로직으로 재계산한 값. 시트 수식값과 일치하는데 DB 재계산과는 다르면, 격차는
 *   "그 행이 DB 에 아예 없다"는 뜻 — 시차로 판정.
 */
export function classifyDiff(d, ctx = {}) {
  const contributingDbRows = ctx.contributingDbRows ?? [];
  const alternates = ctx.alternates ?? [];

  // ① 렌더옵션 — 이 필드에 기여한 DB row 중 날짜류 필드가 raw serial 로 보이는 게 있는가.
  for (const row of contributingDbRows) {
    for (const [k, v] of Object.entries(row)) {
      if (DATE_FIELD_RE.test(k) && looksLikeUnrenderedSerial(v)) {
        return {
          type: "렌더옵션",
          detail: `DB row 의 "${k}" 필드가 미변환 시트 serial 로 보임(값="${v}", 변환 시 ${serialToISO(v)}) — dateTimeRenderOption 확인 필요`,
        };
      }
    }
  }

  // ② 로직차이 — 대안 계산식이 sheet 값과 일치하면 그 식이 근인.
  for (const alt of alternates) {
    let v;
    try {
      v = alt.recompute(contributingDbRows);
    } catch {
      continue;
    }
    if (v !== undefined && v === d.sheetValue) {
      return { type: "로직차이", detail: `대안식 "${alt.name}" 로 재계산하면 sheet 와 일치(=${v}) — 그 계산식이 근인 후보` };
    }
  }

  // ③ 시차 — 시트 row 재계산(=수식과 일치)과 DB row 재계산이 다르면, DB 에 없는 행이 있다는 뜻.
  if (
    ctx.sheetRowRecount !== undefined &&
    ctx.sheetRowRecount === d.sheetValue &&
    ctx.sheetRowRecount !== d.dbValue
  ) {
    return {
      type: "시차",
      detail: `시트 원본 행 재계산(${ctx.sheetRowRecount})은 시트 수식값과 일치하는데 DB 행 재계산(${d.dbValue})과는 다름 — DB 에 없는 행이 있음(백필 이후 신규 행 추정)`,
    };
  }

  // ④ 진짜불일치
  return { type: "진짜불일치", detail: "시차·렌더옵션·로직차이 어디에도 안 걸림 — 직접 조사 필요" };
}

const TYPE_ORDER = ["시차", "렌더옵션", "로직차이", "진짜불일치"];

/**
 * classifyDiff 결과들을 belie 가 요청한 출력 형태로 정리한다:
 * "유형별 건수 + 각 유형 샘플 3건 + '진짜 불일치'만 따로 목록".
 *
 * @param {{user: string, field: string, sheetValue: unknown, dbValue: unknown, type: string, detail: string}[]} items
 */
export function summarizeClassification(items) {
  const byType = new Map(TYPE_ORDER.map((t) => [t, []]));
  for (const it of items) {
    if (!byType.has(it.type)) byType.set(it.type, []); // 방어 — 알 수 없는 타입도 유실 없이 담음
    byType.get(it.type).push(it);
  }
  const counts = Object.fromEntries([...byType].map(([k, v]) => [k, v.length]));
  const real = byType.get("진짜불일치") ?? [];

  const lines = [];
  lines.push(`\n═══ diff 원인 분류 (총 ${items.length}건) ═══`);
  for (const type of byType.keys()) {
    const list = byType.get(type);
    if (list.length === 0 && !TYPE_ORDER.includes(type)) continue;
    lines.push(`\n[${type}] ${list.length}건`);
    for (const s of list.slice(0, 3)) {
      lines.push(`  · ${s.user} ${s.field}: sheet=${s.sheetValue} db=${s.dbValue}`);
      lines.push(`    ↳ ${s.detail}`);
    }
    if (list.length > 3) lines.push(`  … 외 ${list.length - 3}건`);
  }
  lines.push(`\n═══ "진짜 불일치"만 전체 목록 (${real.length}건) — 이것만 사람이 조사 ═══`);
  if (real.length === 0) lines.push("  (없음 — 전부 알려진 원인으로 설명됨)");
  for (const s of real) lines.push(`  · ${s.user} ${s.field}: sheet=${s.sheetValue} db=${s.dbValue}`);

  return { counts, real, text: lines.join("\n") };
}
