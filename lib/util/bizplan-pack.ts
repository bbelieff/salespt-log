/**
 * Layer: util (순수 — import 0). 사업계획서 작성도구 ① 「자료 꾸러미」의 글 만들기(docs/plans/active/bizplan-tool.md).
 *
 * 꾸러미 = 시작 프롬프트 + 공식 빌더 + 팩트시트 + 원본 자료 + 산출물 체크리스트.
 * 이 파일은 화면 입력(BizplanDraft)을 받아 팩트시트·프롬프트·체크리스트 글과 「빠진 것」 목록을 만든다.
 * 고객 자료는 브라우저에서만 다룬다 — 이 함수들은 서버로 아무것도 보내지 않는다.
 */

/** 올리는 자료 칸 — 앞 6개가 필수(7번째 필수인 빌더는 공식 판을 자동으로 넣는다). */
export const BIZPLAN_SLOTS = [
  { key: "biz", label: "사업자등록증", required: true, folder: "01_사업자등록증", hint: "PDF 또는 사진" },
  { key: "fs", label: "표준재무제표 (3개년)", required: true, folder: "02_표준재무제표", hint: "연도별 PDF" },
  { key: "vat", label: "부가세 과세표준증명원 (3개년)", required: true, folder: "03_부가세과세표준", hint: "연도별 PDF" },
  { key: "photos", label: "공정·보유시설 사진", required: true, folder: "04_공정시설사진", hint: "공정 순서대로 여러 장" },
  { key: "interview", label: "팩트파인딩 인터뷰", required: true, folder: "05_인터뷰", hint: "인터뷰지·녹취 전사" },
  { key: "partners", label: "매출처·매입처 TOP3 자료", required: true, folder: "06_매출매입처", hint: "간편인증 세금계산서 엑셀을 올리면 TOP3 표를 채워요" },
  { key: "extra", label: "추가 자료", required: false, folder: "07_추가자료", hint: "회사소개서·수출확인서·특허·인증 등" },
] as const;
export type BizplanSlotKey = (typeof BIZPLAN_SLOTS)[number]["key"];

export const BIZPLAN_STORIES = ["", "성장형", "정체·하락형"] as const;
export type BizplanStory = (typeof BIZPLAN_STORIES)[number];

/** 금액은 모두 백만원(업체정보와 같은 단위). 사용자가 친 글자 그대로 둔다. */
export type BizplanYear = {
  year: string;
  매출액: string;
  영업이익: string;
  당기순이익: string;
  자산총계: string;
  부채총계: string;
  자본총계: string;
  과세표준: string;
};
export const BIZPLAN_YEAR_COLUMNS = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"] as const;

export type BizplanPartner = { name: string; item: string; amount: string };

export type BizplanDraft = {
  company: string;
  ceo: string;
  bizNo: string;
  industry: string;
  founded: string;
  address: string;
  employees: string;
  story: BizplanStory;
  fundAgency: string;
  fundAmount: string;
  fundUse: string;
  years: BizplanYear[];
  sales: BizplanPartner[];
  purchases: BizplanPartner[];
  focus: string;
};

/** 팩트시트를 하나도 안 채웠는가 — 그러면 꾸러미에 팩트시트를 넣지 않고 AI 가 서류에서 직접 읽는다. */
export function isBlankDraft(d: BizplanDraft): boolean {
  const vals = [
    d.company, d.ceo, d.bizNo, d.industry, d.founded, d.address, d.employees, d.story, d.fundAgency, d.fundAmount, d.fundUse, d.focus,
    ...d.years.flatMap(({ year: _y, ...v }) => Object.values(v)),
    ...[...d.sales, ...d.purchases].flatMap((p) => [p.name, p.item, p.amount]),
  ];
  return vals.every((v) => !String(v ?? "").trim());
}

/** 올린 파일 목록(이름·칸) — 팩트시트 「올린 자료」와 빠진 칸 판단에 쓴다. */
export type BizplanFileRef = { slot: BizplanSlotKey; name: string };

/** 빈 초안. 연도는 기준 연도(보통 올해) 앞 3년 — 2026 이면 2023·2024·2025. */
export function emptyBizplanDraft(baseYear: number): BizplanDraft {
  const year = (y: number): BizplanYear => ({
    year: String(y), 매출액: "", 영업이익: "", 당기순이익: "", 자산총계: "", 부채총계: "", 자본총계: "", 과세표준: "",
  });
  const partner = (): BizplanPartner => ({ name: "", item: "", amount: "" });
  return {
    company: "", ceo: "", bizNo: "", industry: "", founded: "", address: "", employees: "",
    story: "", fundAgency: "", fundAmount: "", fundUse: "",
    years: [year(baseYear - 3), year(baseYear - 2), year(baseYear - 1)],
    sales: [partner(), partner(), partner()],
    purchases: [partner(), partner(), partner()],
    focus: "",
  };
}

/** 저장해 둔 초안(옛 모양일 수 있음)을 지금 모양으로 맞춘다. 모르는 값은 빈칸. */
export function normalizeBizplanDraft(raw: unknown, baseYear: number): BizplanDraft {
  const base = emptyBizplanDraft(baseYear);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const out: BizplanDraft = { ...base };
  for (const k of ["company", "ceo", "bizNo", "industry", "founded", "address", "employees", "fundAgency", "fundAmount", "fundUse", "focus"] as const) {
    out[k] = str(r[k]);
  }
  out.story = (BIZPLAN_STORIES as readonly string[]).includes(str(r.story)) ? (str(r.story) as BizplanStory) : "";
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  out.years = base.years.map((y, i) => {
    const s = (arr(r.years)[i] ?? {}) as Record<string, unknown>;
    const row = { ...y };
    for (const k of ["year", ...BIZPLAN_YEAR_COLUMNS, "과세표준"] as const) if (str(s[k])) row[k] = str(s[k]);
    return row;
  });
  const partners = (v: unknown) =>
    base.sales.map((_, i) => {
      const s = (arr(v)[i] ?? {}) as Record<string, unknown>;
      return { name: str(s.name), item: str(s.item), amount: str(s.amount) };
    });
  out.sales = partners(r.sales);
  out.purchases = partners(r.purchases);
  return out;
}

/** "1,234.5" "-120" "(120)" → 숫자. 못 읽으면 null. */
export function toAmount(text: string): number | null {
  const t = text.replace(/[,\s]|백만원|원$/g, "").trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t);
  const n = Number(neg ? t.slice(1, -1) : t);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** 전년 대비 증감률 "▲ 18.4%" / "▼ 3.0%" / "-"(계산 못 함). */
export function growthLabel(prev: string, cur: string): string {
  const a = toAmount(prev);
  const b = toAmount(cur);
  if (a === null || b === null || a === 0) return "-";
  const pct = ((b - a) / Math.abs(a)) * 100;
  const v = Math.abs(pct).toFixed(1);
  if (v === "0.0") return "0.0%";
  return `${pct > 0 ? "▲" : "▼"} ${v}%`;
}

export type BizplanMissing = { level: "필수" | "권장"; text: string };

/** 만들기 전에 채우거나 AI 가 먼저 물어봐야 할 것. 필수 = 빠지면 결과가 비는 것. */
export function bizplanMissing(draft: BizplanDraft, _files: BizplanFileRef[], hasBuilder: boolean): BizplanMissing[] {
  const out: BizplanMissing[] = [];
  if (!hasBuilder) out.push({ level: "필수", text: "공식 빌더가 아직 준비되지 않았어요 — 내 빌더 파일을 직접 함께 올려 주세요." });
  // 서류는 여기 안 올리고 대화창에 직접 넣어도 된다(① 내 구독) — 서류가 있는지는 AI 가 대화에 올린 파일로 확인한다.
  if (!draft.company.trim()) out.push({ level: "필수", text: "업체명이 비어 있어요." });
  for (const y of draft.years) {
    if (!y.매출액.trim()) out.push({ level: "필수", text: `${y.year}년 매출액이 비어 있어요.` });
    if (!y.과세표준.trim()) out.push({ level: "권장", text: `${y.year}년 부가세 과세표준이 비어 있어요.` });
  }
  if (!draft.sales.some((p) => p.name.trim())) out.push({ level: "권장", text: "매출처 TOP3 가 비어 있어요." });
  if (!draft.purchases.some((p) => p.name.trim())) out.push({ level: "권장", text: "매입처 TOP3 가 비어 있어요." });
  if (!draft.fundAmount.trim()) out.push({ level: "필수", text: "신청하려는 자금 금액이 비어 있어요." });
  if (!draft.fundUse.trim()) out.push({ level: "권장", text: "자금 용도가 비어 있어요." });
  if (!draft.employees.trim()) out.push({ level: "권장", text: "상시 근로자 수가 비어 있어요." });
  if (!draft.focus.trim()) out.push({ level: "권장", text: "이번 사업계획서 주안점이 비어 있어요." });
  return out;
}

const cell = (s: string) => (s.trim() ? s.trim().replace(/\|/g, "／").replace(/\n+/g, " ") : "(빈칸)");

/** 02_팩트시트.md — 모델이 PDF 를 다시 읽지 않아도 되게 숫자를 미리 정리한다. */
export function buildFactsheet(draft: BizplanDraft, files: BizplanFileRef[], missing: BizplanMissing[], madeAt: string): string {
  const L: string[] = [];
  L.push(`# 팩트시트 — ${cell(draft.company)}`, "");
  L.push(`> 경영일지 사업계획서 작성도구가 ${madeAt} 에 만든 자료입니다. 숫자는 사용자가 확인해 적은 값입니다.`);
  L.push("> 원본 서류(대화에 함께 올린 서류 파일)와 다르면 원본을 따르고, 다른 곳을 사용자에게 알려 주세요. (빈칸) 은 아직 모르는 값입니다.", "");
  L.push("## 1. 회사", "", "| 항목 | 값 |", "|---|---|");
  const rows: [string, string][] = [
    ["업체명", draft.company], ["대표자", draft.ceo], ["사업자등록번호", draft.bizNo], ["업태·종목", draft.industry],
    ["설립일", draft.founded], ["소재지", draft.address], ["상시 근로자", draft.employees],
    ["매출 흐름", draft.story || "모름 (서류로 판단)"],
  ];
  for (const [k, v] of rows) L.push(`| ${k} | ${cell(v)} |`);
  L.push("", "## 2. 재무 3개년 (단위: 백만원, 표준재무제표)", "");
  L.push(`| 연도 | ${BIZPLAN_YEAR_COLUMNS.join(" | ")} | 매출 증감 |`);
  L.push(`|---|${BIZPLAN_YEAR_COLUMNS.map(() => "---:").join("|")}|---|`);
  draft.years.forEach((y, i) => {
    const prev = i > 0 ? draft.years[i - 1]! : null;
    const g = prev ? growthLabel(prev.매출액, y.매출액) : "-";
    L.push(`| ${cell(y.year)} | ${BIZPLAN_YEAR_COLUMNS.map((c) => cell(y[c])).join(" | ")} | ${g} |`);
  });
  L.push("", "## 3. 부가세 과세표준 (단위: 백만원)", "", "| 연도 | 과세표준 | 증감 |", "|---|---:|---|");
  draft.years.forEach((y, i) => {
    const prev = i > 0 ? draft.years[i - 1]! : null;
    L.push(`| ${cell(y.year)} | ${cell(y.과세표준)} | ${prev ? growthLabel(prev.과세표준, y.과세표준) : "-"} |`);
  });
  const partnerTable = (title: string, list: BizplanPartner[]) => {
    L.push("", `## ${title} (연 거래액 단위: 백만원)`, "", "| 순위 | 거래처 | 품목 | 연 거래액 |", "|---|---|---|---:|");
    list.forEach((p, i) => L.push(`| ${i + 1} | ${cell(p.name)} | ${cell(p.item)} | ${cell(p.amount)} |`));
  };
  partnerTable("4. 매출처 TOP3", draft.sales);
  partnerTable("5. 매입처 TOP3", draft.purchases);
  L.push("", "## 6. 자금 신청", "", "| 항목 | 값 |", "|---|---|");
  L.push(`| 신청 기관·상품 | ${cell(draft.fundAgency)} |`, `| 금액 | ${cell(draft.fundAmount)} |`, `| 용도 | ${cell(draft.fundUse)} |`);
  L.push("", "## 7. 이번 사업계획서 주안점", "", draft.focus.trim() || "(빈칸)");
  L.push("", "## 8. 올린 자료", "");
  for (const s of BIZPLAN_SLOTS) {
    const names = files.filter((f) => f.slot === s.key).map((f) => f.name);
    L.push(`- ${s.label}: ${names.length ? names.join(", ") : "없음"}`);
  }
  L.push("", "## 9. 빠진 자료·정보 — 만들기 전에 사용자에게 먼저 물어볼 것", "");
  if (!missing.length) L.push("- 없음");
  for (const m of missing) L.push(`- [${m.level}] ${m.text}`);
  return L.join("\n") + "\n";
}

export type BizplanKitNames = { builder: string | null; clinic: string | null; interview: string | null };

/** 00_AI지시_먼저읽기.txt — 꾸러미 파일을 모두 올리고 「실행」만 보내면 AI 가 이 지시대로 시작한다(붙여 넣어도 된다). */
export function buildStartPrompt(draft: BizplanDraft, kit: BizplanKitNames): string {
  const blank = isBlankDraft(draft);
  const company = draft.company.trim() || (blank ? "이 회사" : "[업체명]");
  const builder = kit.builder ? `「${kit.builder}」` : "함께 올린 빌더 md";
  const outputs = [
    "① 사업계획서 PPT(.pptx)",
    "② 같은 순서로 슬라이드마다 설명을 쓴 워드(.docx)",
    kit.clinic
      ? `③ 「${kit.clinic}」 양식의 목차대로 채운 현장클리닉 보고서 워드(.docx)`
      : "③ 현장클리닉 보고서 워드(.docx) — 진단·문제점·개선과제·개선방안·사후관리 순서",
  ];
  const L = [
    "[AI 에게] 이 파일과 함께 올린 파일들로 사업계획서를 만든다. 사용자가 「실행」이라고만 보내도 아래 지시대로 바로 시작해.",
    "",
    `첨부한 ${builder} 대로 ${company} 사업계획서를 만들어줘.${draft.story ? ` 상황: ${draft.story}` : ""}`,
    "",
    blank
      ? "- 회사 정보와 숫자는 올린 서류에서 직접 읽어. 만들기 전에 읽은 핵심 숫자(연도별 매출·영업이익·부가세 과세표준, 매출처·매입처 TOP3)를 표로 먼저 보여 주고 나에게 확인받아."
      : "- 회사 정보와 숫자는 「02_팩트시트.md」를 먼저 보고, 원본 서류(대화에 함께 올린 다른 파일)로 확인해.",
    `- 만들 파일 3가지: ${outputs.join(" / ")}.`,
    `- 필요한 서류(${BIZPLAN_SLOTS.filter((x) => x.required).map((x) => x.label).join("·")})는 이 대화에 올린 파일 전부에서 찾아. 없는 서류는 목록으로 알려 줘.`,
    (blank ? "- 빠진 서류·정보" : "- 팩트시트 9번 「빠진 자료·정보」") + "와 빌더 STEP 4 의 추가 인터뷰 질문은 만들기 전에 나에게 먼저 묻고 멈춰. 내가 답하거나 「이대로 진행」이라고 하면 이어서 만들어.",
  ];
  if (draft.focus.trim()) L.push(`- 이번 주안점: ${draft.focus.trim().replace(/\n+/g, " ")}`);
  L.push("- 끝나면 빌더 §12 형식으로 결과와 남은 질문을 알려 줘.");
  return L.join("\n") + "\n";
}

/** 04_산출물체크리스트.md — 받은 파일을 사람이 확인하는 표. */
export function buildChecklist(draft: BizplanDraft): string {
  const c = cell(draft.company);
  return [
    `# 산출물 체크리스트 — ${c}`,
    "",
    "- [ ] 사업계획서 PPT: 표지 업체명·작성 연도 확인, 빈칸·「확인 필요」 표시 없음",
    "- [ ] 재무 슬라이드 숫자가 팩트시트 2·3번과 같음 (단위 백만원)",
    "- [ ] 매출처·매입처 TOP3 가 팩트시트 4·5번과 같음",
    "- [ ] 자금 금액·용도가 팩트시트 6번과 같음",
    "- [ ] 슬라이드별 설명 워드: PPT 와 같은 순서·같은 장 수",
    "- [ ] 현장클리닉 보고서: 문제점 → 개선과제 → 개선방안 → 사후관리가 모두 채워짐",
    "- [ ] 고객에게 보내기 전에 대표님 이름·연락처·사업자번호 오타 확인",
    "",
  ].join("\n");
}

/** 꾸러미 파일 이름에 쓸 업체명(못 쓰는 글자 제거, 비면 "업체"). */
export function packFileStem(company: string): string {
  const s = company.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "").slice(0, 40);
  return s || "업체";
}
