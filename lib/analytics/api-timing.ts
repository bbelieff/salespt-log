/**
 * Layer: analytics (서버 전용 — posthog-js import 없음. 레이어 규칙·doc-drift 비대상)
 *
 * API 서버 처리시간 계측 (db-migration-pilot §1 P0 — 이전 효과 증명용 기준선).
 *   - withApiTiming(route, handler): 라우트 전체 ms + Sheets 호출 구간(sheets_ms/
 *     sheets_calls) 분리 측정 → 콘솔 구조화 로그(JSON 1줄) + PostHog `api_timing`
 *     이벤트(fire-and-forget HTTP capture, posthog-node 의존성 없음). 샘플링 100%.
 *   - recordSheetsCall(ms): lib/repo/sheets-client 의 429-retry shadow 가 호출 —
 *     AsyncLocalStorage 컨텍스트 있을 때만 누적(없으면 no-op, 오버헤드 0에 수렴).
 *   - **민감값 금지**: route 는 파일 경로 기반 상수 문자열만. 파라미터·이메일·
 *     시트ID·본문은 절대 포함하지 않는다.
 * 오버헤드: Date.now 2회 + JSON 1줄 + 비동기 fetch(await 안 함) — 무시 수준.
 * p50/p95 추출: PostHog Insights → Trends → 이벤트 api_timing, 속성 ms 의
 * median/p95 수학집계 + route 로 breakdown (또는 HogQL quantile(0.5|0.95)(ms)).
 */
import { AsyncLocalStorage } from "node:async_hooks";

interface TimingStore {
  sheetsMs: number;
  sheetsCalls: number;
}

const als = new AsyncLocalStorage<TimingStore>();

/** Sheets 호출 1건의 소요를 현재 요청 컨텍스트에 누적 (컨텍스트 밖이면 no-op). */
export function recordSheetsCall(ms: number): void {
  const s = als.getStore();
  if (!s) return;
  s.sheetsMs += ms;
  s.sheetsCalls += 1;
}

/** PostHog HTTP capture — 서버에서 의존성 없이 전송. 실패는 조용히 무시(계측이 앱을 방해 금지). */
function captureApiTiming(props: Record<string, string | number>): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || process.env.NODE_ENV !== "production") return; // 로컬은 콘솔 로그만
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: "api_timing",
      distinct_id: "server", // 사용자 식별 불필요(비-PII 원칙) — 서버 단일 id
      properties: props,
    }),
  }).catch(() => {});
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/**
 * 라우트 핸들러 래퍼 — 전체 처리시간 + Sheets 구간 분리 계측.
 * 사용: `export const GET = withApiTiming("api/daily/[date]:GET", GET_handler);`
 */
export function withApiTiming<A extends unknown[]>(
  route: string,
  handler: Handler<A>,
): Handler<A> {
  return async (...args: A): Promise<Response> => {
    const store: TimingStore = { sheetsMs: 0, sheetsCalls: 0 };
    const t0 = Date.now();
    let status = 0;
    try {
      const res = await als.run(store, () => handler(...args));
      status = res.status;
      return res;
    } catch (e) {
      status = 500;
      throw e;
    } finally {
      const ms = Date.now() - t0;
      const line = {
        t: "api_timing",
        route,
        ms,
        sheets_ms: Math.round(store.sheetsMs),
        sheets_calls: store.sheetsCalls,
        status,
      };
      console.log(JSON.stringify(line)); // pm2 로그에서 grep '"t":"api_timing"'
      captureApiTiming(line);
    }
  };
}
