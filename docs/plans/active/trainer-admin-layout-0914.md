# 트레이너 관리 화면 레이아웃·정렬 수리 (수리4)

- **상태**: 진행
- **요청**: belie, 2026-09-14 Slack
- **base**: `e262903`
- **브랜치**: `fix/trainer-admin-layout-0914`

## 배경

수리3(PR #973, `e262903`)가 `/admin/trainers` 셸 폭을 통일했지만, 페이지가 여전히
«셸 div + TrainerMgmtPanel» 두 덩어리였다. 패널이 자기 sticky 헤더를 소유하므로
헤더가 페이지 중간(실측 `t=1029`)에 놓이고, 초대·권한 카드가 그 헤더보다 **위**에 떴다.

내 배포 후 검증도 틀렸다. `horizontal_overflow_px: 0` 만 재고 "정렬 통과"로 보고했다.
넘침 없음과 기준선 일치는 다른 명제다 — 좌표를 비교했어야 했다.

## 수리 5건

1. **헤더 정렬** — 페이지를 `TrainerMgmtPanel` 단일 루트로. 헤더 1개, 모든 섹션이 그 아래
   같은 셸 폭. 초대·권한은 `accessSlot`/`inviteSlot` 으로 패널 안에 주입.
2. **기수 최신순 + 아레나 하단** — `cohortSortTuple` 그룹 우선순위를
   `아레나(0)/일반(1)` → `일반(0)/아레나(1)` 로 뒤집음. 같은 그룹 안은 기존대로 desc.
3. **초대 취소 기록 숨김** — `TrainerInvites` 가 `revoked_at`·만료를 화면에서 제외.
   **DB 행은 그대로** — `revoke` 는 여전히 `action:"revoke"` 만 보내고 감사 추적을 남긴다.
4. **섹션 순서** — 담당부여 → 권한부여 → 요청관리 → 초대관리 → 수강생명단 → 관리부서.
5. **권한부여 접힘** — 새 `CollapsibleSection`(기존 `PersistentDetails` 재사용, 상태 영구 저장).

## 파급

`cohortSortTuple` 은 `lib/repo/users.ts`·`AdminUserPicker`·`TrainerCohortView`·
`UsersRoster` 가 공유한다. → `/admin/users`·`/trainer` 기수 순서도 같이 바뀐다. 의도된 것.

## 회귀 가드

`tests/structural/admin-page-shell.test.ts`:
- 페이지가 패널 단일 루트인가 (Fragment 금지 — 사고 ② 재발 방지)
- 폭 선언이 패널 한 곳뿐인가
- 헤더가 1개이고 모든 섹션이 `</header>` 뒤인가
- 섹션 순서가 belie 지정 순서인가
- 초대 목록이 화면 필터를 쓰되 revoke 가 delete 가 아닌가

`tests/repo/rejoin-routing.test.ts`: 아레나가 어떤 일반 기수보다도 아래인가.

## 검증

- [ ] `bash scripts/check.sh`
- [ ] `npx next build`
- [ ] 프로덕션 실화면 — **헤더/섹션 좌표 일치를 좌표로 확인** (넘침 0 만으로 판정 금지)
