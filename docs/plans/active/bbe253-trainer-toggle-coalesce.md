> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: MASTER 수강생 관리 「담당 트레이너 토글」을 연타할 때 체크가 저절로 풀리거나(롤백) 로딩이 길어지던 문제를 좌표(coalesce) 큐로 수리한 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `/admin/trainers` 담당 배정 UI (`TrainerAssignCard`·`TrainerMgmtPanel`), `lib/util/save-coalesce.ts`(BBE-243 확장)
> - **읽고 나면 알 수 있는 것**: 롤백이 왜 났는지(정확한 기전 2가지) / 무엇을 바꿨는지 / 왜 서버(assign-trainee route)는 안 건드렸는지
> - **관련 문서**: BBE-243(`docs/plans/completed/bbe243-rapid-input-fix.md`) — 같은 계열, 같은 유틸 재사용

---

slug: bbe253-trainer-toggle-coalesce
status: active
created: 2026-08-20
owner: 경영일지 데탑 C작업원C(260820) — belie 직배차 P0
related: BBE-243, BBE-249, BBE-251

## 0. Scope

belie 폰 실측(20:11): MASTER 수강생 관리 화면에서 담당 트레이너 체크박스를 빠르게 여러 개
누르면 ①체크가 저절로 풀림(롤백처럼 보임) ②로딩이 길어짐. BBE-243("연타·빠른 다중 입력")과
같은 계열 — 그 패턴(좌표/직렬화·마지막 입력 보존)을 재사용해 고치라는 지시.
경계: 담당 토글 입력·저장 경로 한정(BBE-249 의 `/admin/users` N+1, BBE-251 의 시트 CI 가드는
별개 카드 — 겹치면 반납).

## 1. Gather — 재현·근인

`app/api/admin/assign-trainee/route.ts` 는 학생의 담당 목록을 **통째로 교체**한다(delta 아님,
`setTraineeAssignments(trainee, trainerEmails)` → registry G 컬럼 전체 덮어쓰기). 동시성 제어
(락·버전·멱등키) 없음 — 서버 도착 순서대로 last-write-wins.

클라이언트 쪽 코드(`components/auth/TrainerAssignCard.tsx`)를 실측한 결과 두 가지 진짜 원인을
찾음(추측 아님, 코드 근거):

**원인 ①(유실) — stale 기준으로 next 계산**: `toggle()`(구 코드, :99)이
`const current = parseAssigned(t.assignedTrainer)` 로 서버가 마지막으로 확정한 값(=아직
`router.refresh()` 전이면 stale)을 기준으로 다음 상태를 계산했다. 같은 학생을 (같은 체크박스
연타든, 다른 트레이너 카드에서든) 응답이 오기 전에 두 번 건드리면 두 번째 계산이 첫 번째
변경을 반영 안 된 옛 base 로 계산 → 서버로 보내는 최종 목록이 첫 번째 변경을 덮어씀(유실).

**원인 ②(롤백 플래시) — 무관한 학생의 refresh 가 내 optimistic 을 지움**:
`useEffect(() => setOptimistic(new Map()), [trainees])`(구 코드) 가 **아무** 학생의 저장
완료(→`router.refresh()`)든 `trainees` prop 참조가 바뀌면 옵티미스틱 표시를 전부 지웠다.
학생 A 의 저장이 아직 안 끝났는데 학생 B 의 저장이 먼저 끝나 refresh 가 오면, A 의 optimistic
표시도 같이 지워져 화면이 서버의 **옛(아직 A 를 반영 안 한)** 값으로 잠깐 돌아간다 — 이것이
"체크가 저절로 풀림"의 실제 기전이다(서버 실패로 인한 revert 가 아니라, 클라이언트 표시
로직의 조기 초기화).

`updateUserCell`(`lib/repo/users.ts:179-`)이 매 토글마다 레지스트리 시트 **전체를 읽고**(1
셀만 쓰기 전에 read) 쓰는 구조라 "로딩 장기화"의 근원도 확인 — 다만 이건 서로 다른 학생을
동시에 여러 명 배정할 때(예: 일괄 선택)는 학생 수만큼 필요한 진짜 작업량이라 이 카드의
좌표 큐로 줄지 않는다(§4 남은 위험 참고). **같은 학생 반복 연타**는 좌표로 실행 횟수 자체가
줄어 이 비용도 같이 준다.

## 2. Solve

| 원인 | 수정 |
|---|---|
| ① stale 기준 next 계산 | `TrainerMgmtPanel` 에 학생별 `latestAssigned` ref(클라이언트가 아는 최신 의도) 신설. `resolveAssigned(email, fallback)` 를 `TrainerAssignCard` 에 prop 으로 내려 `toggle()`/`bulkApply()` 가 `t.assignedTrainer` 대신 이걸로 next 를 계산 |
| 재클릭 유실·요청 폭주 | `lib/util/save-coalesce.ts` 에 `createKeyedSaveCoalescer<K,T>` 신설(기존 `createSaveCoalescer` 를 학생 email 로 keying) — 같은 학생 요청은 항상 직렬+좌표(마지막 의도만 서버로), 다른 학생끼리는 서로 안 막음 |
| ② 롤백 플래시 | `TrainerAssignCard` 의 optimistic-클리어 `useEffect` 를 블랑켓 리셋에서 "서버값이 optimistic 값과 실제로 일치하는 항목만" 지우는 surgical clear 로 교체 |

서버(`app/api/admin/assign-trainee/route.ts`)는 무수정 — 클라이언트가 학생당 요청을 항상
직렬화하면 "한 admin 세션이 같은 학생에 대해 두 요청을 동시에 못 만든다"가 보장되어 서버
쪽 out-of-order 문제가 애초에 발생하지 않는다(다른 admin 이 동시에 같은 학생을 편집하는
경우는 이번 재현 시나리오 밖 — §4).

## 3. Verify

`tests/util/save-coalesce.test.ts`(신규 3건): `createKeyedSaveCoalescer` 키별 좌표·키 간 독립·
`isSaving(key)` 격리.
`tests/components/trainer-assign-coalesce.test.ts`(신규 3건, jsdom+React 18 act):
- ★같은 학생 체크박스 7연타 → 실행 ≤2회(좌표됨)·마지막 클릭 의도가 서버로 감.
- ★서로 다른 트레이너 카드에서 같은 학생을 거의 동시에 체크 → 응답을 일부러 뒤섞어 resolve
  시켜도 두 트레이너 배정이 전부 최종 목록에 남음(원인① 재현·수리 확인).
- ★무관한 학생(B)의 서버 반영이 먼저 도착해도 아직 안 끝난 학생(A)의 체크가 유지됨(원인②
  재현·수리 확인, "롤백 플래시" belie 증상과 동일 기전).

**자기검증(반증 시도)**: 수정 전 코드로 각각 되돌려 새 테스트를 재실행 → 원인①테스트는
`expected [ 't2@...' ] to include 't1@...'`로 실패, 원인②테스트는 `expected false to be true`
로 실패 — 두 테스트 모두 실제로 그 버그를 잡는다는 것을 확인 후 수정 재적용(BBE-243 의
"테스트가 실제로 버그를 잡는지 자체검증" 관례 재사용).

check.sh 전체 green(typecheck·lint·structural·unit·doc-drift).

## 4. 남은 위험 / 후속 조사 후보

- **일괄 선택(전체/기수 선택)으로 여러 학생을 동시에 배정하면 학생 수만큼 registry 전체
  읽기가 그대로 발생** — 이 카드의 좌표 큐는 "같은 학생 반복"만 줄인다. 진짜 줄이려면
  `updateUserCell` 을 배치 쓰기로 바꿔야 하는데, 이는 BBE-249(admin/users N+1)·BBE-251(시트
  CI 가드) 경계와 겹칠 수 있어 후속 카드 후보로만 등재.
- **busy 표시(스피너)가 여전히 전역 단일 문자열** — 데이터 정합성은 좌표 큐가 보장하므로
  기능상 문제는 없으나, 두 학생이 동시에 in-flight 면 스피너가 한쪽에만 정확히 뜨지 않을 수
  있음(사전에 존재하던 표시 버그, 이번에 안 건드림).
- **다른 admin 세션이 같은 학생을 동시에 편집하는 경우**는 이번 수정 범위 밖(단일 admin 의
  빠른 연속 클릭만 재현·수리 대상).

## Log
- **2026-08-20 착수·완주**: belie 직배차 P0, BBE-251 작업 중 우선순위 인터럽트로 착수.
