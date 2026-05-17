---
slug: admin-reserve-merge
status: active
created: 2026-05-17
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 카드별 유보버튼 → 헤더 통합 다중선택 모달
> - **누가 읽나요**: 개발자/관리자
> - **어떤 기능·작업과 연결?**: AdminUserPicker + BulkReserveButton + TraineeCard

# admin-reserve-merge — [A5]

## 사용자 요청 (2026-05-17)
"수강생 관리 유보버튼을 하나로 통합, 동기화버튼 위치까지 올리기. 유보대상을 선택 후 찍으면 그 수강생만 유보. 유보버튼 자리까지 텍스트 뷰로."

## 변경
- `components/auth/BulkReserveButton.tsx` (신규) — 체크박스 리스트 모달, 다중 선택 → 일괄 reserve
- `AdminUserPicker.tsx` — 헤더 sync 버튼 옆에 BulkReserveButton 배치
- `TraineeCard.tsx` — 카드별 유보 버튼 제거, onReserve prop 호환 유지 (`_onReserve` 로 unused mark)
- `components.md` SSOT 등재

## API 재사용
- 기존 `/api/admin/set-trainee-reserved` (action=reserve) 를 순차 loop 호출
- 별도 bulk endpoint 안 만듦 (간단/명확/안전)

## Acceptance
- [ ] 카드 영역에 유보 버튼 안 보임 → 텍스트뷰 공간 확보
- [ ] 헤더 [✋ 유보 처리] → 모달 → 다수 체크 → 확정
- [ ] check.sh 통과
