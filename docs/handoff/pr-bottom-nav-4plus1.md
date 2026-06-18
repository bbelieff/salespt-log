# PR 프롬프트 — 바텀탭 4+1 컴포넌트화 (activation redesign · 바 단계)

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 하단 네비게이션을 4+1(중앙 캘린더 FAB) 구조로 재배치·컴포넌트화하고 머지·배포까지 수행하는 개발 세션용 PR 프롬프트.
> - **누가 읽나요**: 개발자 / 사용자 PC의 Claude Code (실행 주체).
> - **어떤 기능·작업과 연결?**: `components/TabBar.tsx`, `app/(app)/layout.tsx`, `docs/design/components.md §5`, `docs/design/prototypes/bottom-nav-4plus1.html`.
> - **읽고 나면 알 수 있는 것**: 무엇을 바꾸나 / 정확한 스펙 / 컴포넌트 구조 / 체크리스트·머지·배포·롤백 절차.
> - **관련 문서**: [bottom-nav-4plus1.html](../design/prototypes/bottom-nav-4plus1.html)(정본), [components.md](../design/components.md) §5, [playbooks/deploy-vps.md](../playbooks/deploy-vps.md).

---

## 0. 이 PR의 스코프 (딱 여기까지)

**바(하단 네비게이션)만** 재배치·컴포넌트화한다. 기능 변경(`DB생산 집계쓰기`, 컨택관리 경량화, 현수막 게시 2단계, 미기록 넛지, 직접생산 기간폼)은 **별도 PR**이며 이 PR에 넣지 않는다(YAGNI·작은 PR 원칙).

이 PR이 바꾸는 것:
1. 5탭 순서·라벨·중앙 FAB 재배치
2. 탭 라벨 `DB관리 → DB생산`(사용자 노출 문자열만)
3. 단계 인디케이터(점 갯수) + 중앙 캘린더 입체 FAB
4. 넓은 화면 최대폭 캡 + 중앙정렬

> ⚠️ `components.md §5`가 "5탭 순서·라벨·아이콘 고정(변경 시 ADR 필요)"으로 박혀 있다 → **ADR 작성이 선결**.

---

## 1. 브랜치 · 계획

- 브랜치: `feat/bottom-nav-4plus1` (CLAUDE.md §6.5 네이밍 규칙)
- 워크트리에서 작업 (메인 직접 수정 금지, §3-4)
- 계획 파일: `docs/plans/active/bottom-nav-4plus1.md` 생성 → 완료 시 `docs/plans/completed/`로 이동

---

## 2. 정본 참조

`docs/design/prototypes/bottom-nav-4plus1.html` 를 **픽셀 매칭으로 React 포팅**한다. 아이콘 SVG는 기존 `TabBar.tsx`의 path 를 그대로 유지(레거시 보존).

---

## 3. 정확한 스펙

### 3.1 탭 구성 (좌 → 우)

| 위치 | 라벨 | route | 아이콘(기존 재사용) | 단계 점 |
|---|---|---|---|---|
| 1 | DB생산 | `/db` | DbIcon(카트) | ●（1） |
| 2 | 컨택관리 | `/contact` | ContactIcon(수화기) | ●●（2） |
| 중앙 | 캘린더 | `/calendar` | CalendarIcon | 없음 |
| 3 | 일정·계약 | `/schedule` | ScheduleIcon | ●●●（3） |
| 4 | 실무/수납 | `/payment` | PaymentIcon(코인) | ●●●●（4） |

- 단계 점 = 라벨 **아래** 점 갯수(서수 X, 알림 뱃지 X). 현재(active) 탭만 파랑(`blue-600`), 나머지 회색.
- active 판정은 기존대로 `usePathname()`.

### 3.2 중앙 캘린더 FAB (중립 입체)

- 흰 원 + `0.5px` 테두리(`gray-300`) + 부드러운 그림자(표준 Tailwind `shadow`/ring 사용, **arbitrary value 금지**) + 위로 띄움(`-mt` / `-translate-y`, `z-50`).
- 아이콘 회색(`gray-500`), `/calendar` active 시 파랑.
- **대시보드(홈)보다 약한 강조** — 색 채움 없이 입체감만. (홈=대시보드는 `TopHeader`에 그대로, 건드리지 않음)
- 띄운 FAB가 콘텐츠를 가리지 않게 `layout.tsx`의 `paddingBottom`(현재 76px) 유지·검증.

### 3.3 반응형 (좌우 한계)

- 모바일: `w-full`, 탭 `flex-1`(전체폭 균등).
- 넓은 화면: 내부 컨테이너 `max-width 480px` + `mx-auto`, 캡 안에서 탭 `flex-1` 균등(고정폭 금지 — 비좁아 보임). 캡 초과분은 양옆 여백.
- 기존 `pc:max-w-2xl`(672px) → `pc:max-w-[480px]` 상당으로(또는 토큰화). `env(safe-area-inset-*)` 패딩 유지.

### 3.4 라벨 리네임

- 사용자 노출 문자열 `DB관리 → DB생산`: `TabBar` 라벨 + `/db` 페이지 `TopHeader pageTitle`.
- 라우트(`/db`)·코드 키·주석·내부 식별자는 **그대로**(이 PR은 이름표만). `grep "DB관리"`로 노출 문자열만 선별 변경, 테스트가 라벨을 단언하면 같이 갱신.

---

## 4. 컴포넌트화 설계

`components/TabBar.tsx` 를 **설정 기반**으로 리팩터:

- `TABS` 배열에 `{ href, label, Icon, step }` (중앙 캘린더는 `variant:'center'`로 분리).
- 하위 프리미티브 추출: `TabItem`(아이콘+라벨+점), `CenterFab`(입체 캘린더). 한 파일 유지 가능하나 ≤500줄 준수.
- 모든 (app) 페이지는 `layout.tsx`가 이미 `<TabBar/>`를 렌더 → **자동 전 탭 적용**. 페이지별 추가 작업 불필요(콘텐츠 하단 패딩만 확인).
- 점 갯수·active·반응형은 컴포넌트 내부 책임. 페이지는 props 없이 사용.

---

## 5. SSOT · 문서 갱신 (같은 PR에서)

1. **ADR 신규**: `docs/decisions/0019-bottom-nav-4plus1.md` — "5탭 재배치 + DB관리→DB생산 라벨 + 중앙 캘린더 FAB + 단계 점 인디케이터" 결정·근거(활성화 퍼널 순서 의미전달). ADR은 불변.
2. `docs/design/components.md §5` — 탭 순서·라벨·중앙 FAB·점 인디케이터·반응형 캡으로 **재작성**. §컴포넌트 표(TabBar 행)도 갱신.
3. `docs/design/prototypes/bottom-nav-4plus1.html` — 정본으로 추가(본 PR 동봉).
4. 디자인 토큰이 필요하면(그림자 강도 등) `docs/design/tokens.md`에 먼저 등재 후 사용(arbitrary value 금지).

---

## 6. PR 전 체크리스트 (하나라도 빨강이면 PR 금지 · 우회 금지)

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:structural`
- [ ] `npm run test`
- [ ] 파일 ≤ 500줄 (`scripts/check.sh`)
- [ ] `scripts/doc-drift.sh` (신규 컴포넌트/심볼이 SSOT에 등재됐는지)
- [ ] pre-commit 훅 통과 (plan 있는 변경, main 직접커밋 X)
- [ ] **시각 검증**: 모바일 폭 + 넓은 폭(>480px) 스크린샷, 각 라우트에서 active 표시·점 색·중앙 FAB 위치·여백 확인(에이전트가 스크린샷 남길 것, §3-5)

> Cowork(샌드박스)에서는 git 쓰기·커밋 불가(§6.7). 이 작업은 **사용자 PC의 Claude Code**에서 실행한다.

---

## 7. 커밋 · 머지

- 단일 커밋 PR(이 레포는 squash merge).
- 커밋 제목(conventional): `feat(nav): 바텀탭 4+1 재배치 + DB생산 라벨`
- 커밋 본문에 Changelog 한 줄(토스 문체, 수강생용, §6.5):
  `Changelog: 자주 쓰는 메뉴를 한눈에 보기 쉽게 아래 메뉴 배치를 정리했어요.`
- 검증 통과 → `--squash` 머지.

---

## 8. 배포 관찰 + 롤백 (머지로 끝내지 말 것 · §6.8)

1. 머지 직전 last-good SHA 기록: `git rev-parse origin/master`
2. `master` push → `.github/workflows/deploy.yml` 자동 트리거. 끝까지 관찰:
   `gh run list --workflow="Deploy to VPS" -L1` → `gh run view <id> --json conclusion`
3. 분기:
   - success → 공개 health `https://salesptlog.online` HTTP 200 확인 후 완료 보고.
   - build/health 실패 → **즉시 롤백**: `git revert <bad-squash-sha>` → `git push origin master`(자동 재배포) → success+health 재확인.
4. 실패·롤백 시 `docs/incidents/`에 기록. 상세 절차 = `docs/playbooks/deploy-vps.md`.

---

## 9. 수용 기준 (Acceptance)

- [ ] 5개 (app) 페이지 모두에서 새 바가 동일하게 보인다(좌→우: DB생산·컨택관리·[캘린더]·일정·계약·실무/수납).
- [ ] 단계 점이 1·2·3·4로 보이고 현재 탭만 파랑.
- [ ] 중앙 캘린더가 입체 FAB로 떠 있고, 대시보드(상단 홈)보다 약한 강조.
- [ ] 넓은 화면에서 탭이 480px 캡 안에 균등하게 펴지고(비좁지 않음) 양옆은 여백.
- [ ] 탭 라벨이 `DB생산`(라우트는 `/db` 유지).
- [ ] 체크리스트 전부 green + 배포 success + 공개 health 200.
