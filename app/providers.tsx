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
import { SESSION_MASK_PII, trackApiError } from "@/analytics";

// 모듈 로드 시 1회 — 브라우저 + 운영 + 키 존재일 때만 init.
if (typeof window !== "undefined") {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key && process.env.NODE_ENV === "production") {
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
    });
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
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </SessionProvider>
    </PostHogProvider>
  );
}
