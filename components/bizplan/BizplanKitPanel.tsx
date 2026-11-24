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

type Step = { title: string; detail?: string };

/** 「내 구독으로 만들기」 순서 — 꾸러미 + 내 준비물 폴더를 대화창에 넣고 「실행」 한 마디. */
const GUIDE: Record<Llm, Step[]> = {
  claude: [
    { title: "위 「자료 꾸러미 받기」를 눌러 ZIP 을 받아요." },
    { title: "받은 ZIP 을 마우스 오른쪽 → 「압축 풀기」 해요.", detail: "폴더가 하나 생겨요." },
    { title: "claude.ai 를 열고 「새 대화」를 눌러요." },
    {
      title: "파일을 전부 대화창에 끌어다 놓아요.",
      detail: "① 풀린 꾸러미 폴더를 열어 Ctrl+A(맥은 ⌘+A)로 전부 골라 끌어다 놓고, ② 준비물(등록증·재무제표·부가세·사진·인터뷰·매출매입처 자료) 폴더의 파일도 같은 방법으로 넣어요. 여기에 올린 서류는 꾸러미에 이미 들어 있어요.",
    },
    { title: "입력칸에 「실행」이라고 적고 보내요." },
    { title: "AI 가 빠진 걸 물으면 답하거나 「이대로 진행」이라고 보내요.", detail: "다 되면 사업계획서 PPT·설명 워드·현장클리닉 보고서 3개 파일을 받아요." },
  ],
  chatgpt: [
    { title: "위 「자료 꾸러미 받기」를 눌러 ZIP 을 받아요." },
    { title: "받은 ZIP 을 마우스 오른쪽 → 「압축 풀기」 해요.", detail: "폴더가 하나 생겨요." },
    { title: "ChatGPT 에서 파일을 만들 수 있는 모델로 「새 채팅」을 열어요." },
    {
      title: "파일을 전부 대화창에 끌어다 놓아요.",
      detail: "꾸러미 폴더의 파일과 준비물 폴더의 파일을 모두 넣어요. 한 번에 안 들어가면 나눠서 넣어요.",
    },
    { title: "입력칸에 「실행」이라고 적고 보내요." },
    { title: "AI 가 빠진 걸 물으면 답하거나 「이대로 진행」이라고 보내요." },
  ],
};

export default function BizplanKitPanel({ kit, kitError, missing, showMissing, fileCount, sizeText, overLimit, busy, onDownload, onCopy, onTemplate }: {
  kit: KitInfo | null;
  kitError: string;
  missing: BizplanMissing[];
  /** 팩트시트를 하나라도 채웠을 때만 빠진 것 목록을 보인다(안 채우면 AI 가 서류에서 직접 읽는다). */
  showMissing: boolean;
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
        <h2 id="bizplan-make-title" className="text-base font-bold text-slate-900">사업계획서 만들기</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          내 클로드·ChatGPT 구독으로 만들어요. <span className="whitespace-nowrap font-semibold text-blue-700">추가 비용 0원</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">API 키로 자동 만들기 · 실비 결제로 만들기는 준비 중이에요.</p>
      </div>

      {showMissing && (
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
      )}

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
          {overLimit ? `파일이 너무 커요 (${sizeText}) — 300MB 이하로 줄여 주세요.` : fileCount ? `여기 올린 서류 ${fileCount}개도 함께 담아요 · ${sizeText}` : "빌더와 AI 지시문을 담아요. 서류는 대화창에 직접 넣으면 돼요."}
        </p>
      </div>

      <div>
        <div role="tablist" aria-label="쓰는 AI" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {tab("claude", "Claude 로 만들기")}
          {tab("chatgpt", "ChatGPT 로 만들기")}
        </div>
        <ol className="mt-3 flex flex-col gap-3">
          {GUIDE[llm].map((g, i) => (
            <li key={g.title} className="flex gap-3">
              <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${g.title.startsWith("입력칸") ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}>{i + 1}</span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-slate-900">{g.title}</p>
                {g.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{g.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <p>
            {llm === "claude"
              ? "처음 한 번만: claude.ai 설정 → 기능에서 「코드 실행 및 파일 생성」을 켜 두세요."
              : "PPT·워드 파일을 받으려면 파일을 만들 수 있는 유료 요금제가 필요해요."}
          </p>
          <p className="mt-1">
            「실행」에 반응이 없으면{" "}
            <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              지시문 복사
            </button>
            {" "}해서 붙여 넣어 보내세요.
          </p>
          <p className="mt-1">고객사 재무자료가 그 AI 회사로 전송된다는 점을 고객에게 알려 주세요.</p>
        </div>
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
