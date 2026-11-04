/**
 * 표준산업분류(KSIC 11차) 추천 — 사업자등록증의 업태·종목 글 → 세세분류 5자리 후보 (belie 2026-11-04 「MSC 벤치마킹」).
 * 원본: MSC report `tools/doc-parsers.js` suggestKsic/searchKsic 를 TypeScript 로 옮겼다(점수 규칙 그대로).
 * 데이터: lib/config/ksic11.json (통계청 11차 분류체계 xlsx·해설서 「예시」 낱말, 1,205항목) — 호출하는 쪽이 넘긴다
 * (화면은 동적 import 로 필요할 때만 받는다). 외부 호출 없음. 순수 — import 0(@/util 레이어 규칙).
 *
 * 점수(항목마다): 종목 낱말이 이름·예시 낱말과 통째로 같으면 4, 이름 글자 일부 2.5, 예시 2, 설명 0.8 × 낱말 무게
 * (흔한 낱말 0.3 · 한 글자 0.6 · 그 밖 길이/2, 최대 2). 붙여 쓴 말은 두 글자 조각이 절반 이상 겹치면 6×겹침².
 * 이름이 종목과 같으면 +6. 업태는 점수를 더하지 않고 대분류 배수만(맞으면 ×1.6, 아니면 ×0.6; 도매/소매 46·47 선호).
 */

/** [코드5, 이름, 대분류 글자, 예시 낱말, 설명] */
export type KsicItem = [string, string, string, string, string];
export interface KsicData {
  v?: string;
  sec: Record<string, string>;
  mid: Record<string, string>;
  items: KsicItem[];
}
export interface KsicHit {
  code: string;
  name: string;
  section: string;
  sectionName: string;
  midName: string;
  score: number;
  hits: string[];
}

const despace = (s: unknown) => String(s ?? "").replace(/\s+/g, "");

const UPTAE_SEC: [RegExp, string][] = [
  [/농업|임업|어업|축산|재배|양식/, "A"], [/광업|채석|채굴/, "B"], [/제조|가공/, "C"], [/전기|가스|증기/, "D"],
  [/수도|하수|폐기물|환경|재활용|원료재생/, "E"], [/건설|공사/, "F"], [/도매|소매|도소매|상품중개|판매업/, "G"],
  [/운수|운송|창고|택배|물류|보관/, "H"], [/숙박|음식|주점|요식/, "I"], [/정보통신|출판|방송|통신|소프트웨어|컴퓨터프로그래밍/, "J"],
  [/금융|보험/, "K"], [/부동산/, "L"], [/전문|과학|기술서비스|연구|엔지니어링/, "M"], [/사업시설|사업지원|임대업|인력공급/, "N"],
  [/교육/, "P"], [/보건|의료|사회복지/, "Q"], [/예술|스포츠|여가|오락/, "R"], [/협회|수리|개인서비스|미용|세탁/, "S"],
];
// 흔해서 구분력이 약한 낱말은 가볍게
const KSIC_WEAK = /^(운영|판매|서비스|제조|도매|소매|기타|일반|전문|용품|제품|사업|대행|관련|생산|가공|공급|개발|업무|설치|임대|수리)$/;
const KSIC_WEAK_BI = new Set(["제조", "조업", "도매", "매업", "소매", "판매", "서비", "비스", "스업", "기타", "운영", "영업", "사업"]);
// 현장에서 흔히 쓰는 말 → 분류표 말(분류표에 없는 생활 낱말 보충)
const KSIC_ALIAS: [RegExp, string][] = [
  [/인테리어|실내\s*건축/, " 실내장식 내장 목공사"], [/꽃집|꽃\s*가게|플라워/, " 화초 꽃 소매"], [/미용실|헤어/, " 두발 미용"],
  [/네일/, " 손발톱 관리"], [/카페/, " 커피 전문점"], [/편의점/, " 체인화 편의점"], [/피시방|pc방/i, " 컴퓨터 게임방"],
  [/치킨/, " 치킨 전문점"], [/베이커리|제과점/, " 제과점 빵"], [/쇼핑몰|온라인\s*판매|통신\s*판매/, " 전자상거래 소매"],
];

function ksicTokens(s: string): string[] {
  const raw = s
    .replace(/그\s*외|분류\s*안된/g, " ")
    .split(/[\s,·/()[\]및]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 || /^[가-힣]$/.test(x));
  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    if (t.length >= 2 && /[업점소실원집관장]$/.test(t)) out.add(t.slice(0, -1)); // '미용실' → '미용', '꽃집' → '꽃'
  }
  return [...out].filter((t) => t.length >= 2 || /^[가-힣]$/.test(t));
}

function bigrams(s: string): Set<string> {
  const d = despace(s).replace(/[^가-힣A-Za-z0-9]/g, "");
  const o = new Set<string>();
  for (let i = 0; i < d.length - 1; i += 1) o.add(d.slice(i, i + 2));
  return o;
}

/** 업태·종목 → 후보 n개(기본 3), 점수 높은 순. 둘 다 비었으면 []. */
export function suggestKsic(uptae: string, item: string, data: KsicData | null, n = 3): KsicHit[] {
  if (!data?.items || !String(item || uptae || "").trim()) return [];
  let it = String(item ?? "");
  for (const [re, add] of KSIC_ALIAS) if (re.test(it)) it += add;
  const up = despace(uptae);
  const whole = despace(it);
  const secs = new Set(UPTAE_SEC.filter(([re]) => re.test(up)).map(([, s]) => s));
  // 업태가 비었으면 종목 글의 '가공·제조·도매' 같은 말로 대분류를 짐작
  if (!secs.size) for (const [re, s] of UPTAE_SEC) if (re.test(whole)) secs.add(s);
  const gMid = /도매/.test(up) && !/소매/.test(up) ? "46" : /소매/.test(up) && !/도매/.test(up) ? "47" : null;
  const src = it || String(uptae ?? "");
  const toks = ksicTokens(src);
  const ib = [...bigrams(src)].filter((b) => !KSIC_WEAK_BI.has(b));
  const svcOnly = /서비스/.test(up) && !/제조/.test(up);
  if (!secs.size && svcOnly) for (const x of ["S", "M", "N", "P", "Q", "R", "I"]) secs.add(x); // 업태가 '서비스'뿐이면 서비스 계열로
  const res: KsicHit[] = [];
  for (const [code, name, sec, ex, desc] of data.items) {
    const nm = despace(name);
    const ed = despace(ex);
    const dd = despace(desc);
    // 낱말 단위로 정확히 같으면 높게, 글자 일부만 겹치면 낮게 — '학원'이 '대학원'에 붙지 않게
    const words = new Set([...name.split(/[\s,·()]+/), ...ex.split(/[\s,·()]+/)].map(despace).filter(Boolean));
    let sc = 0;
    const hits: string[] = [];
    for (const t of toks) {
      const td = despace(t);
      const w = KSIC_WEAK.test(td) ? 0.3 : td.length === 1 ? 0.6 : Math.min(td.length, 4) / 2;
      const exact = [...words].some((x) => x === td || x === `${td}업` || x.replace(/[업점]$/, "") === td);
      const g = exact ? 4 : nm.includes(td) ? 2.5 : ed.includes(td) ? 2 : dd.includes(td) ? 0.8 : 0;
      if (g) {
        sc += g * w;
        hits.push(t);
      }
    }
    // 붙여 쓴 말('자동차부품', '실내건축공사')은 두 글자 조각이 얼마나 겹치는지로
    if (ib.length) {
      const cb = bigrams(`${name} ${ex}`);
      const ov = ib.filter((b) => cb.has(b)).length / ib.length;
      if (ov >= 0.5) sc += 6 * ov * ov;
    }
    if (!sc) continue;
    if (nm === whole || nm === `${whole}업`) sc += 6;
    if (secs.size) sc *= secs.has(sec) ? 1.6 : 0.6;
    else if (svcOnly && sec === "C") sc *= 0.5;
    if (gMid && sec === "G") sc *= code.startsWith(gMid) ? 1.5 : 0.7;
    res.push({
      code,
      name,
      section: sec,
      sectionName: data.sec[sec] ?? "",
      midName: data.mid[code.slice(0, 2)] ?? "",
      score: Math.round(sc * 100) / 100,
      hits: [...new Set(hits)],
    });
  }
  // 점수가 같으면 이름이 짧은(덜 특수한) 분류 먼저
  return res.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.code.localeCompare(b.code)).slice(0, n);
}

/** 코드 앞자리 또는 이름·예시에 들어간 낱말로 직접 찾기. */
export function searchKsic(q: string, data: KsicData | null, n = 8): Omit<KsicHit, "score" | "hits">[] {
  const s = String(q ?? "").trim();
  if (!s || !data) return [];
  const d = despace(s);
  return data.items
    .filter(([c, nm, , ex]) => c.startsWith(s) || despace(nm).includes(d) || despace(ex).includes(d))
    .slice(0, n)
    .map(([code, name, section]) => ({ code, name, section, sectionName: data.sec[section] ?? "", midName: data.mid[code.slice(0, 2)] ?? "" }));
}
