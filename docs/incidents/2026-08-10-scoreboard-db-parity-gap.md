# 2026-08-10 — 전광판 DB 배치 read 롤백 (라이브 parity 40% diff)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: BBE-63(전광판 DB 전환) 머지·배포 후 전 기수 라이브 parity 를 실행했더니 52명 중 21명(40%)에서 diff 83건이 나와 즉시 롤백했다 — 원인은 BBE-63 코드가 아니라 `sheet_rows` 계약-상태 미팅 데이터의 완전성 문제로 추정된다.
> - **누가 읽나요**: BBE-63/BBE-66/BBE-67/BBE-68 을 다시 여는 세션, belie
> - **어떤 기능·작업과 연결?**: `lib/service/scoreboard-db.ts`(weeklyPerfFromDb) · `lib/repo/db/scoreboard-stats.ts` · `sheet_rows`(tab='meetings') 백필/동기화 라인(BBE-66/67/68)
> - **읽고 나면 알 수 있는 것**: ① 무엇이 얼마나 틀렸나 ② 왜 롤백이 맞는 판단이었나 ③ 재개 조건은 무엇인가
> - **관련 문서**: `docs/plans/active/sheet-retirement-r7.md`(BBE-66/67/68 로드맵) · `docs/worklog.md` "2026-08-10 · 경영일지 데탑 C작업원D(260809-2) · BBE-63 머지→롤백" 항목

## 타임라인 (UTC)

- belie 직접 지시: "BBE-63 완주까지" (레인 = `lib/service/scoreboard.ts`·`app/admin/arena/scoreboard/**` 한정).
- PR #753(`db-audit.yml` scoreboard-parity 실행 수단) 머지 `6c5766c` → 배포 성공.
- PR #720(BBE-63 본체) 머지 `a3ae5c0` → 배포 성공(공개 health 200, Public health check 스텝 포함).
- 전 기수 라이브 parity 실행(`gh workflow run "DB Audit (read-only)" -f script=scoreboard-parity -f cohort=<파일럿 18개 라벨>`, run [31330346822](https://github.com/bbelieff/salespt-log/actions/runs/31330346822)).
- 결과: **사용자 52 · diff 0 사용자 31 · 총 diff 83**.
- 즉시 `git revert a3ae5c0`(PR #774, `052a45e`→`9e3cacc`) → 배포 관찰 → 공개 health 200 재확인.

## 무엇이 틀렸나

diff 패턴이 예외 없이 동일했다:

- **항상 `db=0, sheet>0`** — DB 쪽이 더 적게 세지, 많이 세는 경우는 0건.
- **미팅과 계약이 항상 같은 주차에 함께** 틀어진다. 예(`practice@salespt.local`, 연습 기수):
  ```
  주1.미팅: sheet=9  db=0    주1.계약: sheet=3 db=0
  주4.미팅: sheet=3  db=0    주4.계약: sheet=2 db=0
  주6.미팅: sheet=2  db=0    주6.계약: sheet=2 db=0
  주7.미팅: sheet=4  db=0    주7.계약: sheet=3 db=0
  주8.미팅: sheet=1  db=0    주8.계약: sheet=1 db=0
  ```
- 영향 범위: A1-x·A2-x·8기 사용자 다수, 9기는 표본 5명 전원 diff 0(깨끗함).

`weeklyPerfFromDb`(순수함수)의 정의 자체는 `상태 === "계약"` 이면 미팅·계약 두 카운터에 동시에 반영하므로, 이 동반 패턴은 **정의가 맞다는 증거**다(코드가 의도대로 동작). 문제는 입력값 — DB 배치 조회(`readScoreboardRowsFromDbBatch`)가 반환하는 `meetings` 배열 자체에 계약 상태 미팅 일부가 빠져 있다는 뜻이다.

## 왜 BBE-63 코드 버그가 아니라고 판단했나

1. **단위테스트 14건이 전부 통과** — `weeklyPerfFromDb`·`readScoreboardRowsFromDbBatch`는 설계대로 동작. 문제는 로직이 아니라 `sheet_rows` 테이블에 실제로 들어있는 데이터.
2. **같은 날 다른 트랙이 같은 모양의 갭을 이미 발견**(worklog "2026-08-10 · 경영일지 데탑 C작업원C(260809) · 🚨 BBE-68 재검증" 항목) — BBE-66 의 `dashboard-parity` 가 BBE-65(이월 게이트 수정) 머지 전후로 diff 수치가 **한 글자도 안 바뀜**(`diff 0=74, 불일치 31` 그대로). "원인가설이 틀렸거나... 원인 미상"으로 그날 아침 결론.
3. 겹치는 사용자군(A1-x·A2)에서 같은 성격(sheet>db, 미팅+계약 동반)의 갭이 재현 — 상위 데이터(백필/동기화, BBE-67/91 라인) 문제일 가능성이 높다.

## 왜 "롤백 먼저"였나 (완주 대신)

- 아레나 전광판은 **경쟁성 있는 공개 랭킹 화면**이다. 실제보다 적은 수치가 40% 사용자에게 보이면 랭킹 왜곡·신뢰 손상으로 이어진다.
- 근인이 BBE-63 소유가 아니라(§ 위 3번) 이 세션이 즉시 고칠 수 없다 — "잠정 배포 후 원인 조사"보다 "알려진 안전 상태(시트 100%)로 즉시 복귀 후 근인 해소를 기다림"이 CLAUDE.md §6.8("build/health 실패 → 즉시 롤백")의 정신에 맞다.
- §0.8 "완료를 완료로 잘못 닫는 게 가장 위험" — belie 의 "완주까지" 지시를 문자 그대로 따라 카드를 닫았다면, 이 데이터 정확성 문제가 묻혔을 것이다.

## 재개 조건

> **✅ 2026-08-10 분류기 실측(run [31348578291](https://github.com/bbelieff/salespt-log/actions/runs/31348578291))
> — 이 인시던트의 가설이 확정됐다.** 아레나 전 기수 45명·diff 72건 중 **69건(96%)이 "시차"로
> 분류**됨(시트 원본 재계산=수식값 일치, DB 재계산만 다름 = DB 에 그 행이 없음). 렌더옵션·로직차이는
> 0건 — 코드 문제가 아니라는 판단이 실측으로 재확인됐다. 남은 3건만 사람이 볼 대상(상세는
> `docs/plans/completed/parity-diff-classifier.md` §7). **다음 단계 = BBE-67(잔여 백필)이 이 갭을
> 메우는 것 — 아래 절차 그대로 유효.**

BBE-66/68 근인이 해소되어 `sheet_rows`(tab='meetings') 의 계약-상태 데이터 완전성이 회복되면:

1. `gh workflow run "DB Audit (read-only)" -f script=scoreboard-parity -f cohort=<파일럿 전체>` 재실행 —
   2026-08-10 diff 원인 자동분류(아래 하네스 갭 ① 참고) 적용판이라, 재실행 결과가 "시차"(이 인시던트가
   가리키는 바로 그 문제)로 분류되는지 곧바로 확인 가능. 렌더옵션·로직차이로 분류되는 diff 가 섞여
   있으면 그건 이 인시던트와 별개 원인이라는 뜻이니 혼동하지 말 것.
2. diff 0(또는 납득 가능한 소수)이면 PR #720 의 diff 를 cherry-pick(코드는 `a3ae5c0`에 그대로 보존됨) 하여 재적용.
3. §6.8 배포 관찰 재수행.

## 하네스 갭 (Hashimoto)

1. **[해소 — 2026-08-10] `sheet_rows`(meetings) 계약-상태 데이터 완전성 검증 도구 부재** — belie
   최우선 지시로 `dashboard-parity.mjs`·`scoreboard-parity.mjs`(이 인시던트로 사라졌던 것을 복원)·
   `registry-parity.mjs` 3개 모두에 diff 원인 자동분류를 추가했다(공용 모듈
   `scripts/ops/parity-classify.mjs`). 분류축 = 시차(백필 이후 신규 행 — 이 인시던트가 정확히
   이 유형)·렌더옵션(#752 패턴)·로직차이(계산식 불일치)·진짜불일치. diff 가 있는 사용자만 추가로
   시트 04/02 원본 행을 재계산해 "시트 원본과는 일치·DB 재계산과는 다름" 조건으로 시차를 판정한다
   (쿼터 절약 — 깨끗한 사용자는 추가 호출 0). 손분류에 카드 하나당 며칠 쓰던 것을 없앤다.
   상세 설계 = `docs/plans/active/parity-diff-classifier.md`(VPS 실데이터 검증만 남음). 단위테스트 47건이 이 인시던트의
   정확한 패턴("db=0, sheet>0, 미팅+계약 동반")을 합성 데이터로 재현해 고정한다
   (`tests/ops/scoreboard-parity-lib.test.ts`).
2. **DB 배치 read 계열 기능의 공통 위험** — BBE-56 처럼 "0행이면 비정상"류 방어가 있는 트랙도 있고 없는 트랙도 있다(scoreboard-db.ts 는 없음). DB 파일럿을 소비하는 새 기능은 머지 전 라이브 parity 를 **머지 게이트**로 명문화하는 것을 고려(현재는 CLAUDE.md 어디에도 강제 규정이 없다 — 이번처럼 다행히 배포 직후 잡았지만 늦게 잡혔으면 더 오래 노출됐을 것).
