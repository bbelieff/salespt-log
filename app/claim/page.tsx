/**
 * /claim — Self-claim 화면.
 *
 * 흐름: Google 로그인 후 registry 미등록 사용자가 들어옴.
 * 기수 + 이름 입력 → POST /api/claim → 매칭 시트 자동 연결 → /dashboard.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function ClaimPage() {
  const router = useRouter();
  const [cohort, setCohort] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 수강생: 숫자(기수). 트레이너: "T" 또는 "t" (sheet 검색 건너뜀).
  const valid =
    /^(\d+|[Tt])$/.test(cohort.replace(/기\s*$/, "").trim()) &&
    name.trim().length >= 2;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_found") {
          setError(
            `매칭되는 시트를 찾지 못했습니다.\n` +
              `시트 이름이 "세일즈PT_ ${cohort}기 ${name} 수강생 경영일지" 형식인지 트레이너에게 확인해 주세요.`,
          );
        } else if (data.error === "invalid_input") {
          setError("기수와 이름을 정확히 입력해 주세요.");
        } else if (data.error === "unauthenticated") {
          router.push("/");
          return;
        } else {
          setError(`오류가 발생했습니다: ${data.error ?? "unknown"}`);
        }
        setLoading(false);
        return;
      }
      // 성공: 루트로 보내 app/page.tsx 의 role 기반 라우팅에 위임.
      // (수강생 → /dashboard, 트레이너 pending → /trainer 대기 화면)
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
      setLoading(false);
    }
  }

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
            기수와 본인 이름을 입력해 주세요.
          </p>
        </div>

        <div className="mt-10 space-y-5">
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
              className="h-13 w-full appearance-none rounded-xl border-[1.5px] border-gray-200 bg-white px-4 text-[15px] font-semibold text-gray-900 outline-none focus:border-brand-red focus:ring-4 focus:ring-red-100"
              style={{ height: 52 }}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
              본인 이름
            </label>
            <input
              type="text"
              placeholder="수강생 성명을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full appearance-none rounded-xl border-[1.5px] border-gray-200 bg-white px-4 text-[15px] font-semibold text-gray-900 outline-none focus:border-brand-red focus:ring-4 focus:ring-red-100"
              style={{ height: 52 }}
              autoComplete="off"
            />
          </div>

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
