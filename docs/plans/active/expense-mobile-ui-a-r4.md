---
slug: expense-mobile-ui-a-r4
status: active
created: 2026-07-24
owner: belie
feature_manager: DevA
track: expense-mobile-ui-a-r4
base_sha: 9cea2d5c0cd11ac37a09acbf9c225a864e768ba0
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 승인된 비용 원장 모바일 Option A를 기존 비용 API 계약 위에 구현하고 독립 검증으로 넘기는 작업 계획입니다.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `ExpenseLedgerDialog`, `ExpenseCategoryPicker`, `ExpenseLedgerTable`
> - **읽고 나면 알 수 있는 것**: 모바일 구조가 어떻게 달라지는가? 반복·카테고리 계약을 어떻게 보존하는가? 구현 완료와 DONE 사이에 어떤 검증이 남는가?
> - **관련 문서**: `docs/plans/active/expense-ledger.md`, `docs/design/components.md`

# 비용 원장 모바일 UI Option A — R4

## 승인과 경계

- 사용자가 Quick Action Dock을 선택하고 §14 구현을 승인했으며, DevD의 디자인 독립 검증 PASS가 기록됐다.
- 이 트랙은 제품 UI·컴포넌트·테스트·문서만 변경한다. 디자인 비교 HTML·렌더 증거와 비용 원장 core/API는 변경하지 않는다.
- 반복 core/API는 현재 `origin/master`에 병합돼 있다. UI는 일회성 POST, 반복 POST/PATCH/action/DELETE soft archive, 카테고리 POST/PATCH, 비용 조회 계약만 소비한다.
- 카테고리 DELETE API가 없고 사용 이력을 보존해야 하므로 삭제는 차단 안내 후 보관으로 유도한다.

## 승인된 UX 계약

- 360px·390px에서 압축 비용 요약, `기록 / 조회 / 관리`, 스크롤 본문과 기록 화면의 고정 저장 CTA를 제공한다.
- 카테고리 combobox/popover에서 선택·추가·이름 변경·보관을 수행한다.
- 카테고리 조회는 선택 필터가 아니라 범위 전체의 이름·총비용·비중·항목 수를 비용 내림차순으로 보여 주며 미분류를 포함한다.
- 반복비용은 당일/기간 토글을 쓰지 않고 시작일·선택 종료일·매월 1~31일을 별도로 입력한다. 없는 날짜는 말일로 보정한다.
- 임시 노란 박스 대신 비용·반복·카테고리 목록 행의 펼침 상세에서 관리한다.
- 카테고리와 반복 규칙 조회는 초기 loading, 성공한 empty, 로그인 만료, 권한 부족, 일시적 오류를 구분한다. 실패는 빈 목록이나 0건으로 대체하지 않고 안전한 안내·재시도·복구 상태를 제공한다.
- active·paused 반복 규칙은 행 안의 명시적 `삭제/종료` 확인을 거쳐 terminal soft archive한다. 과거 비용 항목은 보존되고 앞으로의 발생은 중단된다. 실패 시 행·확인을 보존하고 안전한 `401/403/503` 복구·재시도를 제공하며 archived에는 어떤 mutation action도 두지 않는다.

## 검증 게이트

1. DOM 계약 테스트: Option A 셸, 일회성 포함 일할, 반복 날짜 분리·말일 보정, 카테고리 전체 표, combobox 관리, 목록 행 disclosure, 카테고리·반복 query의 loading/empty/401/403/503/retry/recovery, active·paused 종료, 취소, 종료 오류·재시도, archived terminal action 차단.
2. `typecheck`, `lint`, focused Vitest, `scripts/check.sh`, production build.
3. 로컬 제품 화면의 360px·390px 상호작용·레이아웃 확인.
4. 구현 작성자가 아닌 신규 검증자의 독립 VERIFY PASS 이후에만 commit/push/PR·merge·deploy 체인으로 이동한다.

## 완료 정의

이 트랙의 로컬 구현 완료는 `VERIFY_READY`다. 제품 DONE은 독립 VERIFY, PR 검사·merge, 자동 배포, 공개 health 200, 안전한 live scenario까지 모두 증거가 있어야 한다.
