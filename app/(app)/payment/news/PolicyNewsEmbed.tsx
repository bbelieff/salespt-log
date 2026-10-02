"use client";

import { useMemo, useState } from "react";
import {
  POLICY_NEWS_URL,
  type PolicyNewsItem,
  type PolicyNewsLoadResult,
} from "@/config/links";

function OriginalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
    >
      {children}
    </a>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function PolicyNewsCard({ item }: { item: PolicyNewsItem }) {
  const links = [
    [item.noticeUrl, "공고 원문"],
    [item.downloadUrl, "첨부 다운로드"],
    [item.newsUrl, "관련 뉴스"],
  ] as const;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-brand-red">
          {item.category}
        </span>
        {item.status && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {item.status}
          </span>
        )}
        {item.region && <span className="text-xs text-slate-500">{item.region}</span>}
      </div>
      <h2 className="mt-3 text-base font-bold leading-6 text-slate-900">{item.name}</h2>
      <p className="mt-1 text-sm text-slate-500">{item.agency}</p>

      <dl className="mt-4 grid gap-3 pc:grid-cols-2">
        <Detail label="최대 지원금액" value={item.amount} />
        <Detail label="공고일 · 마감일" value={[item.announcedAt, item.deadline].filter(Boolean).join(" · ")} />
        <Detail label="지원 대상" value={item.target} />
        <Detail label="업종 제한" value={item.industryRestriction} />
        <Detail label="창업 업력 제한" value={item.historyRestriction} />
        <Detail label="특정 타겟" value={item.specificTarget} />
        <Detail label="대출 종류" value={item.loanType} />
        <Detail label="상환 조건" value={item.repayment} />
        <Detail label="대출 금리" value={item.interest} />
        <Detail label="기타 조건" value={item.fees} />
        <Detail label="신청 방법" value={item.application} />
      </dl>

      {links.some(([href]) => href) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map(([href, label]) =>
            href ? (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {label} ↗
              </a>
            ) : null,
          )}
        </div>
      )}
    </article>
  );
}

export default function PolicyNewsEmbed({ result }: { result: PolicyNewsLoadResult }) {
  const [category, setCategory] = useState("전체");

  const categories = useMemo(
    () => result.status === "ready"
      ? ["전체", ...new Set(result.data.items.map((item) => item.category))]
      : ["전체"],
    [result],
  );
  const items = result.status === "ready"
    ? result.data.items.filter((item) => category === "전체" || item.category === category)
    : [];

  if (result.status === "error") {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center" aria-label="정책자금 뉴스 오류" role="alert">
        <p className="text-sm font-bold text-amber-950">뉴스를 안전하게 불러오지 못했어요.</p>
        <p className="mt-2 text-sm text-amber-800">{result.message}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            href="/payment/news?retry=1"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-red px-4 text-sm font-bold text-white hover:bg-red-700"
          >
            다시 시도
          </a>
          <OriginalLink href={POLICY_NEWS_URL}>원문 새 창에서 열기</OriginalLink>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm" aria-label="정책자금 데일리 뉴스 목록">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{result.data.date} 정책자금 뉴스</p>
          <p className="mt-0.5 text-xs text-slate-500">총 {result.data.total}건</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="뉴스 성격 필터">
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${
                category === value
                  ? "bg-brand-red text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 max-h-[65dvh] space-y-3 overflow-y-auto pr-1 pc:max-h-[calc(100dvh-13rem)]">
        {items.length > 0 ? (
          items.map((item) => <PolicyNewsCard key={item.id} item={item} />)
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {result.data.items.length === 0 ? "오늘 등록된 정책자금 뉴스가 없어요." : "이 성격의 뉴스가 없어요."}
          </div>
        )}
      </div>
    </section>
  );
}
