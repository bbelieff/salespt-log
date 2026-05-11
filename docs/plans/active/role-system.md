---
slug: role-system
status: active
created: 2026-05-11
worktree: ../wt/roles
---

# feat(auth): 3-tier 역할 시스템 (admin / trainer / trainee)

## 사용자 결정 (2026-05-11)

3개 admin email:
- `beliefkimkim@gmail.com`
- `leadbzcenter@gmail.com`
- `xorud910115@gmail.com`

3-tier 권한:
- **admin**: 전체 회원 조회·편집 + 역할 변경 + 시트 조회·편집
- **trainer**: 본인 + 담당 수강생만 조회·편집 (admin 이 배정)
- **trainee**: 본인만

## 흐름 (이번 PR)

### Trainer 가입
1. Google 로그인 → /claim
2. 기수란에 **"T"**, 이름란에 본인 이름 입력
3. 서버: registry append (role=trainer, status=pending)
4. /trainer → "승인 대기" 화면
5. 관리자가 /admin 에서 승인 → status=active

### Trainer 사용
1. /trainer → 마스터 시트 링크 + 담당 수강생 목록
2. 수강생 클릭 → impersonation cookie set → /dashboard
3. 5탭 UI 에서 그 수강생의 데이터 조회·편집

### Admin 사용 (이번 PR)
- /admin: 사용자 선택 화면 (기존)
- 곧 추가: 트레이너 승인 / 수강생 배정 UI

## 추가된 파일

| 영역 | 파일 |
|---|---|
| types | `lib/types/index.ts` — User 에 status + assignedTrainer 추가 |
| repo | `lib/repo/users.ts` — A~G 컬럼 read/write, listAllUsers/listTraineesForTrainer/listPendingTrainers/approveTrainer/assignTrainerToTrainee/setUserRole |
| auth | `lib/auth/identity.ts` — getEffectiveRole, canImpersonate (권한 게이트) |
| service | `lib/service/auth.ts` — claimAccount, cohort="T" 분기 (trainer pending) |
| api | `/api/admin/approve-trainer`, `/api/admin/assign-trainee` |
| ui | `/trainer/page.tsx` + `components/auth/TrainerLanding.tsx` |
| route | `app/page.tsx` 역할별 redirect, `middleware.ts` /trainer 보호 |

## 시트 레지스트리 컬럼 (확장)

| Col | Field | 예 |
|---|---|---|
| A | email | belief@gmail.com |
| B | cohort | 7 / T (트레이너) / 빈값 |
| C | name | 김상목 |
| D | spreadsheetId | trainee 만 |
| E | role | trainee/trainer/admin |
| F | status | active/pending |
| G | assignedTrainer | (trainee row 에 배정된 트레이너 email) |

기존 6기 row 들도 status=active 자동 (기본값).

## env

```
ADMIN_EMAILS=beliefkimkim@gmail.com,leadbzcenter@gmail.com,xorud910115@gmail.com
```

## TODO — 관리자 페이지 본 설계 (다음 PR)

기획부터 잡을 영역:

### 화면 구조
1. **사용자 탭** (현재 /admin)
   - 전체 회원 목록 (기수별 그룹)
   - 검색 / 필터 (역할·상태)
   - 클릭 → impersonate

2. **트레이너 관리 탭** (신규)
   - Pending 승인 대기 목록 → 승인/거절 버튼
   - 활성 트레이너 목록 → 담당 수강생 수 표시 → 클릭 시 배정 화면

3. **수강생 배정 탭** (신규)
   - 배정/미배정 수강생 분리
   - 드래그/드롭 또는 select dropdown 으로 트레이너 배정
   - bulk 작업

4. **시트 조회 탭** (신규)
   - 마스터 시트 iframe 또는 외부 링크
   - 개인 시트 일괄 링크 표시

5. **역할 관리 탭** (신규)
   - 특정 사용자 role 변경 (trainee ↔ trainer ↔ admin)
   - 위험 액션이므로 confirm dialog 필수

### 기획 결정 필요
- 트레이너 승인 시 자동 알림 (이메일/슬랙)?
- 수강생 배정 시 트레이너에게 자동 알림?
- 트레이너 자기 클레임 시 어떤 정보 더 받을지 (소속, 연락처 등)?
- 권한 변경 audit log 시트에 기록?
- 수강생이 트레이너 변경 요청 가능?

## Acceptance (이번 PR)

- [x] typecheck
- [x] lint
- [x] structural
- [x] tests
- [x] doc-drift
