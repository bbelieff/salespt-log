> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 시트독립 프로그램(BBE-245) 4단계 — 요청 경로가 다시 시트를 부르면 CI가 깨지는 재유입 차단 게이트(정적 화이트리스트 + 동적 실행 검증) 구축 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `tests/structural/sheets-request-path-guard.test.ts`(정적) · `tests/repo/sheets-zero-calls-pilot.test.ts`(동적)
> - **읽고 나면 알 수 있는 것**: 화이트리스트를 왜 이렇게 채웠는지 / A의 BBE-245 설계와 어디서 갈렸는지·왜 / PostHog 축을 왜 못 채웠는지
> - **관련 문서**: BBE-245(`docs/plans/active/db-write-flip.md`), BBE-97 선례(`docs/plans/active/db-write-flip.md` 무관, `tests/structural/sheets-append-guard.test.ts` 그 자체가 선례)

---

slug: bbe251-sheets-request-path-gate
status: completed
created: 2026-08-20
completed: 2026-08-20
owner: 경영일지 데탑 C작업원C(260820) — BBE-245 프로그램 4단계, belie 디스패치
related: BBE-245, BBE-242, BBE-246, BBE-97, BBE-253(우선순위 인터럽트로 중간에 처리)

## 0. Scope

시트독립 4단계: 요청 경로(app/api/**·app/(app)/**)에서 시트 API 를 다시 부르는 코드가
화이트리스트 밖에서 몰래 들어오면 CI 가 깨지게 만든다. ①정적 가드(구조테스트, check.sh 편입)
②동적 실측(파일럿 쓰기 경로 sheets_calls=0) ③화이트리스트 정본화 ④A 의 BBE-245 설계 코멘트
대조. 완주 = 위반 시 CI 깨지는 음성 테스트 + 현재 코드 통과 + check.sh 초록 + §6.8.

## 1. A 의 설계 코멘트 대조

A 가 BBE-245 에 남긴 두 코멘트를 실측 대조:
- **1차(설계)**: BBE-97(`sheets-append-guard.test.ts`) 의 파일 경로 화이트리스트 + grep 구조
  테스트 패턴 재사용 제안 — **그대로 채택**. 4개 사유 태그(R2-비파일럿-폴백/append-제외/
  union-백필-안전망 + 동적축은 별도) 제안 — 채택하되 실측 중 2개 카테고리 추가 필요 확인
  (아래 §2 참고, "어긋나면 이름으로 확인" 조항에 따라 이 문서에 근거 남기고 진행 — A 재확인은
  belie/반장 채널로 별도 요청).
- **2차(정정)**: `lib/analytics/api-timing.ts` 가 이미 존재해 신규 계측 불요, 검증은 **PostHog
  Insights 조회**로 하면 된다는 정정. **실측 확인**: 이 세션도 연결된 PostHog MCP 도구 0개
  (ToolSearch 조회 결과) — A 와 동일한 한계. §3 에서 대체 경로로 코드 레벨 동적 검증을 택함.

## 2. Solve — 정적 가드

`tests/structural/sheets-request-path-guard.test.ts`: BFS 로 app/api/**·app/(app)/** 에서
lib/repo/** 까지 실제 import 그래프를 따라가(alias 해석 포함, layers.test.ts 의 `importsOf`
패턴 재사용) 도달 가능한 저수준 시트 호출(`sheetsClient`/`readRange`/`appendRows`/
`ensureGridColumns`) 파일을 매 실행 재계산 → 화이트리스트 밖이면 실패.

**화이트리스트 도출 방법**: 빈 화이트리스트로 1회 실행(discovery) → 실제 위반 목록을 받음
→ 각 파일의 head doc comment 를 직접 읽고 근거와 함께 분류(추측 등재 금지). 최초 초안은
`lib/service/*` 파일 4개(sales-write.ts·contract-payment-add.ts·gcal-sync.ts·db-old-values.ts)
를 `lib/repo/*` 로 착각해 등재하는 오기가 있었는데, "화이트리스트는 실제 도달 가능+실제 호출
보유 파일만" 을 검증하는 자기검증 테스트가 즉시 잡아냈다(§3 자기검증 참고) — 잘못된 경로라
도달성 0 으로 뜸.

A 의 3개 사유(R2-비파일럿-폴백/append-제외/union-백필-안전망) 로 부족해 2개 추가:
- **비동기-수렴미러**: `queueXxxSync` 류 fire-and-forget 큐 — BBE-246 이 도입한 패턴. 응답
  이후 detached promise 로 실행돼 "요청 경로를 동기로 막지" 않는다. A 의 설계 시점(BBE-246
  머지 직후지만 상세 코드까지는 대조 안 한 것으로 보임)엔 이 패턴이 명시적 카테고리로 없었음.
- **레거시-미전환**: daily-source.ts 게이트(chooseDailySource/chooseWriteSource)를 쓰지만
  아직 파일럿 DB-primary 전환(BBE-246 급)이 안 된 화면(미팅·투두·영업관리·레지스트리 등,
  로드맵 3단계 잔여) — 4단계 시점(2026-08-20) 사실 그대로 등재, **전환될 때마다 항목이 준다
  = 기계검증 가능한 탈피 진행률**(A 의 제안 그대로).
- **시트전용기능**: DB 에 대응 개념이 없어 영구 시트(수식 설치 `setup-formulas.ts`, 대시보드
  `dashboard.ts` — CLAUDE.md: "시트 수식이 계산, 재구현 X").
- **백필-도구**: 정기 요청 경로가 아닌 admin 1회성 마이그레이션 도구(`users-cache-migrate.ts`).

## 3. Solve — 동적 검증

PostHog 접근 불가(§1) 로 카드가 원래 제안한 "api_timing.sheets_calls quantile" 조회는
못 한다 — "모른다"로 명시, belie/PostHog 권한 세션에 이관.

대신 **같은 질문을 코드 레벨에서 실행 시점에 직접 증명**하는 `tests/repo/sheets-zero-calls-pilot.test.ts`
를 신설: `sheets-client.ts` 저수준 export 전부를 모킹하고, BBE-246 이 파일럿 전환한 실제 함수
(`updateUserFields`·`clearRow`·`updatePurchase`)를 `opts.syncDb=true` 로 직접 호출해 그 모킹이
**한 번도 안 불렸음**을 단언. 정적 가드가 못 보는 런타임 분기(`if (opts?.syncDb)`)를 커버.

**★부수 발견(고쳤다고 안 함)**: `clearRow` 는 syncDb 분기 이전에 `resolveLayout()` 을 무조건
호출하는데, 이 함수는 in-process 캐시가 비어 있으면(콜드) 탭 레이아웃 확인을 위해 시트를
1회 읽는다. "파일럿도 시트 호출 0" 은 캐시가 워밍된 뒤에만 참 — 장기 실행 pm2 프로세스에선
사실상 항상 워밍 상태라 실무 영향은 낮지만, 엄밀히는 "완전히 0" 이 아니다. 이 카드 스코프
(게이트 구축)가 아니라 후속 카드 후보로만 남긴다.

## 4. Verify

- `sheets-request-path-guard.test.ts` 4건: 정적 가드 본검사·죽은 등록 방지·음성 테스트 2건.
  **자기검증**: 실제 화이트리스트 항목 1개를 임시로 지우고 실행 → 실제로 실패(잡힘) 확인 후
  원복.
- `sheets-zero-calls-pilot.test.ts` 3건: 파일럿 쓰기 경로(계약 02·DB관리 03) 시트 호출 0회.
  **자기검증**: `updateUserFields` 의 syncDb 분기에 임시로 `sheetsClient()` 호출을 주입 →
  실제로 실패(잡힘, "재유입" 에러 메시지 그대로 출력) 확인 후 원복.
- check.sh 전체 green(typecheck·lint·structural·unit·doc-drift).

## Log
- **2026-08-20 착수**: BBE-253(P0) 인터럽트로 중간에 정지, 완주 후 복귀.
- **2026-08-20 완주**: PR #833(`da6ef5a`) 머지 → 배포 run `32372020765` **success** →
  `https://salesptlog.online` **200**. check.sh 전체 green. 정적 가드 4건·동적 검증 3건
  전부 자기검증(실제 화이트리스트 항목 제거/실제 코드에 시트 호출 주입 → 실패 확인 후 원복)
  완료.
