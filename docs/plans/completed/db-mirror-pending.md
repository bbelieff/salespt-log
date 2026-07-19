> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB 정본 쓰기는 성공했는데 시트 비동기 미러가 재시도 끝에 실패한 행에 `mirror_pending` 표식을 남기고, 다음 동기화가 self-heal 하게 하는 R3 미러 안전망.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/db/mirror-pending.ts`(신규)·`mirror.ts`·`client.ts` · `lib/service/todos.ts`·`sales-write.ts` · `db-pilot.ts`(admin)
> - **읽고 나면 알 수 있는 것**: ① 왜 §7-3 이 R3 완료 관문이었나 ② 표식/드레인이 어떻게 동작하나 ③ 되돌리는 법
> - **관련 문서**: `docs/plans/active/db-write-flip.md` (§2.2·§3·§4·§7-3) · `docs/domains/db-migration-pilot.md`

# R3 미러 안전망 — mirror_pending (§7-3)

- **상태**: 구현 완료 → PR 대기
- **트랙**: A (DevA) · 2026-07-19 (R3 마감 스프린트 ③)
- **브랜치**: `feat/db-mirror-pending`
- **머지 순서**: C 의 06 전환(R3-3 PR-2)=#585 이미 머지됨 → 해금. origin/master(#579·#586·#585·#584) 리베이스 완료 후 머지.

## 1. 갭 (왜 R3 완료의 마지막 관문이었나)

R3 쓰기전환(DB 정본 → 시트 **비동기** 미러)에서 시트 미러가 3회 재시도 끝에 실패하면
**Sentry(`sheet_mirror_error`) 계수만** 하고 끝났다. self-heal 트리거가 "그 행에 **다음 쓰기가
또 일어남**"에만 의존 → 다시 안 건드리는 행은 시트가 **영영 stale**. 계획서 §2.2 는
"최종 실패 시 `mirror_pending` 마킹"을, §7-3 은 "DB성공·시트실패 → 응답 성공 + mirror_pending"을
요구했지만 **미구현**이었다(D 게이트키퍼가 R3 완료 불가 사유로 지목).

현재 라이브 쓰기전환 탭 = **todos(R3-2)·meetings(R3-2 PR-2)·sales(R3-1 + R3⑤ #579)** 3개.
셋 다 동일한 **행별 수렴 미러**(`queue*Sync`→`run*Sync(ctx,key)` 가 실행 시점 최신 DB 행을 읽어 시트에 내려찍음)
→ 배선이 균일하다.

## 2. 구현 (안전 기본값 = 계획서 §2.2 원문 "실패 시 마킹")

- **표식 = `sheet_rows.mirror_pending` 불리언 컬럼** (`client.ts` 스키마, `ADD COLUMN IF NOT EXISTS`
  — 멱등·가산, 기존 행 default false). 정본 payload 무오염 + jsonb 얕은 병합 부작용 없음.
  pending 부분 인덱스로 drain 조회 저렴. **롤백 = 코드 revert**(컬럼은 남아도 무해).
- **`lib/repo/db/mirror-pending.ts`(신규)**: `mark/clear/list/count` — 전부 `dbEnabled()` no-op 가드,
  3중 키(spreadsheet_id+tab+row_key) UPDATE(#495 교훈). `markMirrorPending` 은 `updated_at` 도 갱신
  → 실패행을 drain 큐(`order by updated_at asc`) 뒤로 회전(starvation 방지, 아래 적대리뷰 반영).
- **3개 탭 공통 배선(`run*Sync`)**: 성공(무예외 완료, sales 편집기간 밖 no-op 포함)→`clearMirrorPending`,
  최종 실패→`markMirrorPending`+Sentry. `queue*Sync` 는 대상 행 동기화 후 **같은 시트의 다른 pending 행을
  행별로 재드라이브**(`drainPending*Sheet`, 1회 ≤25행, 이번 행 제외). = "다음 어떤 쓰기든"이 self-heal
  트리거. `run*Sync` 는 최신 DB 상태를 읽어 수렴하므로 재구성이 **무손실**이고, **행별**이라 미러 불가
  poison 행(예: sales 편집기간 밖 날짜)이 다른 정상 행을 막지 않는다(todos=`runSheetSync`,
  meetings=`runSheetSync`, sales=`runSalesRowSync`).
- **mirror.ts(R2 방향, 시트 정본 → DB 미러)**: 일시 DB blip 이 반쪽쓰기로 굳지 않게 **선형 백오프 3회**
  추가(계획서 §486 silent 반쪽쓰기 완화). 이 방향은 DB 행이 아예 없어 pending 표식 불가 → durable 정합은
  backfill/parity 스크립트 담당(R2 는 시트가 정본이라 손실 아님).
- **Observability(§3)**: `getDbPilotStatus.mirrorPending` + /admin 배너 "시트 반영 대기 N행"(0 이면 미표시).

## 3. 안전성

- **비파일럿 불변**: 모든 헬퍼가 `dbEnabled()`(=DATABASE_URL) 미설정 시 no-op. R2·시트 경로 무변경.
- **응답 비차단**: mark/clear/drain 전부 fire-and-forget(`.catch` 삼킴) — 안전망이 앱을 막지 않음.
- **적대리뷰(5렌즈×검증) 반영**: ①리베이스(스테일 base) — origin/master 재적용(meetings 3번째 경로 발견).
  ②starvation(재마킹 시 `updated_at` 미갱신→같은 25행 재선택) → mark 에서 `updated_at=now()` 회전. ③sales
  poison head-of-line → master 의 per-row `runSalesRowSync` + 편집기간 밖 no-op 로 원천 해소(배치 아님).
- **한계(수용)**: "최종 실패 시 마킹" 방식은 DB 쓰기 성공 직후 프로세스가 죽어 동기화 잡이 아예 안 돈
  **crash-window** 는 못 잡는다. 더 견고한 대안(updated_at 대비 `mirror_synced_at` 타임스탬프)은
  worklog 📥 belie 결정 대기(안전 기본값으로 먼저 배포, 병렬 결정).
- **근본 후속(별건)**: sales DB 정본 경로(`persistSalesRows`→`writeSalesRowsToDb`)는 편집기간 가드 없이
  DB 에 쓴다 — 편집기간 밖 날짜가 DB 에 들어오면 시트 미러가 영영 no-op(=pending 은 아니고 clear 됨).
  집계 부풀림 방지용 DB-쓰기 편집기간 가드는 R3⑤ 후속(F 구역, 별 PR)로 남긴다.

## 4. 되돌리기

repo/service/문서만 바뀐 단일 PR → `git revert <squash-sha>` 하나로 원복(컬럼은 무해히 잔존).
게이트 플립(§4)과 무관 — 롤백 시 pending 표식은 재시도로 흡수(계획서 §4).

## 5. 테스트

- `tests/repo/mirror-pending.test.ts` — no-op 가드·3중키 UPDATE(mark 는 updated_at 갱신)·list/count SQL.
- `tests/service/todos.test.ts` §7-3 블록 · `tests/service/meetings-write.test.ts` · `tests/service/sales-write.test.ts`
  — 3개 탭 각각 DB성공·시트실패→응답 성공+mark / 성공→clear / drain self-heal / 비파일럿 불변.
