# ADR-0027 — 하단 탭 인디케이터: STEP 배지 + 선택 시 탭별 고유색

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 하단 탭의 단계 표시를 점(dots)에서 "STEP 1~4" 배지로 바꾸고, 단계 사이에 흐름 화살표(`›`)를 넣고, 선택된 탭을 탭별 고유색으로 또렷하게 켜기로 한 결정.
> - **누가 읽나요**: 개발자, 에이전트, 디자인
> - **어떤 기능·작업과 연결?**: `components/TabBar.tsx`, components.md §5, tokens.md "탭 단계 색상"
> - **읽고 나면 알 수 있는 것**: 점→STEP 배지 근거, 탭별 5색 매핑, 9px 배지 예외 사유, 무엇이 ADR-0019에서 불변인가
> - **관련 문서**: [ADR-0019](0019-bottom-nav-4plus1.md), [components.md §5](../design/components.md), [tokens.md](../design/tokens.md)

- **status**: accepted
- **date**: 2026-06-24
- **extends**: [ADR-0019](0019-bottom-nav-4plus1.md) (4+1 구조·순서·라벨·아이콘은 그대로, 인디케이터 표현만 확장)
- **supersedes 아님**: ADR-0019 본문 불변. 본 ADR 은 "단계 인디케이터=점" 부분만 갱신.

## 맥락
ADR-0019 의 "단계 = 라벨 아래 점 갯수"는 한눈에 단계를 못 읽었고(점 1~4개 구분 약함), 선택 탭이 파랑 단색이라 "지금 어느 탭"이 약하게 보였다. belie 요청: 단계를 명시 배지로, 흐름을 화살표로, 선택 탭을 색으로 또렷하게.

## 결정
1. **STEP 배지** — 점 폐기. 아이콘 칩 위에 "STEP 1~4" 배지. 캘린더(FAB)는 단계 없음(도구).
2. **흐름 화살표** — STEP1·2 사이, STEP3·4 사이에만 `›`(chevron, 회색). 캘린더 양옆엔 없음.
3. **아이콘 칩** — `h-8 w-9 rounded-lg`. 비활성=`bg-slate-200`+`text-slate-600`(또렷한 진회색). 활성=탭색 채움+흰 글리프+`shadow`. STEP 배지·라벨도 같은 탭색(라벨 bold).
4. **탭별 고유색 5종**(표준 Tailwind, tokens.md 등재):
   DB생산 `blue-700`(#1d4ed8) · 컨택관리 `emerald-600`(#059669) · 캘린더 FAB `amber-500`(#f59e0b) · 일정·계약 `violet-600`(#7c3aed) · 실무/수납 `rose-600`(#e11d48).
5. **양끝 여백** — 바 내부 `px-5`(20px) + safe-area-inset → 아이폰 라운드 모서리 잘림 방지.
6. **9px 배지 예외** — STEP 배지는 `text-[9px]`. components.md "배지 11px 하한"의 의도적 예외(칩 위 좁은 보조 표식 전용, 다른 곳 금지). tokens.md 폰트 표에 등재.

## 불변 (ADR-0019 유지)
- 탭 순서·라벨·라우트(`/db` 등)·코드 키·아이콘 SVG.
- 4+1 구조(중앙 캘린더 입체 FAB, `-mt-6`).
- `max-w-bottom-nav` 480px 캡, safe-area 패딩.
- 모든 라우팅 `useGuardedRouter().push`(미저장 가드) 경유.
- a11y: `aria-current`, 아이콘/화살표 `aria-hidden`, FAB `aria-label`, 탭타깃 ≥44px.

## 근거
- STEP 배지 = 단계가 글자로 명시 → 점보다 즉시 읽힘.
- 탭별 색 = "지금 어느 단계"를 색으로 각인(채널 4색과는 별개 레이어, 탭 전용).
- 진회색 비활성(slate-200/600) = 선택 색과 대비 ↑.

## 영향
- `components/TabBar.tsx` 재작성(Dots→STEP 배지·FlowArrow·COLOR 맵).
- tokens.md "탭 단계 색상" + `text-[9px]` 등재. components.md §5 갱신.
