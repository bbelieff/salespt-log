/**
 * Layer: service — spreadsheetId → bundle(profile + dates + stats) 캐시.
 * me.ts 500줄 cap 분리(users.ts/users-rows.ts 와 동일 컨벤션) — readBundle 소비처는
 * me.ts 그대로.
 *
 * stale-while-revalidate 캐시 (BBE-249). 시트 B3/C3/O1/O2 변경은 매우 드물고
 * (수강 시작 시 1회) 페이지 전환 시 매번 다시 읽으면 헤더 표시 지연 주범 +
 * Sheets API quota (60 reads/min/user) 압박.
 *
 * **2026-05-13 quota 사고**: /admin/users 진입 시 23 trainee 시트 read. cache 60s +
 * admin 새로고침 빈번 + PM2 restart 시 cache 비움 → 분당 60 read 한도 초과 → 500
 * "Quota exceeded for Read requests per minute per user". 캐시 60s→600s(10분)로
 * 완화했지만 **동일 패턴이 BBE-244(2026-08-20)로 재발** — TTL 은 요청을 줄여도
 * "만료 직후 N명 콜드 버스트"를 없애지 못했다(같은 배치가 같은 시각에 만료해
 * 10분마다 재발 + 배포마다 재발, pm2 reload 로 이 메모리 캐시가 비므로).
 *
 * 이번 수정 — TTL 캐시를 **SWR(stale-while-revalidate)** 로 교체:
 *   - age < FRESH(10분)  → 캐시값 즉시 반환, 통신 0회.
 *   - FRESH ≤ age < GRACE(30분) → **캐시값(약간 낡음) 즉시 반환** + 백그라운드
 *     갱신 1회(비차단, in-flight 중복 방지) — 페이지 로드가 시트 read 를 기다리지
 *     않는다. N명이 동시에 이 구간에 들어와도 페이지는 즉시 뜨고, 갱신은
 *     pMapBundle 동시성 제한 없이도 이미 순차 도착이라 quota 부드럽게 소비.
 *   - age ≥ GRACE(또는 최초 조회) → 보여줄 값이 없어 동기 fetch(불가피, 기존과 동일).
 * 순수 in-memory Map — 페이지·PM2 재시작 시 비워지는 것은 이전과 동일(불변식 유지),
 * 다만 GRACE 안에서는 재시작 직후에도 **일단 옛 값이라도** 있으면 그걸 쓴다(재시작
 * 직후 최초 방문자만 예외적으로 콜드 fetch).
 * JSON 직렬화를 더 이상 거치지 않으므로(순수 in-memory) 2026-05-13의 "Date→string
 * 복원 사고"(unstable_cache 직렬화 특성) 클래스 자체가 사라진다 — ms 우회 불필요.
 */
import { readProfileBundle } from "@/repo/sales";

const FRESH_MS = 600_000; // 10분 — 기존 TTL 과 동일(신선 판정)
const GRACE_MS = 30 * 60_000; // 30분 — 이 안이면 무조건 즉시 응답(약간 낡아도)
type Bundle = Awaited<ReturnType<typeof readProfileBundle>>;
interface BundleEntry { value: Bundle; fetchedAt: number; refreshing: boolean }
const bundleCache = new Map<string, BundleEntry>();
const bundleInFlight = new Map<string, Promise<Bundle>>();

/** 계측 전용(BBE-249) — 실제 시트 read(캐시 미스·백그라운드 갱신 포함) 횟수. 테스트/측정용. */
let _sheetBundleFetchCount = 0;
export function _resetSheetBundleFetchCount(): void {
  _sheetBundleFetchCount = 0;
}
export function _getSheetBundleFetchCount(): number {
  return _sheetBundleFetchCount;
}
/** 테스트 전용 — 캐시 상태 초기화(테스트 간 격리). */
export function _resetBundleCacheForTest(): void {
  bundleCache.clear();
  bundleInFlight.clear();
}

/** 실제 시트 read 1건 — in-flight 중복 호출을 같은 Promise 로 묶는다(부부/멀티계정이
 * 같은 spreadsheetId 를 동시에 조회할 때 API 호출 2배 방지, users-claim.ts 참고). */
async function fetchBundle(spreadsheetId: string): Promise<Bundle> {
  const inFlight = bundleInFlight.get(spreadsheetId);
  if (inFlight) return inFlight;
  const p = (async () => {
    _sheetBundleFetchCount++;
    return readProfileBundle(spreadsheetId);
  })();
  bundleInFlight.set(spreadsheetId, p);
  try {
    return await p;
  } finally {
    bundleInFlight.delete(spreadsheetId);
  }
}

/**
 * spreadsheetId 의 bundle 을 백그라운드로 미리 데운다(BBE-242 설계서 보강 — 개별 상세
 * 진입 프리페치, fire-and-forget). 호출자를 기다리게 하지 않는다 — 실패해도 예외를
 * 던지지 않고 삼킨다(다음 실제 readBundle 호출이 그대로 재시도).
 *
 * 용도: `/api/admin/switch`(impersonation 전환)가 대상 학생 화면을 새 탭으로 열기
 * **직전에** 호출 — 새 탭이 뜨기까지 걸리는 시간(TCP+TLS+HTML+hydrate) 동안 서버가
 * 미리 이 캐시를 채워두면, 새 탭의 `/api/me`(loadMe→readBundle) 가 도착했을 때
 * 이미 FRESH 이거나 최소한 같은 in-flight Promise 를 공유해 중복 fetch 를 피한다.
 */
export function warmBundle(spreadsheetId: string): void {
  if (!spreadsheetId) return;
  void readBundle(spreadsheetId).catch((e) => {
    console.warn(`[me] warmBundle 실패(spreadsheetId=${spreadsheetId}):`, e instanceof Error ? e.message : e);
  });
}

/** spreadsheetId → bundle. SWR 판정 — 위 파일 docblock 참고. */
export async function readBundle(spreadsheetId: string): Promise<Bundle> {
  const entry = bundleCache.get(spreadsheetId);
  const now = Date.now();
  if (entry) {
    const age = now - entry.fetchedAt;
    if (age < FRESH_MS) return entry.value;
    if (age < GRACE_MS) {
      if (!entry.refreshing) {
        entry.refreshing = true;
        void fetchBundle(spreadsheetId)
          .then((v) => bundleCache.set(spreadsheetId, { value: v, fetchedAt: Date.now(), refreshing: false }))
          .catch((e) => {
            entry.refreshing = false; // 실패 — 옛 값 유지, 다음 호출이 재시도
            console.warn(`[me] 백그라운드 bundle 갱신 실패(spreadsheetId=${spreadsheetId}):`, e instanceof Error ? e.message : e);
          });
      }
      return entry.value; // stale-but-serve
    }
    // age ≥ GRACE — 아래 동기 fetch 로 폴백.
  }
  const v = await fetchBundle(spreadsheetId);
  bundleCache.set(spreadsheetId, { value: v, fetchedAt: now, refreshing: false });
  return v;
}
