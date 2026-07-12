---
status: completed
slug: contract-edit-linked-fields
created: 2026-06-26
owner: belie
related: 11-contract-payment-tab
completed: 2026-06-28
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 계약 핵심필드(업체명·계약일·수임료)를 실무/수납에서 수정하고 일정·계약·시트와 양방향 연동하되, 매칭 키를 미팅 id 로 바꿔 개명에도 링크가 안 끊기게 한다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/repo/contract-payment.ts, lib/service/contract-payment.ts, lib/config(AK), app/(app)/payment/ContractRow, 04 업체관리 patch, 06 업체정보, scripts/backfill-contract-meeting-id.mjs
> - **읽고 나면 알 수 있는 것**: 왜 id 키인가, 무엇이 PR1/PR2 인가, 마이그레이션 어떻게 실행하나
> - **관련 문서**: [sheet-structure.md §4](../../domains/sheet-structure.md), [data-model.md](../../domains/data-model.md)

# feat — 계약 필드 수정 + 미팅 id 기반 양방향 연동

## 근본 문제
02 계약수납 ↔ 04 업체관리 매칭이 (계약일+업체명) 조합 → 업체명 개명 시 `findRowByLink` 가 옛 이름으로
못 찾아 링크가 조용히 끊김. 또 계약일 편집을 02 만 반영하면 `02.계약일 ≠ 04.미팅날짜` 가 되어
`findByDate(계약일)` 경로(cascade·source lookup)도 깨짐. → 매칭 키를 **미팅 id(04 A)** 로 전환.
(01 영업관리 통계는 미팅날짜+채널+상태 기준이라 02 계약일/업체명 편집과 무관 — 안전.)

## PR1 [A] — 연결 키 견고화 (id 키 + 마이그레이션) ✅ 이 PR
- 02 에 **AK = 연결 미팅 id** 컬럼 신설. `SHEET_RANGES.contractPayment.linkMeetingIdCol = "AK"`, 범위 A6:AK.
- `findRowByLink({ meetingId?, 계약일?, 업체명? })`: **id 우선**, 없으면 (계약일+업체명) 폴백(레거시).
- `appendFromContract`: 02 행 생성 시 출발 미팅 id 를 AK 에 기록(service 가 `m.id` 전달).
- `clearRow`: revert 시 AK 도 함께 clear.
- 마이그레이션 1회: `scripts/backfill-contract-meeting-id.mjs` — AK 빈 02 행 → (계약일+업체명)으로 04
  계약 미팅 정확히 1건 매칭 시 id backfill. 0건(고아)·2건+(모호) 추정 금지·리포트. dry-run 기본, `--apply` gated.
- 하위호환: 기존 흐름은 폴백으로 동일 동작. **무위험 선행 PR.**

## PR2 [B][C][D] — 편집 UI + 양방향 연동 (다음 PR)
- **[B] ContractRow** 업체명·계약일·수임료 입력 개방 + DirtyGuard. 저장 시 id 로 대상 특정:
  업체명→02 D+04 G+06 스냅샷 / 계약일→02 C 만(04 미팅날짜·달력·주차통계 불변) / 수임료→02 E+04 L 양방향.
- **[C]** 04 업체명 수정(MeetingResultCard) 시 연결 02 행 업체명도 id 기준 갱신 + 06 스냅샷.
- **[D]** service 한 곳에서 멀티시트 건별 try/catch 격리 — 일부 실패 시 어떤 시트 실패인지 토스트, 반쪽
  동기화 침묵 금지. 일괄쓰기엔 §2.5 isSafeToOverwrite 가드 유지.

## 마이그레이션 실행 (배포 후, gated)
1. `node scripts/backfill-contract-meeting-id.mjs --all` (dry-run) → 연결/고아/모호 리포트 belie 검토.
2. 승인 후 `--all --apply` 1회. 멱등(이미 AK 있으면 skip).

## 검증
- 신규 계약 append 시 AK 기록. 기존 행 backfill. 매칭 id 우선·폴백.
- 01 영업관리 통계 불변. typecheck/lint/test/structural/doc-drift 그린.

## Log
- 2026-06-26 PR1 [A]: AK 컬럼 + id우선 매칭 + append id + clearRow AK + backfill 스크립트(dry-run) + SSOT.
- 2026-06-27 hotfix: appendFromContract/backfill 에 ensureGridColumns(37) — AK 쓰기 전 그리드 보장(계약 생성 회귀 수정). 마이그레이션 --apply ~83건 id 기록(고아 ~100 폴백).
- 2026-06-27 PR2 [B][C][D]: linkedMeetingId 노출 + editContractLinkedFields(멀티시트 try/catch) + edit-linked API/훅 + LinkedFieldsEditor(DirtyGuard) + patchMeeting 역방향(id키 02 + 06 rename) + renameCompanyInfoKey. SSOT(components·data-model). → 완료.
