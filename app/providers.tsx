/**
 * 클라이언트 사이드 프로바이더 트리.
 * - React Query (TanStack Query): 서버 상태 캐싱·뮤테이션
 * - PostHog: 제품분석 (운영 배포 환경에서만 활성)
 *
 * PostHog init 정책 (ADR-0009):
 *   - NODE_ENV==='production' + NEXT_PUBLIC_POSTHOG_KEY 존재 시에만 init.
 *   - 로컬/개발(키 없음)에서는 비활성 → 분석 데이터 오염 방지.
 *   - 세션 리플레이 ON. 마스킹은 SESSION_MASK_PII 플래그로 제어.
 *   - capture_exceptions: JS 예외 자동 수집 → Error Tracking.
 *   - 페이지뷰·클릭·rage click 은 SDK autocapture(defaults)가 자동 처리.
 *   - 쿼리/뮤테이션 실패는 QueryClient 전역 핸들러 → api_error 이벤트.
 *
 * PostHog 지연 로딩 (BBE-242 처방2, 2026-08-27): `posthog.init()`을 모듈 로드 즉시가
 * 아니라 브라우저 `load` 이벤트(=이미지·폰트 등 전 리소스 로딩 완료) 이후로 미룬다 —
 * 실측(A, BBE-242) 상 PostHog 하위 스크립트 5개(세션녹화·자동캡처 등, 각 0.7~2.3초)가
 * 초기 페이지 로딩과 네트워크·기기 자원을 경쟁하고 있었다(GA 는 이미 이 방식으로 로드,
 * PostHog 만 즉시실행이었음). `document.readyState==="complete"`(이미 load 완료 후 마운트
 * — 클라이언트 사이드 네비게이션 등)면 즉시 init. 초기 로딩 완료 전에 발생한 이벤트는
 * `lib/analytics/index.ts` 의 버퍼(`runOrQueue`)가 순서대로 쌓아뒀다가 `loaded` 콜백에서
 * `flushPendingAnalytics()`로 전부 내보낸다 — 이벤트 유실 없음.
 * ⚠️ 알려진 트레이드오프: `capture_exceptions`(JS 예외 자동수집)는 PostHog SDK 내부
 * 리스너라 init 전에 발생한 예외는 이 지연으로 인해 캡처되지 않는다(버퍼로 못 막는
 * 범위 — 우리 코드가 아니라 SDK 내부 hook). load 이벤트는 보통 페이지 진입 후 수백ms~
 * 수 초 내로, 그 사이 발생하는 예외는 드물 것으로 판단해 수용.
 */
"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { SESSION_MASK_PII, flushPendingAnalytics, trackApiError } from "@/analytics";
import { LoadingProvider } from "@/components/ui/LoadingProvider";

// 모듈 로드 시 1회 — 브라우저 + 운영 + 키 존재일 때만, `load` 이벤트 이후로 지연 init.
if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key && process.env.NODE_ENV === "production") {
    const initPostHog = () => {
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        defaults: "2026-01-30", // SPA 페이지뷰·pageleave·autocapture 권장 기본값
        person_profiles: "identified_only", // 익명 트래픽은 프로필 생성 안 함
        capture_exceptions: true, // JS 예외 → $exception (Error Tracking)
        session_recording: {
          maskAllInputs: SESSION_MASK_PII,
          maskTextSelector: SESSION_MASK_PII ? "*" : undefined,
          maskInputOptions: { password: true }, // 비밀번호는 항상 마스킹
        },
        loaded: () => flushPendingAnalytics(), // 지연 대기 중 버퍼링된 이벤트 flush
      });
    };
    if (document.readyState === "complete") {
      initPostHog();
    } else {
      window.addEventListener("load", initPostHog, { once: true });
    }
  }
}

function resourceOf(key: unknown): string | undefined {
  return Array.isArray(key) && key.length > 0 ? String(key[0]) : undefined;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // 전역 에러 캡처 — 모든 쿼리/뮤테이션 실패를 api_error 로 기록.
        queryCache: new QueryCache({
          onError: (error, query) =>
            trackApiError("query", error, {
              resource: resourceOf(query.queryKey),
            }),
        }),
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) =>
            trackApiError("mutation", error, {
              resource: resourceOf(mutation.options.mutationKey),
            }),
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30초 — 시트는 자주 안 바뀜
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );
  return (
    <PostHogProvider client={posthog}>
      <SessionProvider>
        <QueryClientProvider client={client}>
          <LoadingProvider>{children}</LoadingProvider>
        </QueryClientProvider>
      </SessionProvider>
    </PostHogProvider>
  );
}
