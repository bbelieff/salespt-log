> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: BBE-242 처방2 — PostHog `init()`을 모듈로드 즉시에서 `window load` 이후로 지연해 초기 페이지 로딩과의 리소스 경쟁을 제거.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/providers.tsx`, `lib/analytics/index.ts`
> - **읽고 나면 알 수 있는 것**: 왜 지연 로딩이 필요한지 / 이벤트 유실을 어떻게 막았는지 / 전후 실측 수치
> - **관련 문서**: BBE-242 「전천후 균일한 빠른 로딩」통합 보고서(Linear 코멘트, 2026-08-27)

---

slug: bbe242-posthog-lazy-load
status: active
created: 2026-08-27
owner: 경영일지 데탑 C작업원C — belie 집행 배차(처방2)
related: BBE-242, BBE-75

## 0. Scope

A 의 통합 로딩보고서(BBE-242, 2026-08-27) 처방2: `app/providers.tsx`의 `posthog.init()`
즉시실행을 GA 방식(화면 다 뜬 뒤 로딩)으로 전환. 실측(A, 브라우저 직접측정): 페이지 완전
로딩까지 5~13초, 그중 PostHog 하위 스크립트 5개가 각 0.7~2.3초 걸리며 초기 로딩과 경쟁.
요건: 기능 무손실(이벤트 유실 없게 초기 버퍼링) + 전/후 완전 로딩 시간 비교 + §6.8.

## 1. Gather

`app/providers.tsx`의 `posthog.init()`은 모듈 로드 시점(브라우저+운영+키 존재 조건)에
동기 실행된다. `lib/analytics/index.ts`의 모든 export(`track`/`identifyUser`/`resetUser`/
`markInternal`/`clearInternal`/`trackApiError`)는 `ready()`(`posthog.__loaded` 체크)가
false 면 **그냥 no-op**한다 — 이 설계는 원래 "로컬/개발 환경(init 자체가 안 됨)에서 안전"
하려는 의도(파일 상단 주석에 명시)였는데, init 을 지연시키면 **운영 환경에서도** init 완료
전 호출이 같은 경로로 조용히 드롭된다 — 이벤트 유실. 요건("기능 무손실")을 지키려면 버퍼링이
필요하다.

**"화면 다 뜬 뒤" 정의**: 브라우저 `load` 이벤트(이미지·폰트 등 전 리소스 로딩 완료) —
`next/script`의 `strategy="lazyOnload"`가 내부적으로 쓰는 것과 같은 신호. GA 는 보통 이
패턴으로 로드된다(보고서의 비교 대상).

## 2. Solve

- `app/providers.tsx`: `posthog.init()` 호출을 `initPostHog()` 함수로 감싸고,
  `document.readyState === "complete"`(이미 로딩 끝난 뒤 마운트되는 경우 — 클라이언트
  네비게이션 등)면 즉시, 아니면 `window.addEventListener("load", initPostHog, {once:true})`
  로 지연. `posthog.init()`의 `loaded` 콜백(SDK 내부적으로 `__loaded=true` 설정 **후** 호출
  — `ready()` 체크와 타이밍 일치)에서 버퍼 flush.
- `lib/analytics/index.ts`: 기존 `if (!ready()) return;` 패턴을 `runOrQueue(fn)`으로 교체.
  `eligibleForInit()`(운영+키 존재, providers.tsx 의 init 판정 조건과 동일)이 true 인데
  아직 `ready()`가 아니면(=지연 대기 중) 큐잉, false 면(개발환경 등, 영원히 init 안 됨)
  기존처럼 즉시 버림 — 큐가 무한정 쌓이는 걸 방지. flush 는 FIFO(원래 순서 보존).
- `vitest.config.ts`: 테스트 작성 중 발견한 사전 존재 갭 — `tsconfig.json`의 `@/analytics`
  정확매칭 별칭이 vitest alias 목록엔 없어(`@/types`·`@/config`·`@/service`는 있었음)
  `@/analytics`를 import 하는 테스트가 엉뚱한 경로(`<root>/analytics`)로 풀렸을 것 — 이번에
  `lib/analytics/index.test.ts`를 처음 추가하며 직접 걸림, 1줄로 수정.

## 3. Verify

- **단위테스트**(`lib/analytics/index.test.ts`, 4건): init 대기 중 호출 버퍼링→flush 시
  순서보존 확인 / 개발환경(비대상)은 여전히 즉시 no-op / 이미 ready 면 버퍼 없이 즉시실행 /
  email 빈값 가드 보존. **자기검증**: 버퍼링 코드를 되돌려(`git stash`) 재실행 →
  `flushPendingAnalytics is not a function`으로 3/4건 즉시 실패 확인 → 원복 후 4/4 통과
  재확인(진짜로 잡는 테스트임을 증명).
- **전/후 완전 로딩 시간**(브라우저 Performance API, 프로덕션 `salesptlog.online` 직접측정):

  | | before(즉시init, 배포 `6e77f8e`) | after(지연init, 배포 후 갱신) |
  |---|---|---|
  | `loadEventEnd`(완전 로딩) | **1659ms** | (§6.8 배포 후 갱신) |
  | PostHog `config.js` | 970~1616ms(641ms 소요, 페이지 로딩 시간과 정확히 겹침) | (배포 후 갱신) |
  | PostHog 하위스크립트 6개 시작 시점 | 970~975ms(초기 로딩 중) | (배포 후 갱신 — `load` 이후로 밀림 예상) |

## 4. 남은 항목

- ⚠️ **알려진 트레이드오프**(수용): `capture_exceptions`(JS 예외 자동수집)는 PostHog SDK
  내부 리스너라 init 전 발생한 예외는 캡처 안 됨 — 우리 버퍼로 못 막는 범위(SDK 내부 hook).
  `load` 이벤트는 보통 페이지진입 후 수백ms~수 초 내라 그 사이 예외는 드물 것으로 판단.
- 배포 후 재측정치를 이 문서 §3 표에 채워 완료로 전환.

## Log
- **2026-08-27 착수**: 구현·단위테스트·before 실측 완료. 배포·after 실측 진행 중.
