> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: gcal 라우트가 durable 관찰 채널을 우회해 "무음실패"(resync 500이 로그·PostHog에 0줄)를 낳던 관찰성 구멍의 진단·수리 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: gcal 트랙(app/api/gcal/**), lib/analytics/api-timing.ts, VPS pm2 로깅
> - **읽고 나면 알 수 있는 것**: 왜 gcal 실패가 안 보였나 / 무엇을 고쳤나(app-level) / 아직 안 풀린 인프라 잔여는 무엇인가
> - **관련 문서**: docs/plans/active/google-calendar-sync.md(Log 2026-07-12), docs/incidents/2026-07-09-deploy-connection-drop-site-down.md, docs/plans/active/db-migration-pilot.md §1(api-timing)

# 2026-07-12 · gcal 라우트 관찰성 구멍 (무음실패)

## 증상 (원본 카나리아 세션 관찰)
- VPS pm2 out 로그(`salespt-log-out-0.log`)가 배포 후 몇 분이 지나면 아무것도 안 찍힘.
- gcal `resync` 500 같은 라우트 크래시조차 **로그 0줄** → gcal 동기화 실패를 로그로 잡을 수 없는 상태.

## 진단 (DevB, 코드 실측)
두 개의 독립된 구멍이었다.

1. **gcal 라우트 6개 전부 `withApiTiming` 미적용** (근인).
   - `app/api/gcal/{route,auth,callback,resync,states,toggle}` — 전부 bare `export async function`.
   - 반면 나머지 ~60개 라우트는 전부 `withApiTiming(route, handler)` 사용.
   - `withApiTiming`은 핸들러를 try/catch로 감싸 **status(500 포함)를 구조화 `console.log` + PostHog
     `api_timing` 이벤트로 캡처**한다(`lib/analytics/api-timing.ts:64`, catch→status=500→finally에서 캡처→re-throw).
   - 즉 gcal만 이 durable 채널을 통째로 우회 → gcal 500은 pm2 로그에도(침묵 시), PostHog에도 안 남음.
2. **callback의 OAuth 연결 실패가 조용히 삼켜짐**.
   - `app/api/gcal/callback/route.ts`는 `completeGcalConnect` 실패를 `catch {}`로 잡아 `?gcal=error`
     리디렉션(307)으로 반환 → 라우트 상태는 "성공"처럼 보이고 로그 0줄. #519 localhost 복귀 버그가 살던 경로.

핵심: **PostHog(`captureServerEvent`)는 pm2 로그 파일과 무관한 HTTP 채널**이다(`api-timing.ts:35`,
프로덕션에서만 발화, 비-PII). 이 채널에 얹으면 pm2 로그가 침묵해도 gcal 실패가 보인다.

## 수리 (chore/gcal-route-telemetry — app-level, 무동작변화)
- gcal 라우트 6개(핸들러 8개: GET/POST/DELETE 포함) 전부 `withApiTiming("api/gcal…:METHOD", handler)`로 래핑.
  route 문자열은 파일경로 기반 상수(동적 세그먼트·PII 없음).
- callback catch에 `captureServerEvent("gcal_connect_error", { stage:"callback", error:<에러클래스명> })`
  1줄 추가(비-PII). 삼킨 OAuth 실패가 durable 채널에 남는다.
- withApiTiming은 catch 후 **re-throw**하므로 상태코드·응답·동작 전부 보존. 계측만 추가.

### 관찰 방법 (수리 후)
- PostHog Insights → 이벤트 `api_timing`, `route` breakdown → `route` prefix `api/gcal`, `status=500` count.
- OAuth 연결 실패: 이벤트 `gcal_connect_error` count(+`error` 속성으로 에러 유형 분포).

## 잔여 (미해결 — VPS 접근 필요, belie/DevE 구역 근접)
- **pm2 out 로그가 배포 몇 분 후 완전 침묵하는 인프라 원인**은 미규명. 후보: pm2 로그 로테이션/버퍼링,
  Next.js standalone 로그 스트림, cluster 워커 로그파일 교체(reload 시). 코드로 재현 불가 — VPS에서
  `pm2 describe salespt-log`(out/error 파일 경로·로테이션), `pm2 logs`, logrotate 설정 확인 필요.
- 이 잔여는 배포/pm2 설정 영역이라 **DevE(deploy.yml·playbooks) 구역과 근접** — 실제 수정 시 DevE와 조율.
- 단, app-level 수리로 gcal 관찰은 **pm2 로그 신뢰성과 독립**해졌으므로(PostHog durable) 이 잔여의 긴급도는 하락.

## Hashimoto 교훈
- 새 라우트 계열을 추가할 때 `withApiTiming` 래핑을 빠뜨리면 그 계열 전체가 관찰 사각지대가 된다.
  → 후보 가드레일: "app/api/**/route.ts의 export된 GET/POST/… 핸들러는 withApiTiming 경유" 구조 테스트.
  (이번 PR엔 미포함 — 별도 하네스 PR로 제안. 지금 넣으면 scope 초과.)
