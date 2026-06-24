---
slug: unsaved-leave-guard
status: active
created: 2026-06-23
owner: belie
related: company-info-unified-save-guard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 저장 안 한 변경이 있을 때 화면을 떠나면 "저장하고 이동 / 무시하고 이동" 모달을 띄우는 전역 가드.
> - **누가 읽나요**: 개발자
> - **연결**: components/DirtyGuard.tsx(신규), TabBar, app/(app)/layout, contact, db·schedule·payment·calendar
> - **관련**: MeetingDirtyGuard(기존 contact 패턴)

# feat — 미저장 이탈 가드(전역)

기존 contact 의 useDirtyGuard 를 **전역 DirtyProvider** 로 승격. 입력 컴포넌트가 dirty 시 register({save,discard,label}),
이탈(탭 라우팅·날짜·채널·카드접기·모달닫기·브라우저닫기) 가로채 공통 모달.

## 이번 PR (foundation — 두 "상" 리스크 차단)
- `components/DirtyGuard.tsx`: DirtyProvider + useDirtyRegister/useGuardedNav/useGuardedRouter/useSaveAllDirty + 모달([저장하고 이동]/[무시하고 이동]/취소, 라벨 목록, 실패 토스트) + beforeunload.
- `layout.tsx`: children + TabBar 를 DirtyProvider 로 감쌈(한 컨텍스트 공유).
- **TabBar (≪최우선 구멍≫)**: Link onClick → useGuardedRouter().push. 5탭+FAB 전부 가드.
- **contact**: 미팅카드(MeetingSlotItem)를 전역 useDirtyRegister 로 이관(라벨 추가). 페이지는 useGuardedNav/useSaveAllDirty + 전역 모달. 카드 접기 확인(MeetingDirtyGuard.ConfirmLeaveModal)은 유지.

## 후속 (per-screen register — dirty 감지 주의점 있음)
- **db RowForm/RowCard**: RowForm 이 mount 시 수식 필드(개당단가 등) onChange 발화 → 단순 draft 비교는 거짓 dirty. touched 플래그(첫 사용자 입력 후) 패턴 필요.
- **schedule MeetingResultCard**: dirty = action≠null ∥ editMode ∥ ciTouched (명시 플래그라 깔끔) → register.
- **payment ContractRow**: draft≠cp ∥ ciTouched. 카드 접어도 draft 보존(명시 가드 필요).
- **calendar GeneralEventModal / payment TodoFormModal**: 모달 — dirty = 필드 비어있지 않음, save=submit, discard=onClose(언마운트). 깔끔.
- **contact 지표 스테퍼 draft + newSlots**: runSave 와 saveAll 의 재귀(saveAll→runSave→saveAll) 회피 설계 필요 — 페이지 엔트리 save 를 "슬롯+지표"로 분리하고 하단 저장=saveAll 로 통합.

## 검증
- 변경 후 탭/날짜/채널/카드접기/모달닫기/새로고침 → 모달. 변경 없으면 즉시 이동(거짓양성 0). 저장 1건 실패 주입 → 이동 취소+토스트.
- typecheck/lint/test/structural/doc-drift 그린.

## Log
- 2026-06-23 foundation(feat/unsaved-leave-guard): 전역 Provider + TabBar 가드 + contact 이관.
