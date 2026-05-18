---
slug: admin-team-collapse-persist
status: active
created: 2026-05-13
worktree: ../wt/team-collapse-persist
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: /admin/users 의 기수·팀·유보 박스 펼침/닫힘 상태를 localStorage 에 저장해 새로고침 후 복원.
> - **누가 읽나요**: 개발자 (admin UX 작업 시)
> - **어떤 기능·작업과 연결?**: `/admin/users` 라우트, `components/auth/AdminUserPickerSections.tsx`, 신규 `components/auth/PersistentDetails.tsx`
> - **읽고 나면 알 수 있는 것**:
>   - 왜 `<details>` 직접 안 쓰고 wrapper 만들었나
>   - localStorage 스키마와 충돌 방지 키 규칙
>   - SSR hydration mismatch 회피 패턴
> - **관련 문서**: [components.md](../../design/components.md)

# feat(admin/users): 박스 펼침/닫힘 상태 영구 저장

## 배경

사용자 보고 (2026-05-13):
> "나갔다 들어오면 다 펼쳐있네. 펼침/닫힘 상태도 저장 필요할 듯."

기존 `<details open>` 은 매 페이지 진입마다 default 로 리셋. 23 trainee × 다수의 팀 박스 환경에서 admin 이 자주 사용하는 박스만 펼친 채로 유지하고 싶음.

## 설계 결정

### A. 어디에 저장하나
- **localStorage** (브라우저 로컬). 서버 상태가 아니라 운영자 개인 UI 선호도.
- 디바이스 간 동기화 불필요 (admin 본인 한 명).

### B. 어떻게 저장하나
- 단일 JSON object 키 `salespt:admin:collapsed`.
- 키 패턴:
  - `cohort:<N>` — 기수 박스 (예: `cohort:7`, `cohort:6:archived`)
  - `team:<cohort>:<team>` — 팀 박스 (예: `team:7:서울`)
  - `reserved` — 유보 섹션

### C. SSR hydration 문제 회피
- React 의 first render 는 `defaultOpen` 그대로 (SSR + 클라이언트 hydration 일관).
- mount 후 `useEffect` 가 localStorage 값 읽어 `setOpen` 호출 → 다음 tick 에 반영.
- 사용자 인지 거의 없음 (~16ms 깜빡임 가능하지만 무해).

### D. 왜 `<details>` 그대로 안 쓰고 wrapper?
- HTML5 `<details>` 의 `open` 속성은 사용자 토글 시 자체 갱신 — 제어 불가.
- localStorage 동기화는 `onToggle` 이벤트 + 다음 render 에 `open` 적용 필요.
- 3곳 (Cohort/Team/Reserved) 에서 같은 패턴 반복 → 공통 컴포넌트로 분리.

## 변경

| 파일 | 변경 |
|---|---|
| `components/auth/PersistentDetails.tsx` | 신규. `<details>` 래퍼 + localStorage 동기화. |
| `components/auth/AdminUserPickerSections.tsx` | 3곳의 `<details>` → `<PersistentDetails>` 교체. CohortSection 이 cohort prop 을 CohortBody 로 전달 (팀 키 구성용). |
| `docs/design/components.md` | PersistentDetails 등록. |

## Acceptance

- [x] typecheck PASS
- [x] lint PASS
- [x] test:structural PASS
- [ ] 수동 검증: /admin/users 진입 → 기수 1개 접고 새로고침 → 그대로 접혀 있음
- [ ] 수동 검증: 팀 박스 접고 새로고침 → 그대로
- [ ] 수동 검증: 유보 섹션 펼치고 새로고침 → 그대로 펼쳐짐
