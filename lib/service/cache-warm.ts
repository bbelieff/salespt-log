/**
 * Layer: service — 서버 기동·주기 캐시 워밍.
 *
 * ## 왜 필요한가 (2026-08-30 belie 실측 신고)
 * belie 가 앱을 시연하던 중 화면 하나가 한참 안 채워져 민망했다는 신고. 프로덕션에서
 * 직접 재보니 `/admin/users` 가:
 *   · 캐시가 비었을 때 → **40초 넘게 통계가 안 채워짐**(첫 바이트 125ms · 명단 152ms 까지는
 *     정상이라 화면은 떠 있고, 숫자 자리만 계속 도는 상태)
 *   · 캐시가 데워진 뒤 → **261ms 완료**
 * 즉 느린 게 아니라 **"캐시가 빈 순간에 걸린 사람만" 느리다.** 150배 차이.
 *
 * 캐시(`profile-bundle-cache.ts`)는 순수 in-memory Map 이라 **비는 순간이 둘** 있다:
 *   ① **배포할 때마다** — `pm2 reload` 로 프로세스가 갈리면 통째로 사라진다.
 *      (2026-08-30 하루에만 배포 6회 → 그때마다 첫 방문자가 40초를 맞는다)
 *   ② **GRACE(30분) 넘게 아무도 안 들어왔을 때** — 다음 방문자가 콜드 fetch 를 떠안는다.
 *
 * Redis 는 제약상 금지(CLAUDE.md §2.5)라 캐시를 프로세스 밖에 둘 수 없다. 그래서
 * **사람 대신 서버가 먼저 데운다** — 기동 직후 1회 + GRACE 보다 짧은 주기로 반복.
 * 이러면 "캐시가 빈 순간"에 실제 사용자가 걸릴 창이 사라진다.
 *
 * 되돌리는 법: 환경변수 `CACHE_WARM_DISABLED=1` (재배포 불요, 재기동만). 코드를 지울
 * 필요 없다.
 */
import { listDistinctUsers } from "@/repo/users";
import { readBundle } from "./profile-bundle-cache";

/** GRACE(30분)보다 넉넉히 짧게 — 캐시가 만료되기 전에 항상 한 번 더 데운다. */
export const WARM_INTERVAL_MS = 20 * 60 * 1000;
/**
 * 기동 직후 바로 때리지 않는다 — 배포 워크플로의 health 게이트(`/api/health`)와
 * 겹치면 그 판정을 느리게 만들 수 있다(§6.8 자동 롤백 오탐 방지).
 */
export const WARM_START_DELAY_MS = 15 * 1000;
/**
 * 동시 처리 개수. **앱이 같은 작업에 쓰는 값과 맞춘다**(`me.ts:pMapBundle` concurrency 8,
 * BBE-249 — "60명 콜드스타트 시 8 waves × 8 동시로 완주 시간 단축" + Sheets 60 reads/min
 * 한도 보호). 워밍이 페이지 1회 로드보다 세게 때리지 않으므로 쿼터상 새 위험이 없다.
 *
 * ⚠️ 여기를 1(순차)로 되돌리지 마라. 초판이 "1명씩 300ms 간격"이었는데, 실측 결과
 * **활성 수강생이 63명**이라 워밍 한 바퀴가 몇 분씩 걸렸고 — 그 몇 분 동안 들어온
 * 사람은 여전히 느린 화면을 봤다(2026-08-30 배포 직후 1분·2.5분 시점 실측: 40초+ 미완료,
 * 8분 시점: 759ms 완전 로드). 워밍이 느리면 워밍을 안 한 것과 같다.
 */
export const WARM_CONCURRENCY = 8;

/** 워밍 2개가 겹쳐 도는 것 방지 — 앞 회차가 길어지면 이번 회차는 건너뛴다. */
let warming = false;

/**
 * 마지막 워밍 결과 — `/api/health` 가 노출한다(관측 가능성).
 *
 * 왜 필요한가: 2026-08-30 워밍을 넣고도 **실제로 도는지 확인할 방법이 없어** 몇 시간을
 * 태웠다. 로그는 VPS 안에 있어 밖에서 못 본다. "못 보는 것은 못 고친다"(CLAUDE.md §0
 * Observability) — 그래서 상태를 밖으로 내보낸다.
 * ⚠️ `/api/health` 는 공개 엔드포인트라 **값은 안 싣는다**(그 라우트의 기존 원칙과 동일).
 * 인원수 같은 실데이터는 빼고 boolean·소요시간만 남긴다.
 */
let lastWarm: { at: number; ok: number; failed: number; targets: number; ms: number } | null = null;

/** 공개용 요약 — 실데이터(인원수) 없이 "돌았나·언제·얼마나 걸렸나·다 성공했나"만. */
export function getWarmStatus(now: number = Date.now()): {
  enabled: boolean;
  hasRun: boolean;
  ageSec: number | null;
  lastMs: number | null;
  allOk: boolean | null;
} {
  return {
    enabled: shouldWarm(),
    hasRun: lastWarm !== null,
    ageSec: lastWarm ? Math.round((now - lastWarm.at) / 1000) : null,
    lastMs: lastWarm ? lastWarm.ms : null,
    allOk: lastWarm ? lastWarm.failed === 0 && lastWarm.targets > 0 : null,
  };
}

/** 테스트 전용 — 모듈 상태 초기화. */
export function _resetWarmStateForTest(): void {
  warming = false;
  lastWarm = null;
}

export interface WarmResult {
  targets: number;
  ok: number;
  failed: number;
  skipped: boolean;
  ms: number;
}

/**
 * 활성 수강생 전원의 profile bundle 을 미리 읽어 캐시에 채운다.
 * 이미 FRESH 인 항목은 `readBundle` 이 통신 없이 즉시 반환하므로 재워밍은 거의 공짜다.
 */
export async function warmAllTraineeBundles(
  opts: { concurrency?: number } = {},
): Promise<WarmResult> {
  const started = Date.now();
  if (warming) return { targets: 0, ok: 0, failed: 0, skipped: true, ms: 0 };
  warming = true;
  const concurrency = opts.concurrency ?? WARM_CONCURRENCY;
  let ok = 0;
  let failed = 0;
  let targets = 0;
  try {
    const users = await listDistinctUsers();
    const ids = [
      ...new Set(
        users
          .filter((u) => u.role === "trainee" && u.status === "active" && u.spreadsheetId)
          .map((u) => u.spreadsheetId),
      ),
    ];
    targets = ids.length;
    // 워커 풀 — me.ts:pMapBundle 과 동일한 형태(동시 N, 무제한 burst 금지).
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const id = ids[next]!;
        next += 1;
        try {
          await readBundle(id);
          ok += 1;
        } catch {
          // 한 명 실패가 나머지를 막지 않는다 — 그 학생은 다음 회차에 다시 시도된다.
          failed += 1;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
    );
  } catch (e) {
    // 레지스트리 조회 자체가 실패 — 이번 회차 포기. 다음 주기가 재시도한다.
    console.warn(
      "[cache-warm] 대상 목록 조회 실패:",
      e instanceof Error ? e.message : e,
    );
  } finally {
    warming = false;
  }
  const ms = Date.now() - started;
  lastWarm = { at: Date.now(), ok, failed, targets, ms };
  return { targets, ok, failed, skipped: false, ms };
}

/** 워밍을 켤 조건인지. 개발·빌드·명시적 비활성에서는 돌지 않는다. */
export function shouldWarm(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CACHE_WARM_DISABLED === "1") return false;
  // next build 중에도 instrumentation 이 한 번 로드된다 — 빌드가 시트를 때리면 안 된다.
  if (env.NEXT_PHASE === "phase-production-build") return false;
  if (env.CACHE_WARM_FORCE === "1") return true;
  return env.NODE_ENV === "production";
}

/**
 * 기동 직후 1회 + `WARM_INTERVAL_MS` 주기로 워밍을 건다. 서버 프로세스당 1회만 호출.
 * 타이머는 `unref()` — 워밍이 프로세스 종료를 붙잡지 않는다.
 */
export function startCacheWarmLoop(): void {
  if (!shouldWarm()) return;
  const run = () => {
    void warmAllTraineeBundles()
      .then((r) => {
        if (r.skipped) return;
        console.log(
          `[cache-warm] 대상 ${r.targets}명 · 성공 ${r.ok} · 실패 ${r.failed} · ${r.ms}ms`,
        );
      })
      .catch((e) =>
        console.warn("[cache-warm] 실패:", e instanceof Error ? e.message : e),
      );
  };
  setTimeout(run, WARM_START_DELAY_MS).unref?.();
  setInterval(run, WARM_INTERVAL_MS).unref?.();
}
