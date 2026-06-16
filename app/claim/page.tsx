/**
 * /claim — Self-claim 화면.
 *
 * 흐름: Google 로그인 후 registry 미등록 사용자가 들어옴.
 *  - 수강생(일반 기수): 기수(숫자) + 이름 → cohort = 숫자.
 *  - 아레나: 시즌(A{n}) + 자기기수({m}기) + 이름 → cohort = "A{n}-{m}기".
 *    아레나는 prep 등록(create-arena-members) 전제 — registry (A{n}-{m}기, 이름)
 *    매칭으로 본인 시트 연결. 라벨 포맷이 prep 과 동일해야 매칭됨.
 * POST /api/claim → 매칭 시트 자동 연결 → /dashboard.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useGlobalLoading } from "@/components/ui/LoadingProvider";

type Mode = "cohort" | "arena";

export default function ClaimPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("cohort");
  // 일반 기수
  const [cohort, setCohort] = useState("");
  // 아레나
  const [season, setSeason] = useState("");
  const [gisu, setGisu] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show, hide } = useGlobalLoading();

  const seasonNum = useMemo(() => {
    const n = Number(season);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [season]);
  const gisuNum = useMemo(() => {
    // 빈칸은 null (Number("")=0 오인 방지). 0 이상 정수 허용 (A1-0기 가능).
    const t = gisu.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }, [gisu]);

  // 제출 cohort: 일반은 입력값, 아레나는 "A{시즌}-{기수}기" 조합.
  // gisuNum 0 이 falsy 로 누락되지 않게 !== null 비교.
  const arenaCohort = useMemo(
    () =>
      seasonNum !== null && gisuNum !== null
        ? `A${seasonNum}-${gisuNum}기`
        : null,
    [seasonNum, gisuNum],
  );
  const effectiveCohort = mode === "arena" ? (arenaCohort ?? "") : cohort;

  const valid =
    name.trim().length >= 2 &&
    (mode === "arena"
      ? arenaCohort !== null
      : // 수강생: 숫자(기수). 트레이너: "T"/"t" (sheet 검색 건너뜀).
        /^(\d+|[Tt])$/.test(cohort.replace(/기\s*$/, "").trim()));

  async function handleSubmit() {
    setLoading(true);
    show("연결하고 있어요");
    setError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort: effectiveCohort, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_found") {
          setError(
            mode === "arena"
              ? `매칭되는 아레나 시트를 찾지 못했습니다.\n` +
                  `시즌·본인 기수·이름이 정확한지, 운영자가 아레나 명단(${effectiveCohort})에 본인을 등록했는지 확인해 주세요.`
              : `매칭되는 시트를 찾지 못했습니다.\n` +
                  `시트 이름이 "세일즈PT_ ${cohort}기 ${name} 수강생 경영일지" 형식인지 트레이너에게 확인해 주세요.`,
          );
        } else if (data.error === "invalid_input") {
          setError(
            mode === "arena"
              ? "시즌·본인 기수·이름을 정확히 입력해 주세요."
              : "기수와 이름을 정확히 입력해 주세요.",
          );
        } else if (data.error === "unauthenticated") {
          router.push("/");
          return;
        } else {
          setError(`오류가 발생했습니다: ${data.error ?? "unknown"}`);
        }
        setLoading(false);
        hide();
        return;
      }
      // 성공: 루트로 보내 app/page.tsx 의 role 기반 라우팅에 위임.
      // **full reload (window.location)** — RSC payload 캐시를 완전히 우회.
      // (2026-05-13 사고: router.push 후 옛 payload 로 /claim 재튕김.)
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      setLoading(false);
      hide();
    }
  }

  const inputCls =
    "w-full appearance-none rounded-xl border-[1.5px] border-gray-200 bg-white px-4 text-[15px] font-semibold text-gray-900 outline-none focus:border-brand-red focus:ring-4 focus:ring-red-100";

  return (
    <main className="relative min-h-dvh bg-white">
      {/* subtle bg */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(215,22,23,0.06) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 80% 30%, rgba(255,107,107,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col px-6 pt-10 pb-8">
        {/* 작은 로고 */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/salespt-logo.png"
            alt="세일즈PT"
            className="mx-auto h-9 w-auto"
          />
        </div>

        <div className="mt-8 text-center">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            거의 다 왔습니다
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {mode === "arena"
              ? "시즌·본인 기수·이름을 입력해 주세요."
              : "기수와 본인 이름을 입력해 주세요."}
          </p>
        </div>

        {/* 모드 토글 */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1">
          {(
            [
              ["cohort", "수강생"],
              ["arena", "아레나"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`h-9 rounded-full text-sm font-bold transition-colors ${
                mode === m
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-7 space-y-5">
          {mode === "cohort" ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                기수
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={3}
                placeholder="기수를 입력하세요"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                pattern="^(\d+|[Tt])$"
                className={inputCls}
                style={{ height: 52 }}
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                  시즌
                </label>
                <div
                  className="flex items-center rounded-xl border-[1.5px] border-gray-200 bg-white pl-4 focus-within:border-brand-red focus-within:ring-4 focus-within:ring-red-100"
                  style={{ height: 52 }}
                >
                  <span className="text-[15px] font-extrabold text-gray-400">
                    A
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="1"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="h-full w-full appearance-none bg-transparent px-2 text-[15px] font-semibold text-gray-900 outline-none"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                  본인 기수
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="1"
                  value={gisu}
                  onChange={(e) => setGisu(e.target.value)}
                  className={inputCls}
                  style={{ height: 52 }}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              본인 이름
            </label>
            <input
              type="text"
              placeholder={
                mode === "arena"
                  ? "본인 성명을 입력하세요"
                  : "수강생 성명을 입력하세요"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              style={{ height: 52 }}
              autoComplete="off"
            />
          </div>

          {mode === "arena" ? (
            <div className="space-y-2">
              {arenaCohort && (
                <p className="text-sm font-bold text-brand-red">
                  → {arenaCohort} {name.trim() || "이름"}
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-gray-400">
                아레나 참가자는 시즌(A1)·본인 기수·이름을 넣어주세요. 본인 아레나
                시트와 자동 연결됩니다.
                <br />
                <span className="text-gray-600">
                  (시트 이름:{" "}
                  <code className="rounded bg-gray-100 px-1 text-[10px] text-gray-700">
                    세일즈PT_A시즌_기수기 이름_대표님 경영일지
                  </code>
                  )
                </span>
              </p>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-gray-400">
              본인 수강생 시트와 자동 연결됩니다.
              <br />
              <span className="text-gray-600">
                (시트 이름:{" "}
                <code className="rounded bg-gray-100 px-1 text-[10px] text-gray-700">
                  세일즈PT_ 기수 이름 수강생 경영일지
                </code>
                )
              </span>
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1" />

        <button
          type="button"
          disabled={!valid || loading}
          onClick={handleSubmit}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 text-[15px] font-bold text-white shadow-md transition-all hover:bg-black hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:shadow-none"
          style={{ height: 56 }}
        >
          {loading ? "연결 중..." : "경영일지 시작하기 →"}
        </button>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="mt-2 w-full py-2 text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
        >
          다른 Google 계정으로 로그인
        </button>
      </div>
    </main>
  );
}
