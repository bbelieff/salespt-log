---
slug: contact-unified-save
status: active
created: 2026-06-22
owner: belie
related: company-info-unified-save-allscreens, 0020-production-metric-ssot-to-db
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 컨택 탭 저장을 최하단 [저장하기] 1버튼으로 통합 — 신규슬롯 append + dirty미팅 patch + 지표를 한 번에.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: contact/page.tsx, MeetingSlotItem/List, MeetingDirtyGuard
> - **관련 문서**: #411 통합저장, ADR-0020

# feat — 컨택 저장 통합 (#411 완성)

## 변경
- **handleSave 오케스트레이션**(현 "newSlots 있으면 차단" 제거): ① 완료 신규슬롯(필수: 날짜·시간·업체·장소) appendMeeting(업체정보 포함) → ② dirty 저장미팅 patch(업체정보 포함, `saveAllDirty`) → ③ saveContactMetrics(draft). 순서 ①→②→③(saveContactMetrics 가 H 를 카드수로 재계산).
- **항목별 실패 격리**: 신규슬롯 필수누락/실패분은 드래프트 유지 + 토스트(나머지 저장). dirty patch·지표 실패도 격리.
- **버튼 제거**: NewItem [✓ 등록]·SavedItem [💾 수정완료] 제거(최하단 저장이 담당). 업체정보 섹션은 hideSave(상단 [편집]만). 삭제 버튼·이탈 가드 유지.
- `MeetingDirtyGuard`: `saveAllDirty()`(등록 dirty 카드 전부 save, 실패 격리) 추가. NewItem onRegister/registerNewSlot 제거 → `slotComplete`/`buildMeetingFromSlot` 헬퍼.

## 수용 기준 (배포 후 belie 클릭, 5분기)
- 신규완료/신규누락/저장미팅수정/업체정보수정/지표변경 → 최하단 저장 1번으로 시트 반영, 유실 0, H=카드수.
- typecheck/lint/test/doc-drift 통과 + build + 배포 + health 200.

## Log
- 2026-06-22 구현(feat/contact-unified-save): 최하단 저장 1버튼 오케스트레이션 + 항목별 실패 격리.
