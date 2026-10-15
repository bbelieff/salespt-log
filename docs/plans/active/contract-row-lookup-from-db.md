> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 화석 코드 정비 B1·B4 — DB 가 정본인 기수에서 계약 줄 찾기(수정·삭제·수임비 동기)와 아레나 이월의 계약 읽기를 **시트가 아니라 DB 에서** 하게 한다(못 찾으면 예전 시트 경로).
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `lib/repo/contract-row-lookup.ts`(신규) · `contract-payment-link.ts`·`contract-payment-sync.ts` · `lib/service/arena-carryover.ts`
> - **읽고 나면 알 수 있는 것**: 무엇이 위험했나 / 어떻게 바꿨나 / 예전 동작이 어떻게 보존되나 / 되돌리는 법
> - **관련 문서**: ADR-0030, `docs/plans/active/masked-sandbox-snapshot.md`

---
slug: contract-row-lookup-from-db
status: active
created: 2026-10-15
branch: fix/contract-row-lookup-from-db
---

# 계약 줄 찾기·아레나 이월 — DB 정본으로

## 무엇이 위험했나
- **B1** 파일럿(DB 정본) 기수도 계약을 고치거나 지울 때(`clearRowByLink`·`updateLinkFields`·`syncFeeFromContract`) 시트 02 의 C:AK 전체를 읽어 줄을 찾았다. 시트는 비동기 미러라 밀리면 같은 날·같은 업체명의 다른 계약 줄을 고를 수 있고, 요청마다 시트 API 를 불렀다.
- **B4** 아레나 이월이 이전 기수 계약을 시트에서 읽었다. BBE-246 이후 02 편집(수납 등)은 DB 먼저 + 시트 수렴 큐라, 방금 고친 수납값이 시트에 아직 없으면 옛 값이 아레나로 옮겨졌다. (코드 주석은 "02 는 시트에 동기 즉시 쓰기"라고 적혀 있었지만 BBE-246 이후 사실이 아님.)

## 바꾼 것
- `findContractRow`(신규): 파일럿이면 DB 계약으로 **같은 규칙**(미팅 id 우선 → 계약일+업체명, 「영업기록 없이 추가」 행 제외, 가장 앞 줄). DB 에 없거나 DB 읽기 실패 → 예전 `findRowByLink`(시트). 비파일럿은 그대로 시트. DB row_key(r{N}) = 시트 줄번호라 이후 쓰기와 그대로 맞는다.
- 아레나 이월: 이전 기수가 DB 읽기 파일럿이면 DB 계약을 정본으로, DB 에 없는 줄만 시트에서 보탠다. 중복 방지 원본키는 아레나 시트 ∪ DB.
- 계약 추가(`appendFromContract`)의 줄번호를 시트가 정하는 문제(D3)는 이번 범위 밖 — 연습장 실측 후 별도.

## 검증 · 되돌리기
- `tests/repo/contract-row-lookup.test.ts` 8개(id 우선·같은 날 두 계약·manual 제외·DB 실패/공백 시 시트·비파일럿), `tests/service/arena-carryover-read-gate.test.ts` +4(밀린 수납값·DB 공백 보충·이미 이월 skip·비파일럿). check.sh 전체.
- 되돌리기: squash revert 1건. 데이터 변경 없음(읽는 곳만 바뀜).