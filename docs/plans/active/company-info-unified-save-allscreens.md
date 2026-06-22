---
slug: company-info-unified-save-allscreens
status: active
created: 2026-06-22
owner: belie
related: data-model
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: #411 업체정보 통합저장(파란 저장이 업체정보까지 함께 저장)을 schedule·payment 로 확장.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: MeetingResultCard, CompanyInfoContractSection/ContractRow, CompanyInfoEditor(hideSave/onChange)
> - **관련 문서**: data-model.md(CompanyInfo)

# fix — 업체정보 통합 저장 (schedule·payment)

## 원인
#411(통합저장)이 contact 탭에만 적용. schedule·payment 는 업체정보가 자체 저장 버튼 의존 → 필드만 채우고 파란 저장 시 업체정보 유실.

## 변경 (#411 패턴 1:1)
- **schedule** `MeetingResultCard`: `ciDraft`/`ciTouched` 상태 + `withCi(p)`. `<CompanyInfoEditor hideSave onChange={…} />`. handleContract/Done/Cancel·BasicEditDetails.onSave 가 `onPatch(withCi(...))` 로 업체정보 포함(patchMeeting 04+T~AN + 06 동기화 경로 재사용). closeAfter 에서 ciTouched 리셋.
- **payment** `CompanyInfoContractSection`(hideSave/onChange 노출) + `ContractRow`: ciDraft/ciTouched, 파란 저장 `saveAll` 이 업체정보(편집 시) POST /api/company-info(04+06) 후 onSave(draft).

## 수용 기준
- schedule·payment 각각 업체정보만 채우고 파란 저장 → 04 T~AN + 06 반영(실측). contact 회귀 없음.
- typecheck/lint/test 그린 + build + 배포 + health 200.

## 보류(별도)
- 미저장 이탈 가드(dirty = formDirty || ciTouched → [저장][무시]): contact `MeetingDirtyGuard` 를 공용으로 추출 + schedule·payment 페이지에 provider 배선 필요 → 후속. (통합저장으로 파란 저장 시 유실은 이미 해소)

## Log
- 2026-06-22 구현(fix/company-info-unified-save-allscreens): schedule·payment 통합저장. dirty guard 후속.
