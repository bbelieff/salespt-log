> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 업체정보 편집칸의 라벨 아래 회색 설명 줄을 없애고, 라벨 옆 (?) 버튼 툴팁으로 옮긴다.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `components/CompanyInfoEditor.tsx`(컨택관리·일정/계약·실무/수납 공용), 신규 `components/ui/HintTooltip.tsx`
> - **읽고 나면 알 수 있는 것**: 설명이 어디로 갔나 / 모바일에서 어떻게 보나 / 왜 portal 인가
> - **관련 문서**: `docs/design/components.md` (HintTooltip), `docs/domains/consultation-log-and-calendar.md` §3-2

---
slug: company-info-hint-tooltip
status: active
created: 2026-09-28
worktree: _wt/salespt-log/dc-cohort12
---

# 업체정보 칸 설명 → (?) 툴팁

**요청**: belie 2026-09-28 — 칸마다 붙은 회색 설명 줄이 화면을 길게 만든다.

## Intent (왜)
업체정보 편집기는 칸마다 라벨 아래에 예시 설명 줄(예: `25.01.24`)을 한 줄씩 그려 모바일에서 세로가 길다.
설명은 필요할 때만 보면 되므로 라벨 옆 작은 (?) 버튼으로 숨긴다.

## Acceptance Criteria (수용 기준)
- [x] 라벨 아래 회색 설명 줄이 기본으로 안 보인다.
- [x] 설명이 있는 칸만 라벨 옆 (?) 버튼(`<라벨> 설명 보기`)이 있다. 사용자 추가 칸·설명이 라벨과 똑같은 칸(대표자 `이름`)은 버튼 없음.
- [x] 마우스 올림/키보드 포커스 → 열림, 터치·클릭 → 토글, Esc·blur·바깥 누르기 → 닫힘, 하나만 열림.
- [x] 말풍선은 body portal + fixed 좌표 → 실무수납 상세패널·모바일 아코디언(overflow)에서 안 잘림, 375px 에서 가로 clamp.
- [x] (?) 버튼은 `<label>` 밖 — 눌러도 입력칸이 포커스되지 않음. 입력칸은 `htmlFor/id` 로 라벨 연결 유지.
- [x] 테스트: `tests/components/company-info-hint-tooltip.test.ts`
- [ ] `scripts/check.sh` 통과 (커밋 훅)
- [ ] 실제 화면(375px·PC) 확인 — 이 작업에서는 jsdom 테스트만 수행, 브라우저 확인은 PR 단계에서.

## 결정
- 기존 재사용 가능한 툴팁 프리미티브 없음(`WorkStatusBar` 팝오버는 absolute 전용) → `components/ui/HintTooltip.tsx` 신설.
- z-index 는 편집 모달(`z-[300]`) 위여야 해서 inline style `zIndex: 350` (Tailwind arbitrary 금지 회피).
- 패널·모달이 같은 필드를 동시에 그리므로 입력 id 에 `panel|modal` 을 넣어 중복 id 방지.

## 되돌리기
이 커밋 revert — 설명 줄이 원래대로 돌아온다(데이터 무변경).

## Log
- 2026-09-28 구현 + 테스트 5건.
- 2026-09-28 리뷰 반영: ① 화면낭독기 회귀 — 설명 있는 입력칸에 sr-only 설명 + `aria-describedby`(툴팁 안 열어도 예시 형식 읽음)
  ② 스크롤(안쪽 컨테이너 포함) 시 말풍선 닫힘 — 버튼이 가려진 뒤 떠 있지 않게 ③ components.md 표 행 줄바꿈 깨짐 수정.
  툴팁 문구 재작성(예: 접두어·주소지/자유 메모 제거)은 스펙 밖 문구 결정이라 보류. 테스트 7건.
