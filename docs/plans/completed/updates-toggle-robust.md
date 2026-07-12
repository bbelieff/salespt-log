---
status: completed
slug: updates-toggle-robust
created: 2026-06-15
owner: belie
related: announcement-popup, updates-toggle-polish
completed: 2026-06-15
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업데이트 현황 노출 토글을 knob 절대좌표 없는 표준 스위치로 재구현 + 시각 검증.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: app/admin/popup/_components/UpdatesManager.tsx
> - **읽고 나면 알 수 있는 것**: 왜 깨졌나(root 13.5px), 표준 패턴, 검증 결과
> - **관련 문서**: announcement-popup.md, updates-toggle-polish.md

# 업데이트 현황 토글 — 깨지지 않는 표준 스위치

## 문제 (이전 polish 후 잔존)
- 이전: `relative` 트랙 + `absolute` knob + translate. translate-x-6(24px)이
  이 프로젝트 **root font-size 13.5px** 에서 rem 축소된 트랙(w-12=40.5px)·knob(16.88px)을
  넘겨 ON 상태에서 knob 우측이 트랙 밖으로 0.38px 삐져나옴.

## 변경 (표준 headless 패턴)
- 라벨은 버튼 **바깥** 고정폭 span(w-7, "노출"/"숨김"), 토글은
  `inline-flex items-center` + knob `inline-block transform translate-x-{1,5}`.
  absolute 좌표 계산 제거.
- knob translate ON `translate-x-5`(=트랙에 맞춤, x-6 아님), OFF `translate-x-1`.
- 헤더 "노출" 컬럼 w-24(라벨 w-7 + gap + 토글 w-12)에 맞춰 본문과 1:1 정렬.
- 색: ON bg-brand-red·label text-brand-red, OFF bg-gray-300·label text-gray-400.

## 시각 검증 (실제 컴포넌트 격리 렌더 — 임시 라우트 후 삭제)
- 실측(root 13.5px): ON knob 좌16.88/우6.75px, OFF 좌3.38/우20.25px — **양 상태 overflow 없음**.
- 색 rgb(215,22,23)=#d71617(brand-red)·gray-300/400, 라벨 "노출"/"숨김" 확인.
- 긴 제목(flex-1 min-w-0)이 토글 안 밂 확인.

## 상태
- 2026-06-15 완료(fix/updates-toggle-robust). 동작·일괄저장 기존 그대로.
