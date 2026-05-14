> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TraineeCard 2행 풀폭 재배치 (공간 손실 제거) + 팀박스 토글이 기수박스까지 닫던 버그 fix + 펼침/접힘 애니메이션.
> - **누가 읽나요**: 개발자 (UI 레이아웃 + PersistentDetails 이벤트 처리)
> - **어떤 기능·작업과 연결?**: `components/auth/TraineeCard.tsx`, `components/auth/PersistentDetails.tsx`, `app/globals.css`
> - **읽고 나면 알 수 있는 것**: 왜 팀박스 닫으면 기수박스가 닫혔나? 카드 공간 손실 원인?
> - **관련 문서**: `docs/design/components.md`

# Trainee card 재배치 + 팀박스 토글 버그 + 펼침 애니메이션

## 배경 (사용자 피드백 2026-05-14)

> 수강생 관리 > 수강생 카드 노는 공간이 너무 많아. 질서정연하고 공간손실 없게 재배치.
> [1] 팀박스를 닫으면 기수박스 전체가 닫혀버림 → 팀박스만 닫히게. 닫히고 열리는
>     인터렉션(애니메이션)도 추가 — 갑자기 많은 픽셀 변화로 혼란 주지 않게.

## 변경 1 — TraineeCard 2행 풀폭 재배치

**문제**: 데스크탑에서 info-block (이름/팀/담당 3줄) 옆에 buttons-block (1줄) 이
`sm:items-center` 로 세로 중앙 정렬 → **버튼 위아래로 큰 빈 공간**.

**해결**: 2행 풀폭 레이아웃.
```
[⋮⋮] │ 김상목 🔗+1            [유보] [📊시트↗] [웹앱→]   ← Row1 (justify-between)
      │ 팀[부산]  담당: 김종근, 황의진 ▼................  ← Row2 (팀 compact + 담당 flex-1)
```
- Row 1: 이름+배지 (좌) ↔ 액션버튼 (우), `justify-between` → 풀폭.
- Row 2: 팀 (shrink-0) + 담당 (flex-1, break-words) → 풀폭.
- content-wrapper: `flex-col gap-1.5` (항상 2행, sm:flex-row 제거).
- 담당이 트레이너 다수로 아래로 늘어나도 Row1 버튼은 위 고정 → 안 가림.

## 변경 2 — 팀박스 토글 → 기수박스 닫힘 버그

**원인**: 중첩 `<details>` (기수박스 > 팀박스). 팀박스 toggle 이벤트가 React
synthetic event 로 부모(기수박스) `handleToggle` 까지 전파 → `e.target.open`
(팀박스의 false) 을 기수박스가 받아서 같이 닫고 localStorage 에도 기수=false 저장.

**해결** (`PersistentDetails.handleToggle`):
- `if (e.target !== e.currentTarget) return` — 자식 details 발 이벤트 무시.
- `e.currentTarget.open` 사용 (target 아님) — 항상 "이 details" 의 상태만 읽음.

## 변경 3 — 펼침/접힘 애니메이션

`app/globals.css` 에 `.pd-animated` 규칙:
- `::details-content` + `interpolate-size: allow-keywords` + `transition-behavior:
  allow-discrete` → block-size 0↔auto 부드러운 전환 (0.24s).
- `PersistentDetails` 가 `pd-animated` 클래스 자동 부착.
- Chrome 131+/모던 브라우저 (admin 전용 화면 — 커버리지 충분). 미지원 시 native
  즉시 토글로 graceful degrade.
- `prefers-reduced-motion` 존중.

## 검증

- [x] `bash scripts/check.sh` 통과
- [ ] 사용자 라이브: 카드 빈 공간 없이 2행 정렬
- [ ] 사용자 라이브: 팀박스 닫아도 기수박스 안 닫힘
- [ ] 사용자 라이브: 펼침/접힘 부드러운 전환
