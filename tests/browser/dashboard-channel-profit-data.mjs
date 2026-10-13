// C(#7 영업이익 상세 「채널별 남은 돈」) 목업 데이터 — dashboard-followups-server.mjs 가 쓴다.
// 대시보드 주소에 ?channels=… 를 붙이면(쿠키 channel_profit, dashboard-channel-profit-scenario.ts 가 적는다)
// 계약(/api/contract-payment)·DB 비용(/api/db)·원장(/api/expenses)·대시보드(/api/dashboard) 응답을 이 데이터로 바꾼다.
// 붙이지 않으면 null 을 돌려 A·B 목업 응답이 그대로다(대시보드 응답에 contractChannels 가 없어 표도 안 나온다).
//
//   ?channels=demo(기본, ?channels=1 도 같음) | empty | loss | large
//   플래그(=1, 같이 써도 됨): ledgerFail  원장 503 → 「추가 비용 · 확인 못 했어요」
//                             noChannels  응답에 contractChannels 없음(배포 직후 캐시) → 표·문장 없음
//                             staleChannels  방금 추가한 계약이 첫 응답에 없음 → 「확인 중…」 → 한 번 다시 불러와 풀림
//                             renamed     업체명 두 곳 변경: AK 있는 계약은 채널 유지, AK 없는 계약은 「확인 중」 → 다시 불러와 풀림
//                             stuck       다시 불러와도 옛 응답(「확인 못 함」 상태 확인용)
// 날짜는 요청마다 오늘(KST) 기준 오프셋 — 날짜 리터럴 없음. 업체명은 전부 「가상상사」.
// 채널 연결 규칙은 운영과 같다(lib/service/contract-channel.ts · lib/util/contract-link.ts contractChannelKey):
//   AK(linkedMeetingId) → 미팅 id, 없으면 계약일|업체명 첫 일치 미팅, manual: 은 미팅 없음.

const DATASETS = ["demo", "empty", "loss", "large"];
const FLAGS = ["ledgerFail", "noChannels", "staleChannels", "renamed", "stuck"];
const STALE_ROW = 69;

const shift = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const slot = (o = {}) => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...o });
const contract = (row, 업체명, 계약일, o = {}) => ({ row, 계약일, 업체명, 수임비: 0, 계약비고: "", 공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false, 사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slot(), 수납2: slot(), 수납3: slot(), 로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, linkedMeetingId: "", ...o });
const meeting = (id, 업체명, 미팅날짜, channel, o = {}) => ({ id, 예약일: shift(미팅날짜, -3), 예약시각: "10:00", 미팅날짜, 미팅시간: "14:00", channel, 업체명, 장소: "가상 카페", 예약비고: "", 상태: "계약", 계약여부: true, 수임비: 0, 미팅사유: "", 계약조건: "", ...o });

/** 운영 contractChannelKey 와 같은 키. */
const keyOf = (p) => { const ak = (p.linkedMeetingId ?? "").trim(); return ak ? `${p.row ?? ""}|ak:${ak}` : `${p.row ?? ""}|${p.계약일}|${p.업체명}`; };
/** 운영 contractMeetingResolver + contractChannels 와 같은 규칙. */
function contractChannels(rows, meetings) {
  const byId = new Map(meetings.map((m) => [m.id, m]));
  const byKey = new Map();
  for (const m of meetings) { const k = `${m.미팅날짜}|${m.업체명}`; if (!byKey.has(k)) byKey.set(k, m); }
  return rows.map((p) => {
    const ak = p.linkedMeetingId ?? "";
    const m = ak.trim().startsWith("manual:") ? undefined : (ak ? byId.get(ak) : undefined) ?? byKey.get(`${p.계약일}|${p.업체명}`);
    return { key: keyOf(p), channel: m?.channel ?? null };
  });
}

/**
 * demo — 기대값(「전체」): 매출 18,600,000 · DB 비용 8,700,000 + 추가 비용 600,000 = 9,300,000 · 영업이익 9,300,000.
 * 채널 남은 돈: 매입DB −50만(해지 반환 포함) · 직접생산 −200만 · 현수막 530만(이월 포함) · 콜·지·기·소 550만,
 * 영업기록 없음 120만(manual) · 채널 모름 40만(AK 빈 값). 문장: 「현수막에 쓴 돈의 3.4배를 벌었어요」.
 * large = 금액 ×10 + 매입DB 구매 1.3억(1억 넘는 칸·−9,500만 칸 폭 확인), loss = 현수막 주문이 커서 모든 채널 적자.
 */
function dataset(name, t) {
  if (name === "empty") return { meetings: [], rows: [], db: { purchases: [], productions: [], banners: [], leads: [] }, ledger: [] };
  const k = name === "large" ? 10 : 1;
  const won = (n) => n * k;
  const meetings = [
    meeting("mtg-c-banner-a", "가상상사A", shift(t, -3), "현수막"),
    meeting("mtg-c-banner-b", "가상상사B", shift(t, -20), "현수막"),
    meeting("mtg-c-db-c", "가상상사C", shift(t, -15), "매입DB"),
    meeting("mtg-c-prod-d", "가상상사D", shift(t, -35), "직접생산"),
    meeting("mtg-c-call-e", "가상상사E", shift(t, -10), "콜·지·기·소"),
    meeting("mtg-c-db-g", "가상상사G", shift(t, -25), "매입DB"),
    meeting("mtg-c-banner-h", "가상상사H", shift(t, -60), "현수막", { 구분: "이월" }),
    meeting("mtg-c-db-j", "가상상사J", t, "매입DB"),
  ];
  const rows = [
    contract(60, "가상상사A", shift(t, -3), { linkedMeetingId: "mtg-c-banner-a", 수임비: won(3_000_000), 수납1: slot({ 진행기관: "신용보증기금", 수납액: won(2_000_000), 수납일: t }) }),
    contract(61, "가상상사B", shift(t, -20), { linkedMeetingId: "mtg-c-banner-b", 수임비: won(1_000_000) }),
    contract(62, "가상상사C", shift(t, -15), { linkedMeetingId: "mtg-c-db-c", 수임비: won(2_000_000), 수납1: slot({ 진행기관: "소진공", 수납액: won(1_500_000), 수납일: shift(t, -3) }) }),
    contract(63, "가상상사D", shift(t, -35), { linkedMeetingId: "mtg-c-prod-d", 수임비: won(500_000) }),
    // AK 없이 계약일|업체명 으로 미팅을 찾는 계약(2차 규칙).
    contract(64, "가상상사E", shift(t, -10), { 수임비: won(2_500_000), 수납1: slot({ 진행기관: "기술보증기금", 수납액: won(3_000_000), 수납일: shift(t, -2) }) }),
    // 「영업기록 없이 추가」 → 영업기록 없음 › (/payment 에서 연결).
    contract(65, "가상상사F", shift(t, -5), { linkedMeetingId: "manual:fixture-c-1", 수임비: won(1_200_000) }),
    // 해지 — 반환은 해지일 기준으로 그 채널(매입DB)에서 뺀다.
    contract(66, "가상상사G", shift(t, -25), { linkedMeetingId: "mtg-c-db-g", 수임비: won(800_000), 반환액: won(800_000), 해지일: shift(t, -4), 해지사유: "가상 사유" }),
    // 이월 계약도 기간으로만 본다(ADR-0034).
    contract(67, "가상상사H", shift(t, -60), { 구분: "이월", linkedMeetingId: "mtg-c-banner-h", 수임비: won(1_000_000), 수납1: slot({ 진행기관: "중진공", 수납액: won(500_000), 수납일: shift(t, -6) }) }),
    // 이전 계약 직접등록(AK 빈 값·미팅 없음) → 채널 모름(연결 링크 없음).
    contract(68, "가상상사I", shift(t, -45), { 수임비: won(400_000) }),
  ];
  const purchases = name === "large"
    ? [{ 구매일: shift(t, -16), 주문금액: 120_000_000 }, { 구매일: shift(t, -50), 주문금액: 10_000_000 }]
    : [{ 구매일: shift(t, -16), 주문금액: won(3_000_000) }, { 구매일: shift(t, -50), 주문금액: won(1_000_000) }];
  const banners = name === "loss"
    ? [{ 날짜: shift(t, -21), 주문금액: 9_000_000 }, { 날짜: shift(t, -2), 주문금액: 400_000 }]
    : [{ 날짜: shift(t, -21), 주문금액: won(1_800_000) }, { 날짜: shift(t, -2), 주문금액: won(400_000) }];
  const db = { purchases, productions: [{ 시작일: shift(t, -30), 기간예산: won(2_500_000) }], banners, leads: [] };
  const ledger = [
    { id: "exp-c-1", categoryId: "cat-c-ad", categoryName: "광고비", itemName: "가상 전단지", source: "one_time", amountWon: won(500_000), periodStart: shift(t, -9), periodEnd: t },
    { id: "exp-c-2", categoryId: "cat-c-tel", categoryName: "통신비", itemName: "가상 회선", source: "recurring", amountWon: won(100_000), periodStart: shift(t, -3), periodEnd: shift(t, -3) },
  ];
  return { meetings, rows, db, ledger };
}

/** 「방금 바뀐」 계약 — staleChannels: 오늘 새 계약 1건, renamed: AK 있는 계약·없는 계약 이름 변경. */
function served(base, flags, t) {
  let rows = base.rows;
  if (flags.has("renamed")) rows = rows.map((r) => (r.row === 62 ? { ...r, 업체명: "가상상사C(주)" } : r.row === 68 ? { ...r, 업체명: "가상상사I(변경)" } : r));
  if (flags.has("staleChannels") && base.rows.length > 0) rows = [...rows, contract(STALE_ROW, "가상상사J", t, { linkedMeetingId: "mtg-c-db-j", 수임비: 700_000 })];
  return rows;
}

const dashboardCalls = new Map(); // 쪽 열기(load id)마다 /api/dashboard 몇 번째 요청인지

const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);

/** dashboard-followups-server 가 요청마다 부른다. C 시나리오가 아니면 null(다른 목업 응답 그대로). */
export function channelProfitRoute(req, path, cookieOf, t) {
  const asked = cookieOf(req, "channel_profit");
  if (!asked || !DATASETS.includes(asked)) return null;
  const flags = new Set((cookieOf(req, "channel_profit_flags") ?? "").split(".").filter((f) => FLAGS.includes(f)));
  const base = dataset(asked, t);
  const rows = served(base, flags, t);
  const ledgerFail = flags.has("ledgerFail");

  if (path === "/api/contract-payment" && req.method === "GET") return { body: { rows } };
  if (path === "/api/db") return { body: base.db };
  if (path === "/api/expenses" && req.method === "GET") {
    if (ledgerFail) return { status: 503, body: { error: "경비장부를 불러오지 못했어요(합성 실패)." } };
    return { body: { view: "all", month: t.slice(0, 7), categories: [], entries: base.ledger, rules: [], categoryTotals: [], additionalCostTotal: sum(base.ledger, (e) => e.amountWon) } };
  }
  if (path !== "/api/dashboard") return null;

  const load = cookieOf(req, "channel_profit_load") ?? "-";
  const call = (dashboardCalls.get(load) ?? 0) + 1;
  dashboardCalls.set(load, call);
  const stale = flags.has("stuck") || call === 1;
  // 옛 응답 = 이름 바꾸기 전·새 계약 추가 전 행(base.rows)으로 만든 contractChannels.
  const channelRows = stale ? base.rows : rows;
  const courseStart = shift(t, -45);
  const season = (list, date, amount) => sum(list.filter((x) => x[date] >= courseStart), (x) => x[amount]);
  const costBreakdown = [
    { 채널: "매입DB", 비용: season(base.db.purchases, "구매일", "주문금액") },
    { 채널: "직접생산", 비용: season(base.db.productions, "시작일", "기간예산") },
    { 채널: "현수막", 비용: season(base.db.banners, "날짜", "주문금액") },
  ];
  const dbCostTotal = sum(costBreakdown, (c) => c.비용);
  const additional = sum(base.ledger, (e) => e.amountWon);
  const empty = base.rows.length === 0;
  const m = (채널, 생산, 유입, 컨택진행, 미팅예약, 미팅완료, 계약) => ({ 채널, 생산, 유입, 컨택진행, 미팅예약, 미팅완료, 계약 });
  return { body: {
    kpi: { 영업이익: 0, 영업이익률: 0, 총매출: 0, 총비용: 0, 누적수임비: 0, 수임비합: 0, 수수료합: 0, 이월매출: 0, 전체매출: 0, 이월비용: 0, 전체비용: 0 },
    additionalCost: ledgerFail
      ? { status: "unavailable", dbCostTotal, additionalCost: null, recognizedThrough: t, errorCode: "expense_ledger_read_failed" }
      : { status: "available", dbCostTotal, additionalCost: additional, recognizedThrough: t },
    channelMatrix: empty
      ? ["매입DB", "직접생산", "현수막", "콜·지·기·소"].map((c) => m(c, 0, 0, 0, 0, 0, 0))
      : [m("매입DB", 40, 30, 18, 6, 4, 2), m("직접생산", 25, 12, 8, 3, 2, 1), m("현수막", 10, 9, 6, 4, 3, 3), m("콜·지·기·소", 5, 5, 4, 2, 2, 1)],
    weeklyTrend: Array.from({ length: 8 }, (_, i) => ({ 주차: i + 1, 계약수: empty ? 0 : [0, 1, 1, 2, 1, 2, 0, 0][i], 활동량: empty ? 0 : [12, 18, 22, 15, 20, 24, 9, 0][i] })),
    costBreakdown,
    콜지기소수임비: 0,
    ...(flags.has("noChannels") ? {} : { contractChannels: contractChannels(channelRows, base.meetings) }),
  } };
}
