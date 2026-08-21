> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: BBE-252 계보 — 10기 학생 1명(해시 13f5c9c271fb)의 시트 직접입력 미팅 5건을 DB에 개별 백필해 parity 정합을 맞춘 집행 기록.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `scripts/ops/bbe252-10gi-meeting-backfill.mjs`, `.github/workflows/db-backfill-bbe252-10gi-meetings.yml`
> - **읽고 나면 알 수 있는 것**: 왜 id 공란 행을 그대로 백필해도 안전한지 / row_key를 왜 r{행}으로 잡았는지 / revert 방법
> - **관련 문서**: `docs/plans/completed/bbe252-...`(선행 read-only 조사 시리즈), BBE-258·BBE-260(같은 계보 선례)

---

slug: bbe252-10gi-meeting-backfill
status: active
created: 2026-08-20
owner: 경영일지 데탑 C작업원C(260820) — belie 집행 승인(「이번 라운드 내 종결」 확정)
related: BBE-252, BBE-258, BBE-260

## 0. Scope

BBE-252 계보 10기 개별조사(read-only pass)에서 확정한 처방("개별 교정 필요")을 실제 집행한다.
대상: 10기 학생 1명(dashboard-parity 해시 `13f5c9c271fb`)의 04 업체관리 탭에서 id 공란인
미팅 행 전부를 DB에 백필. 완료 후 dashboard-parity --cohort "10" 재검증 → diff 0 확인 →
D 가 10기 파일럿 스위치를 켠다(별도 후속, 이 카드 밖).

## 1. Gather — 왜 이 방식인가

read-only 조사(BBE-252 코멘트, 2026-08-20T18:40)에서 이미 확정: id 공란 행은
`rowToMeeting()`(`lib/repo/meetings-rows.ts:203`)이 `if (!idStr) return null` 로 파싱을
포기하고, `appendMeeting`(시트에 미팅을 쓰는 유일한 repo 함수)의 유일한 호출부
(`lib/service/meetings-write.ts:151`)는 그 앞에서 `Meeting.parse()`(id 포함 필수 검증)를
거친다 — id 공란 행은 앱 저장 경로를 거칠 수 없다(시트 직접입력 확정).

**공란을 그대로 백필해도 안전한 이유**(신규 실측): `dashboard-parity-lib.mjs` 의
`normalizeSheetMeetingRow`(원본 배열 idx 직독)와 `normalizeDbMeeting`(`fieldOrCol` — 필드명
우선, 열문자 폴백)은 **같은 공란 셀을 같은 연산으로 같은 빈 문자열**로 정규화한다. 즉 시트의
공란 셀을 payload 에서 그냥 **키 생략**(`backfill-sheet-rows.mjs` 의 `rowObj` "비어있지
않은 셀만" 관례 그대로 재사용)하면 parity 지문이 자동으로 맞는다 — "최소 기본값 치환"이
필요 없었다(dispatch 가 예비로 지시한 대체 규칙은 이번 케이스에서는 미적용).

**row_key**: meetings 통상 키는 A열 id 이나 이 행들은 정의상 id가 없다. contracts/db 탭의
행번호 합성키(`r{행}`) 관례를 meetings 에 예외 적용. id 가 계속 공란이므로 백필 후에도
`rowToMeeting()` 은 이 행들을 계속 null 처리한다 — **파일럿 전환 후에도 앱 화면(미팅 목록 등)
에는 안 보인다**. 목적이 "실제 미팅 노출"이 아니라 "parity 정합"이므로 이건 의도된 안전한
설계다(오늘 시트에서 안 보이는 상태를 DB에서도 유지).

## 2. Solve

신규 스크립트 `scripts/ops/bbe252-10gi-meeting-backfill.mjs`(단발성, 대상 하드코딩 — 범용
백필 아님) + 전용 워크플로 `db-backfill-bbe252-10gi-meetings.yml`(`db-backfill-row-numbers.yml`
템플릿 재사용, execute 토글만). `backfill-sheet-rows.mjs` 는 id 공란 행을 `if (id)` 로 스킵해
그대로는 재사용 불가(확인됨) — 그 upsert SQL 패턴(insert...on conflict...payload 병합)만 재사용.

## 3. Verify

① dry-run 실행 → 후보 행 수·PII 마스킹 미리보기·기존 DB 중복 여부 확인.
② execute → 실제 insert, revert용 row_key 목록 출력.
③ dashboard-parity --cohort "10" 재실행 → diff 0(meetings 관련 필드) 확인.
④ B21 잔존 시 courseStart 경계 조사를 B 에게 이관(이 카드 완주 조건 아님).

## Log
- **2026-08-20 착수**: belie 집행 승인.
