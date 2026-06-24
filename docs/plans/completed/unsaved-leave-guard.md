---
slug: unsaved-leave-guard
status: completed
created: 2026-06-23
completed: 2026-06-24
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

## 후속 (per-screen register — 전부 완료 2026-06-24)
재사용 훅 `useDirtyEntry(id, dirty, save, discard, label)` 를 DirtyGuard 에 추가해 화면당 ~5줄로 등록.
- ✅ **contact 지표 스테퍼**(#458): `metricsTouched ∧ JSON(draft)≠server` 하이브리드 → 저장후 파생필드 드리프트(직접생산 E)·무변화 클릭 거짓양성 0. leaf save=지표만(saveAll 재귀 회피). 교차탭 effect 를 `_lib/useCrossTabParams` 분리(500줄 캡).
- ✅ **payment ContractRow + TodoFormModal**(#459): ContractRow `dirty=ci ∥ JSON(draft)≠cp`(cp 는 raw 필드만→거짓양성 0), id=useId(마스터-디테일 충돌 방지). Todo 모달 검증 throw 코어 doCreate.
- ✅ **calendar GeneralEventModal**(#460): 검증 throw 코어 doSubmit, dirty=필드 입력.
- ✅ **db RowCard + 신규추가 폼**(#461): **baseline-ref 패턴** — RowForm mount 수식 onChange 1회값을 기준선으로 박아 이후 입력만 dirty(거짓양성 0). RowForm 수정 불필요. 접어도 draft·ref 보존.
- ✅ **schedule MeetingResultCard**(#462): dirty=action ∥ editMode ∥ ciTouched. ci 는 저장, 액션폼(값이 하위폼 내부)은 save throw 로 "직접 확정" 유도(belie 결정 경고+직접제출).

### 알려진 잔여 (작은 갭, 별도 후속)
- schedule 액션폼 입력 중 "저장하고 이동"은 자동제출 불가(설계상) — 하위폼 상태 끌어올리면 해소.
- db RowCard: 편집 후 접었다 **다시 펼치면** RowForm 이 initial=row 로 재마운트되며 입력이 되돌려지는 기존 동작은 그대로(가드와 무관).

## 검증
- 변경 후 탭/날짜/채널/카드접기/모달닫기/새로고침 → 모달. 변경 없으면 즉시 이동(거짓양성 0). 저장 1건 실패 주입 → 이동 취소+토스트.
- typecheck/lint/test/structural/doc-drift 그린.

## Log
- 2026-06-23 foundation(feat/unsaved-leave-guard): 전역 Provider + TabBar 가드 + contact 이관.
- 2026-06-24 #458 contact 지표 스테퍼(+useDirtyEntry 훅, useCrossTabParams 분리).
- 2026-06-24 #459 payment ContractRow + TodoFormModal.
- 2026-06-24 #460 calendar GeneralEventModal.
- 2026-06-24 #461 db RowCard + 신규추가(baseline-ref 패턴).
- 2026-06-24 #462 schedule MeetingResultCard(경고+직접제출). → 전 화면 완료, completed 이동.
