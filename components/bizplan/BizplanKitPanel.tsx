"use client";
/**
 * 사업계획서 작성도구 — 「어떻게 만들까요?」 패널. ① 내 구독(자료 꾸러미)만 지금 열려 있다.
 * ② 내 API 키 · ③ 실비 결제는 같은 앞단을 쓰는 다음 단계라 「준비 중」으로만 보인다(ADR-0039).
 * 빠진 것 목록을 보여 주지만 막지는 않는다 — 꾸러미의 AI 가 만들기 전에 그 목록을 먼저 묻는다.
 */
import { useState } from "react";
import { Copy, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import type { BizplanMissing } from "@/util/bizplan-pack";
import type { KitInfo } from "./pack-client";

type Llm = "claude" | "chatgpt";

const GUIDE: Record<Llm, string[]> = {
  claude: [
    "꾸러미 ZIP 을 풀어요.",
    "claude.ai 에서 새 대화를 열고, 설정에서 「코드 실행 및 파일 생성」이 켜져 있는지 확인해요.",
    "풀린 파일(빌더·팩트시트·원본자료·양식)을 대화창에 끌어다 놓아요. 파일이 많으면 사진은 대표 장면 위주로 골라요.",
    "「시작 프롬프트 복사」를 눌러 첫 메시지로 붙여 넣어요.",
    "AI 가 빠진 정보를 물으면 답하거나 「이대로 진행」이라고 보내요.",
    "같은 빌더를 계속 쓴다면 「프로젝트」에 빌더를 한 번 넣어 두면 다음 업체부터는 자료만 올리면 돼요.",
  ],
  chatgpt: [
    "꾸러미 ZIP 을 풀어요.",
    "ChatGPT 에서 파일을 만들 수 있는(코드 실행이 되는) 모델로 새 대화를 열어요.",
    "빌더 md 는 붙여 넣지 말고 파일로 첨부해요(길이 제한). 팩트시트·원본자료·양식도 함께 첨부해요.",
    "「시작 프롬프트 복사」를 눌러 첫 메시지로 붙여 넣어요.",
    "AI 가 빠진 정보를 물으면 답하거나 「이대로 진행」이라고 보내요.",
  ],
};

function ModeCard({ n, title, desc, active, note }: { n: string; title: string; desc: string; active: boolean; note: string }) {
  return (
    <div
      aria-current={active ? "true" : undefined}
      className={`rounded-lg border px-3 py-2.5 ${active ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 bg-slate-50 opacity-70"}`}
    >
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${active ? "bg-blue-700 text-white" : "bg-slate-300 text-slate-700"}`}>{n}</span>
        {title}
        <span className={`ml-auto text-xs font-semibold ${active ? "text-blue-700" : "text-slate-500"}`}>{note}</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{desc}</p>
    </div>
  );
}

export default function BizplanKitPanel({ kit, kitError, missing, fileCount, sizeText, overLimit, busy, onDownload, onCopy, onTemplate }: {
  kit: KitInfo | null;
  kitError: string;
  missing: BizplanMissing[];
  fileCount: number;
  sizeText: string;
  overLimit: boolean;
  busy: boolean;
  onDownload: () => void;
  onCopy: () => void;
  onTemplate: (kind: "interview" | "clinic") => void;
}) {
  const [llm, setLlm] = useState<Llm>("claude");
  const must = missing.filter((m) => m.level === "필수").length;
  const tab = (key: Llm, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={llm === key}
      onClick={() => setLlm(key)}
      className={`flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${llm === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
    >
      {label}
    </button>
  );
  return (
    <section aria-labelledby="bizplan-make-title" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 id="bizplan-make-title" className="text-base font-bold text-slate-900">3. 어떻게 만들까요?</h2>
        <div className="mt-2 flex flex-col gap-2">
          <ModeCard n="①" title="내 구독으로 만들기" desc="자료 꾸러미를 받아 내 클로드·ChatGPT 대화창에서 직접 만들어요." active note="추가 비용 0원" />
          <ModeCard n="②" title="내 API 키로 자동 만들기" desc="키를 한 번 연결해 두면 경영일지가 끝까지 만들어요." active={false} note="준비 중" />
          <ModeCard n="③" title="실비 결제로 만들기" desc="키 없이 만들고, 끝나면 쓴 만큼만 카드로 결제해요." active={false} note="준비 중" />
        </div>
      </div>

      <div className={`rounded-lg px-3 py-2.5 text-sm ${must ? "bg-amber-50 text-amber-900" : missing.length ? "bg-slate-50 text-slate-700" : "bg-emerald-50 text-emerald-800"}`}>
        <p className="font-semibold">
          {missing.length === 0 ? "빠진 것 없이 준비됐어요" : `빠진 것 ${missing.length}개 (필수 ${must}개)`}
        </p>
        {missing.length > 0 && (
          <>
            <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-xs">
              {missing.map((m, i) => (
                <li key={i}>
                  <span className={`mr-1 font-bold ${m.level === "필수" ? "text-amber-800" : "text-slate-500"}`}>{m.level}</span>
                  {m.text}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs">그대로 받아도 돼요. 빠진 것은 AI 가 만들기 전에 먼저 물어봐요.</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={busy || overLimit}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-base font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
          {busy ? "꾸러미 만드는 중…" : "자료 꾸러미 받기 (ZIP)"}
        </button>
        <p className={`text-center text-xs ${overLimit ? "font-semibold text-red-600" : "text-slate-500"}`}>
          {overLimit ? `파일이 너무 커요 (${sizeText}) — 300MB 이하로 줄여 주세요.` : `원본 파일 ${fileCount}개 · ${sizeText}`}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          시작 프롬프트 복사
        </button>
      </div>

      <div>
        <div role="tablist" aria-label="쓰는 AI" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {tab("claude", "Claude 사용법")}
          {tab("chatgpt", "ChatGPT 사용법")}
        </div>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-slate-700">
          {GUIDE[llm].map((g) => <li key={g}>{g}</li>)}
        </ol>
        <p className="mt-2 text-xs text-slate-500">PPT·워드 파일을 받으려면 파일을 만들 수 있는 유료 요금제가 필요해요. 고객사 재무자료가 그 AI 회사로 전송된다는 점을 고객에게 알려 주세요.</p>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-sm font-semibold text-slate-800">공식 빌더·양식</p>
        {kitError ? (
          <p className="mt-1 text-xs text-red-600">{kitError}</p>
        ) : kit === null ? (
          <p className="mt-1 text-xs text-slate-500">확인하는 중…</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-sm text-slate-700">
            <li className="text-xs text-slate-500">
              {kit.builder ? `빌더 v${kit.builder.version || "?"} · ${kit.builder.updatedAt.slice(0, 10)} 업데이트` : "공식 빌더 준비 중"}
            </li>
            {kit.interview && (
              <li>
                <button type="button" onClick={() => onTemplate("interview")} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  팩트파인딩 인터뷰지 양식 받기
                </button>
              </li>
            )}
            {kit.clinic && <li className="text-xs text-slate-500">현장클리닉 보고서 양식은 꾸러미에 함께 들어가요.</li>}
            {kit.folderUrl && (
              <li>
                <a href={kit.folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  관리자: 공식 빌더 폴더 열기 (새 판은 여기에 올리기)
                </a>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
