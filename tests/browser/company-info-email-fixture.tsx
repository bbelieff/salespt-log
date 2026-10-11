/**
 * 업체정보 [대표자] 이메일 칸 목업(company-info-email) — 실제 CompanyInfoEditor · TXT 포맷(formatCompanyInfoTxt)
 * · 미팅 메모 파서(parseMeetingMemo) · 스키마(CompanyInfo)를 그대로 쓰고 데이터만 합성(example.com)이다.
 * 띄우기: node tests/browser/company-info-email-server.mjs → 출력된 주소.
 *
 * 쿼리:
 *  ?email=<값>   (A) 업체의 처음 이메일(기본 ceo@example.com · 빈 칸은 ?email= · 모양 오류는 ?email=ceo@example)
 *  ?empty=1      (A) 아무것도 안 적은 업체(이메일 칸이 연락처 줄 바로 아래 — 적은 것 위로 올리기 영향 없음)
 *  ?view=all|filled|empty   (A) 「전체 / 적은 것 / 안 적은 것」 처음 보기
 * 편집기는 hideSave(부모가 영속화하는 임베드 모드)라 API 호출이 없다. vaultTarget·txtCompanyName 도 넘기지 않는다.
 */
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import { companyInfoFieldList } from "@/components/company-info-defs";
import { companyInfoForExport } from "@/service/company-finance";
import { formatCompanyInfoTxt } from "@/service/company-info-txt";
import { parseMeetingMemo } from "@/lib/document-ocr/parse-memo";

const q = new URLSearchParams(location.search);
const VIEW_STORE_KEY = "salespt:company-info-view"; // components/company-info/CompanyInfoViewToggle.tsx 와 같은 키
try {
  // 보기·글자 크기 기억이 다른 시나리오에 남지 않게 비우고, ?view 만 다시 심는다.
  localStorage.clear();
  const v = q.get("view");
  if (v === "all" || v === "filled" || v === "empty") localStorage.setItem(VIEW_STORE_KEY, v);
} catch {
  // 저장소를 못 쓰면 기본 보기(전체)로 연다.
}

const NOW = new Date();
const p2 = (n: number) => String(n).padStart(2, "0");
/** TXT 머리의 추출시각 — 오늘 기준(날짜 리터럴 없음). */
const STAMP = `${NOW.getFullYear()}-${p2(NOW.getMonth() + 1)}-${p2(NOW.getDate())} ${p2(NOW.getHours())}:${p2(NOW.getMinutes())}`;
const COMPANY = "샘플상사";

/** 합성 업체 — 실명·실주소·실이메일 없음. */
const SAMPLE: Partial<CompanyInfo> = {
  대표자이름: "홍길동",
  신용점수: "900/880",
  연락처통신사: "010-0000-0000(SKT)",
  자택주소지: "가상시 예시로 1",
  동종업계경력: "포장재 제조 5년",
  사업자구분: "개인",
  업종주생산품목: "제조/필름",
  주생산품목: "포장용 필름",
  소재지: "가상시 테스트로 12",
  사대보험직원: "3명",
};
const emailParam = q.get("email");
const INITIAL = CompanyInfo.parse(
  q.get("empty") === "1" ? { 이메일: emailParam ?? "" } : { ...SAMPLE, 이메일: emailParam ?? "ceo@example.com" },
);

/** 미팅 메모 예시 — 「문서로 자동입력 → 메모 붙여넣기」에 그대로 넣어 비교표를 확인한다. */
const MEMOS: Record<string, string> = {
  "기본 메모": [
    `${COMPANY} / 홍길동`,
    "● 휴대폰번호(통신사)\t\t010 0000 0000 SKT",
    "● 이메일주소\t\tceo@example.com",
    "● 신용점수\t\t900/880",
  ].join("\n"),
  "대표·사업장 라벨": [
    `${COMPANY} / 홍길동`,
    "● 대표 이메일\t\tmailto:CEO＠Example.com",
    "● 사업장 소재지\t\t가상시 테스트로 12",
    "● 이메일 아이디 / 비번\t\tsample-id@example.com / Sample!pw0",
  ].join("\n"),
  "연락처/이메일 한 줄·모양 오류": [
    `${COMPANY} / 홍길동`,
    "● 연락처/이메일\t\t010-0000-0000(KT) / ceo@example",
  ].join("\n"),
  // 비밀번호가 이메일·대표자 칸에 새지 않는지(검수 결함 회귀) — 계정 라벨은 보관함, 이메일 칸엔 주소만.
  "계정·비밀번호 섞인 줄": [
    `${COMPANY} / 홍길동`,
    "● 이메일 id / pw\t\tsample-id@example.com / Sample!pw9",
    "● 대표 이메일 로그인\t\tceo@example.com / Sample!pw8",
    "● 이메일\t\toffice@example.com / Sample!pw7",
    "● 연락처\t\t010-0000-0000 @카톡",
  ].join("\n"),
};

const card = "rounded-lg border border-gray-200 bg-white p-3 shadow-sm";
const h2 = "mb-2 text-sm font-bold text-gray-900";
const note = "text-xs text-gray-500";

function Scenarios() {
  const links: [string, string][] = [
    ["이메일 적음", "/"],
    ["이메일 빈 칸", "/?email="],
    ["모양 오류", "/?email=ceo@example"],
    ["전각·공백(벗어나면 정리)", `/?email=${encodeURIComponent(" CEO＠Example.com ")}`],
    ["빈 업체", "/?empty=1"],
    ["적은 것", "/?view=filled"],
    ["안 적은 것", "/?view=empty"],
  ];
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="시나리오">
      {links.map(([label, href]) => (
        <a key={href} href={href} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
          {label}
        </a>
      ))}
    </nav>
  );
}

/** (A) 아래 — 저장될 값(실제 스키마 검사) + 업체정보생성(TXT) 미리보기(실제 포맷). */
function SavedPreview({ draft }: { draft: CompanyInfo }) {
  const parsed = CompanyInfo.safeParse(draft);
  const txt = formatCompanyInfoTxt(COMPANY, companyInfoForExport(draft, NOW), STAMP);
  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700" data-fixture="saved">
        <p>
          저장될 이메일: <b className="text-gray-900">{draft.이메일 === "" ? "(빈 값)" : `"${draft.이메일}"`}</b>
        </p>
        <p className={parsed.success ? "text-emerald-700" : "text-red-600"}>
          {parsed.success ? "✓ 서버 스키마 검사 통과 — 모양이 틀려도 저장을 막지 않아요(400 없음)" : "✕ 스키마 검사 실패"}
        </p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-gray-700">업체정보생성(TXT) 미리보기</p>
        <pre className="overflow-x-auto rounded-md border border-gray-200 bg-white p-2 text-px-11 leading-5 text-gray-800" data-fixture="txt">
          {txt}
        </pre>
      </div>
    </div>
  );
}

/** (C) 미팅 메모 → 실제 파서 결과(비교표에 올라갈 칸) + 복사. */
function MemoSection() {
  const names = Object.keys(MEMOS);
  const [name, setName] = useState(names[0]!);
  const [copied, setCopied] = useState("");
  const memo = MEMOS[name]!;
  const res = useMemo(() => parseMeetingMemo(memo, { baseYear: NOW.getFullYear() }), [memo]);
  const labelOf = new Map(companyInfoFieldList(NOW.getFullYear()).map(([k, l]) => [String(k), l]));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(memo);
      setCopied("복사했어요 — 위 편집기 「문서로 자동입력 → 메모 붙여넣기」에 넣어 보세요.");
    } catch {
      setCopied("복사하지 못했어요. 글을 직접 선택해 복사해 주세요.");
    }
  };
  return (
    <section className={card} aria-label="미팅 메모 자동입력">
      <h2 className={h2}>(C) 미팅 메모 → 이메일 칸 후보</h2>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === name}
            onClick={() => setName(n)}
            className={`rounded-md px-2 py-1 text-xs font-semibold ${n === name ? "bg-slate-800 text-white" : "border border-gray-300 bg-white text-gray-600"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <label htmlFor="fixture-memo" className="sr-only">미팅 메모 예시</label>
      <textarea id="fixture-memo" readOnly value={memo} rows={5} className="w-full resize-none rounded-md border border-gray-300 p-2 text-xs text-gray-900" />
      <button type="button" onClick={copy} className="mt-1 rounded-md bg-gray-900 px-3 py-1 text-xs font-bold text-white">
        메모 복사
      </button>
      {copied && <p className="mt-1 text-xs text-gray-600" role="status">{copied}</p>}
      <p className="mt-2 text-xs font-semibold text-gray-700">파서가 제안하는 칸(실제 parseMeetingMemo)</p>
      <ul className="mt-1 space-y-0.5 text-xs" data-fixture="memo-fields">
        {res.fields.map((f, i) => (
          <li key={`${f.key}-${i}`} className={f.key === "이메일" ? "font-semibold text-gray-900" : "text-gray-600"}>
            {labelOf.get(f.key) ?? f.key}: {f.value} · 정확도 {f.confidence}
            {f.valid === false && <span className="ml-1 text-gray-500">· 비교표 기본 체크 안 함</span>}
            {f.warnings.map((w) => (
              <span key={w} className="ml-1 text-amber-700">⚠ {w}</span>
            ))}
          </li>
        ))}
      </ul>
      <p className={`mt-1 ${note}`}>
        참고 정보(저장 안 함): {(res.info ?? []).map((i) => `${i.label} ${i.value}`).join(", ") || "없음"} · 계정 보관함 후보 {res.vault.length}건
      </p>
    </section>
  );
}

function App() {
  const [draft, setDraft] = useState<CompanyInfo>(INITIAL);
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      <header className="space-y-2">
        <h1 className="text-sm font-black text-gray-900">업체정보 이메일 칸 — 합성 목업(실제 컴포넌트)</h1>
        <p className={note}>데이터는 모두 가상(example.com)이에요. 저장·서버 호출은 없고, 화면·정리·TXT·메모 읽기는 실제 코드예요.</p>
        <Scenarios />
      </header>

      <section className={card} aria-label="확장보기">
        <h2 className={h2}>(A) 확장보기 — 실무/수납 기본값 · [대표자] 연락처 줄 바로 아래 이메일</h2>
        <CompanyInfoEditor hideSave defaultLayout="extended" value={INITIAL} onChange={setDraft} onSave={() => undefined} />
        <SavedPreview draft={draft} />
      </section>

      <section className={card} aria-label="기본보기">
        <h2 className={h2}>(B) 기본보기 — 컨택관리 기본값 · 이메일 칸 없음, 적혀 있으면 아래 숫자에 들어감</h2>
        <CompanyInfoEditor hideSave defaultLayout="basic" value={CompanyInfo.parse({ 이메일: "ceo@example.com" })} onSave={() => undefined} />
      </section>

      <MemoSection />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
