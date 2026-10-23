> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 「주생산품목」 라벨을 「아이템」으로 바꾸고, 진행률에 「중도중지」를 넣어 오늘 챙길 일·업무 현황에서 뺀다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: components/company-info-defs.ts · lib/service/company-info-txt.ts · lib/types/contract.ts · lib/analytics/{contract-slots,payment-work-status,dashboard-follow-ups}.ts · app/(app)/payment/_components
> - **읽고 나면 알 수 있는 것**: 중도중지 저장 모양 · 집계 제외 규칙 · 시트 미러 처리
> - **관련 문서**: docs/domains/data-model.md · docs/domains/sheet-structure.md §4

# 아이템 라벨 · 진행률 중도중지 (fix/item-label-progress-halt)

## 요청 (belie 2026-10-23)
1. 업체정보: 「주생산품을 '아이템'으로 바꾸자.」
2. 실무/수납: 「진행건의 완료가 수납밖에 없네. 진행률에 중도중지 칸을 넣고 중도중지가 되면 오늘 챙길일에서 집계하지 않는걸로 하자.」

## 결정
- 라벨만 바꾼다: 확장보기 「주생산품목」·기본보기 「주요품목」 → 「아이템」, TXT 내보내기 라벨도 「아이템」. 저장 키(`주생산품목`)·시트 머리글(AW)·DB 필드는 그대로. 메모 읽기는 「아이템」 외에 옛 「주생산품(목)」 라벨도 같은 칸으로.
- 중도중지 저장 모양: 기존 `진행률` 필드(`Progress` enum)에 값 `"중도중지"` 추가 — enum 확장만이라 옛 데이터는 그대로 통과. 새 필드·마이그레이션 없음.
- 시트 미러: 시트 N/T/Z dropdown 에 없는 값이라 **빈 칸**으로 쓴다(입력 거부로 미러가 막히지 않게). 정본은 DB.
- 집계: `isSlotClosed`(수납 완료 또는 중도중지) — 오늘 챙길 일(할 일·멈춘 업체)이 끝난 진행건으로 본다. 업무 현황(`buildWorkStatusItems`)은 중도중지 진행건을 넣지 않고, 전부 중도중지면 그 계약은 빠진다. 기존 함수 이름 유지.
- 화면: 진행률 드롭다운에 「중도중지」 옵션. 중도중지 진행건은 기본 접힘, 진행도 막대 흐리게 + 회색 「중도중지」 표시, 계약 목록 진행 줄도 회색 + 표시.

## 할 일
- [x] 라벨 변경 + 테스트
- [x] Progress 확장 · isHaltedSlot · isSlotClosed · 미러 빈 칸
- [x] 화면(PaymentSlotForm · ContractListTable · ContractRow 진행 중 기관 목록)
- [x] SSOT 문서(data-model · sheet-structure · components)
- [ ] check.sh · 화면 1280/375 확인 · PR

## 후속 (코디네이터 지시, 같은 PR)
- 계약 평균 진행률(목록 「진행 N%」·계약 💰 뱃지·정렬)과 완료(초록) 판정에서 중도중지 칸을 뺀다(`averageProgress`).
  남은 진행건이 끝났으면 완료. 전부 중도중지면 평균 100(끝남)으로 보고, 화면은 퍼센트 대신 「중도중지」(`allHalted`).
