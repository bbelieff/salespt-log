> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: GitHub #882(어드민 즉시오픈) 설계서 보강분 — 목록→학생클릭→피드백 개별 상세 진입 시 그 학생 데이터를 서버측에서 미리 데워 새 탭이 즉시 채워지게 한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/api/admin/switch/route.ts`, `lib/service/profile-bundle-cache.ts`
> - **읽고 나면 알 수 있는 것**: 왜 클라이언트 prefetch(router.prefetch/queryClient.prefetchQuery)가 아니라 서버측 warm-up으로 구현했는지 / 전후 실측
> - **관련 문서**: GitHub #882, Linear BBE-242 코멘트(설계서 원문 — 레포에 없음, `docs/worklog.md` 2026-08-27 항목에 요지 복원)

---

slug: admin-detail-warm-bundle
status: active
created: 2026-08-27
owner: 경영일지 데탑 C작업원C — belie 직접 배차(A 설계서 보강분 「개별 상세 프리페치」)
related: #882, #889

## 0. Scope

belie 동선("목록 → 학생 클릭 → 피드백")의 개별 상세 진입 구간. A 설계서 보강 코멘트(2026-08-27
04:26, BBE-242)가 제안한 처방: 카드 클릭(또는 hover) 시 대상 학생 데이터를 미리 요청 시작해,
새 화면이 열렸을 때 이미 데이터가 준비돼 있게 한다. B의 admin/users 목록 Suspense 레인
(`app/admin/users/page.tsx` 등)과 파일 겹침 없음(사전 확인, #882 코멘트에 명시) — 병렬 진행,
머지는 B 먼저 권장(같은 admin 영역, dispatch 지시).

## 1. Gather — 설계서와 실제 코드의 불일치 발견

설계서는 "카드 클릭(또는 hover) 시점에 `router.prefetch(대상경로)` + React Query
`prefetchQuery`로 대상 학생 데이터를 미리 요청 시작"을 제안했다. 그런데 실제 클릭 핸들러
(`AdminUserPicker.tsx:324-337` `pick()`, `TrainerCohortView.tsx:83-95` 동일 패턴)는
`router.push`가 아니라 **`window.open('/dashboard', '_blank', 'noopener,noreferrer')`로
새 브라우저 탭을 연다.** 새 탭은 원본(admin) 탭과 완전히 분리된 JS 실행 컨텍스트 —
`app/providers.tsx`가 매 탭마다 새 `QueryClient` 인스턴스를 만들기 때문에, 원본 탭에서
`queryClient.prefetchQuery()`를 호출해도 새 탭의 (별개) QueryClient 캐시에는 아무 영향이
없다. `router.prefetch()`도 마찬가지로 Next.js 클라이언트 라우터 캐시는 탭(페이지 인스턴스)
scope라 새 탭의 최초 로드에는 적용 안 됨. 설계서가 제안한 메커니즘 자체가 이 아키텍처에서는
작동하지 않는다(검증 없이 그대로 구현했다면 눈에 보이는 효과가 0이었을 것).

**실제 콜드 경로**: `/api/admin/switch`(impersonation 전환) → 새 탭이 `/dashboard` 로드
→ 그 탭의 `/api/me`(`loadMe()`, `lib/service/me.ts:374`) → `readBundle(user.spreadsheetId)`
(`lib/service/profile-bundle-cache.ts`, SWR 10분/30분) — 이 이름·기수·시작일·종강일이
10분 이상 아무도 안 봐서 콜드면(GRACE 밖) 이 시점에 시트 read 가 동기로 발생.

## 2. Solve

설계 의도(대상 데이터를 새 화면이 요청하기 전에 미리 준비)는 유지하되, 메커니즘을 서버측으로
옮긴다: `/api/admin/switch` 라우트 자체가 대상 확정 직후(권한검사 통과, `user.spreadsheetId`
확보) `warmBundle(user.spreadsheetId)`(신규, `profile-bundle-cache.ts`)를 **await 없이**
호출한다. 이 요청의 응답이 클라이언트로 가는 동안, 그리고 새 탭이 열려 TCP+TLS+HTML+hydrate를
거쳐 자기 `/api/me`를 호출할 때까지의 시간 동안 서버는 이미 그 학생의 bundle을 데우고 있다 —
새 탭의 `readBundle` 호출이 도착했을 때 ①이미 FRESH면 통신 0회 ②아직 진행 중이면
`fetchBundle`의 기존 in-flight dedup(부부/멀티계정 공유용으로 이미 있던 메커니즘)에 자동으로
합류해 중복 fetch 없이 그 Promise를 공유한다.

`window.open`을 `router.push`(같은 탭 네비게이션)로 바꾸는 대안은 **채택 안 함** — 기존
"admin/users 탭 그대로 유지"라는 명시적 설계 의도(주석 2026-05-17)를 깨는 더 큰 변경이고,
이번 배차 스코프(개별 상세 진입 속도) 밖.

hover 기반 사전 워밍(설계서 대안)도 **채택 안 함** — 이 시스템은 Sheets API quota 사고
이력이 반복적으로 있고(2026-05-13, BBE-244 등), 목록을 스크롤하며 지나가는 모든 카드에
hover마다 fetch를 쏘면 클릭 안 할 카드까지 quota를 소비한다. 클릭 시점 워밍만으로도
"스위치 API 응답 시간 + 새 탭 스핀업 시간"이라는 유효한 리드타임이 이미 확보된다.

## 3. Verify

- **단위테스트**(`tests/service/profile-bundle-cache.test.ts`, `warmBundle` 4건 추가) —
  즉시 반환+백그라운드 데움 / 빈 spreadsheetId 가드 / 실패해도 안 던짐+다음 호출 정상 재시도 /
  동시 호출 in-flight dedup. **자기검증**: `warmBundle` 구현을 되돌려(`git stash`) 재실행 →
  4/4 즉시 실패(`warmBundle is not a function`) 확인 → 원복 후 11/11 재통과 확인.
- **전/후 개별 진입 실측**: §6.8 배포 후 갱신(카드 클릭 → 그 학생 숫자까지 걸리는 시간,
  콜드 조건에서 브라우저 직접측정).

## 4. 남은 항목

- 배포 후 실측치를 이 문서에 채운다.
- 머지는 B(#882 목록 Suspense 레인) 이후로 미룬다(dispatch 지시, 같은 admin 영역 —
  파일 겹침은 없지만 순서 권장 준수).

## Log
- **2026-08-27 착수**: 설계서-코드 불일치 발견(window.open 새 탭) → 서버측 warm-up으로 방향
  전환, 구현·단위테스트 완료. 배포는 B 머지 후.
