---
slug: admin-cohort-create
status: completed
created: 2026-06-05
completed: 2026-06-05
owner: belie
worktree: ../wt/admin-cohort-create
related: 0007-drive-link-permission, admin-impersonation, registry-cache-columns
---

> ✅ **완료 (2026-06-05)** — P1 #308(기반: ADR-0011, drive-client 쓰기, cohorts D~G, 구조테스트) ·
> P2 #309(생성 흐름 API + 관리자 모달 + 단위테스트) 모두 머지·배포.
> ⚠️ 잔여 운영 검증(PC 정본): 실 공유 드라이브에서 SA(`masterbot@…`)가 멤버(콘텐츠 관리자)인 상태로
> 템플릿 복제·아레나 roster append 동작 확인.

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자 기수 관리에 "기준 시트 복제 생성 + 폴더 매칭/생성"을 추가 — 기존 '주소 붙여넣어 연동'에 더해 양방향(생성/연동)으로, 일반 기수와 아레나 두 구조를 다건·멱등으로 처리.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(admin)
> - **어떤 기능·작업과 연결?**: `app/admin/cohorts`, `app/admin/users`, `app/api/admin/*`, `lib/repo/users-prep.ts`, `lib/repo/cohorts.ts`, `lib/repo/drive-client.ts`, 마스터 레지스트리(`users` 탭), `cohorts` 탭, 신규 ADR-0010(Drive 쓰기 확장)
> - **읽고 나면 알 수 있는 것**: 일반 기수 vs 아레나 데이터·폴더 구조, 시트 복제/폴더 생성 흐름, 멱등(없는 것만 생성) 규칙, 관리자 UX(추가>기수>이름·다건), 필요한 쓰기 권한과 가드레일
> - **관련 문서**: [[docs/decisions/0007-drive-link-permission.md]], [[docs/domains/sheet-structure.md]], [[docs/scope.md]]

# 관리자 기수 관리 — 생성/연동 (일반 기수 + 아레나)

## 0. 확정된 결정 (2026-06-05, 사용자)
1. **데이터 모델: 1인 1시트 유지.** 아레나 참가자도 개인 경영일지 시트를 각자 1개 가짐. 아레나는 "Drive 조직 방식"만 다름(앱 데이터모델 변경 없음).
2. **서비스계정 쓰기 권한 확장(새 ADR-0010).** 템플릿 복제·폴더 생성·공유를 위해 read-only(ADR-0007)에서 확장. 단 "지정 템플릿 복제 + 지정 루트 폴더에만 쓰기"로 범위 제한.
3. **범위: 일반 기수 생성 + 아레나 둘 다** 이번에 설계.

## 0.1 추가 확정 (2026-06-05, 2차)
1. **email 미수집.** 빈값 prep row 만들고 참가자가 **로그인해서 본인 row를 claim**(현행 self-claim 유지). 추가 단계에서 email 안 받음.
2. **공유 드라이브 사용.** 템플릿·루트 폴더·복제본 모두 공유 드라이브에 둠 → 멤버 자동 권한 → **개별 파일 공유(permissions.create) 불필요**. 단 서비스계정이 해당 공유 드라이브 멤버(콘텐츠 관리자 이상)여야 함.
3. **이번 회차: 폴더(루트·이름폴더)는 사용자가 사전 생성.** 앱은 폴더를 만들지 않고 **"이름 매칭 폴더 찾기 + 템플릿 복제"만** 한다. (폴더 자동 생성은 후속 Phase로 분리.)
4. **입력·명칭 규칙**:
   - 추가 입력 = `기수토큰 / 이름` (예: `a1 / 김믿음`, `8 / 김믿음`). **대소문자 무관.**
   - 토큰 판별: 영문 접두(`a`/`A` + 숫자) = **아레나**, 숫자만 = **일반 기수**.
   - 라벨/표기: 아레나 `a1`→저장 `A1`·표기 `A1회`; 일반 `8`→`8기`.
   - 복제 시트 제목:
     - 일반: `세일즈PT_ {N}기 {이름} 수강생 경영일지`
     - 아레나: `세일즈PT_ A{n}회 {이름} 경영일지` (예: `세일즈PT_ A1회 김믿음 경영일지`)
5. 전체 참가자 시트(roster): §11-5 — 기본형(이름·시트링크·폴더링크·등록일, 추가 시 1행 자동) 제안, 최종 확정 대기.

## 1. Intent (왜)
지금은 관리자가 **이미 만들어 둔 시트·폴더 주소를 붙여넣어 매핑만** 한다(`addTraineePrepRow`, Drive 읽기 전용). 신규 기수(예: 8기)·아레나를 열 때 사람마다 시트를 손으로 복제·폴더 정리하는 게 큰 수작업. 이를 **앱에서 기준 시트를 복제해 이름 매칭 폴더에 넣고 레지스트리에 자동 등록**하는 기능으로 없앤다. 기존 "주소 연동"도 그대로 살려 **양방향**.

## 2. 두 구조 비교 (일반 기수 vs 아레나)

| 항목 | 일반 기수 (예: 8기) | 아레나 (예: 아레나 1회) |
|---|---|---|
| 개인 시트 | 1인 1시트 | 1인 1시트(동일) |
| Drive 루트 | 기수 폴더(또는 공용 위치) | **아레나 N회 폴더** 1개 |
| 참가자 폴더 | 개인 **"01 피드백업체"** 폴더 | 아레나 N회 폴더 안 **"이름 폴더"** |
| 시트 위치 | 기존 관례 위치 | 해당 **이름 폴더** 안 |
| 추가 산출물 | 없음 | 아레나 N회 폴더 안 **"전체 참가자 시트"**(로스터/요약 1개) |
| Drive 연결(앱) | 개인 시트 부모 → 01 피드백업체 자동탐색(ADR-0007) | 이름 폴더를 참가자 폴더로 연결 |

→ 차이는 **폴더 토폴로지 + Drive 연결 대상**뿐. 개인 경영일지 시트의 내부 구조(영업관리/업체관리/…)는 동일 템플릿.

## 3. 데이터 모델 변경

### 3.1 `cohorts` 탭 확장 (현재 A:cohort, B:status, C:note)
신규 컬럼(부분 backfill, 빈값 허용):

| 컬럼 | 필드 | 설명 |
|---|---|---|
| D | type | `"cohort"` \| `"arena"` (없으면 cohort) |
| E | templateSheetId | 이 기수/아레나 복제 원본 시트 ID |
| F | rootFolderId | 일반 기수=기수 루트 폴더, 아레나=아레나 N회 폴더 ID |
| G | rosterSheetId | (아레나) 전체 참가자 시트 ID. 일반 기수는 빈값 |

> `lib/repo/cohorts.ts`의 read/write를 A2:G로 확장. `ensureCohortsTab` 헤더 갱신(멱등).

### 3.2 마스터 레지스트리(`users` 탭, A2:P)
- 기존 1인1시트 매핑 그대로(D=spreadsheetId). **per-user 신규 컬럼 불필요**(아레나도 1인1시트).
- `feedbackFolderId`(O)의 의미를 타입별로 해석: 일반=01 피드백업체 폴더, 아레나=이름 폴더. (별 컬럼 안 늘리고 의미 일반화. 필요 시 주석/문서로 명시.)
- 참가자가 어느 기수/아레나인지 = B(cohort label) + cohorts 탭 type 으로 판별.

## 4. Drive/Sheets 쓰기 연산 (신규, ADR-0010)
`lib/repo/drive-client.ts`(또는 신규 `drive-write.ts`)에 추가. 서비스계정 스코프에 `https://www.googleapis.com/auth/drive`(또는 drive.file) 추가. **공유 드라이브 호출이므로 `supportsAllDrives: true` 필수.**

> **이번 회차 실제 필요 연산은 `copyTemplateSheet` + 폴더 정확매칭 검색뿐.** 폴더는 사전 생성(§0.1-3), 공유는 공유 드라이브가 처리(§0.1-2) → `ensureFolder`·`shareFileWith`는 **후속 Phase**로 미룸.

- `copyTemplateSheet(templateId, newTitle, destFolderId)` → `files.copy`({name, parents:[destFolderId]}) → 새 spreadsheetId. (구조·수식 보존)
- `ensureFolder(name, parentId)` → 부모 안에서 이름 정확매칭 폴더 검색(없으면 `files.create` folder). 멱등. (아레나 이름폴더·필요시 01 피드백업체)
- `shareFileWith(fileId, email, role="writer")` → `permissions.create`. 복제 시트를 해당 참가자 google 계정에 공유(+SA 접근 유지). (또는 공유드라이브 사용 시 생략)
- `findFolderByExactName(name, parentId)` / 기존 `findSheetByExactName` 재사용 → 멱등 검사.

**가드레일(ADR-0010 범위 제한)**:
- 쓰기는 **copy(지정 템플릿)→지정 rootFolder** 와 **createFolder(name, 지정 parent)** 와 **permissions.create(공유)** 만. 기존 사용자 데이터 **수정/삭제 절대 금지**(no files.update content, no delete).
- admin 역할 + 지정 rootFolder 하위에서만.
- 구조 테스트로 "drive 쓰기는 신규 함수 화이트리스트만" 강제 검토.

## 5. 관리자 UX 흐름 (추가 > 기수 > 이름, 다건, 멱등)
화면: `app/admin/cohorts`(기수 설정) + `app/admin/users`(참가자) 에 "추가" 진입점.

1. **추가 모드 선택**: ① 새로 생성(복제) / ② 기존 주소 연동(현행). (양방향)
2. **기수 설정**: 기수/아레나 선택 또는 신규 입력 → type(cohort/arena) · templateSheetId · rootFolderId · (아레나) rosterSheetId 지정/확인. (cohorts 탭에 저장)
3. **이름 입력(다건)**: 한 줄 1명(또는 표). (연동 모드면 이름+시트주소 쌍)
4. **실행(배치)** — 각 이름에 대해 멱등 처리:
   - **멱등 검사**: registry에 (cohort,name) row + 유효 spreadsheetId 있으면 → **건너뜀(생성 안 함)**. ("있으면 안 만들고 없는 사람것만")
   - **생성 모드**:
     - 일반 기수: rootFolder(또는 이름 매칭 폴더) 확인 → 제목 관례(`세일즈PT_ {기수} {이름} 수강생 경영일지`)로 templateSheet 복제 → 위치 배치 → 참가자 계정 공유 → `addTraineePrepRow(cohort, name, newSheetId, trainer?)` → (옵션) 01 피드백업체 자동연결.
     - 아레나: 아레나 N회 폴더 안 `ensureFolder(이름)` → 그 안에 templateSheet 복제 → 공유 → `addTraineePrepRow` → 이름폴더를 참가자 폴더로 연결 → rosterSheet에 참가자 1행 갱신(멱등).
   - **연동 모드**: 붙여넣은 시트주소로 기존 `addTraineePrepRow` (현행 동작).
5. **결과 리포트**: 생성 N · 건너뜀(이미 있음) M · 실패 K(+사유). 부분 실패 허용(다건 중 일부만 성공해도 나머지 진행).

> 배치는 순차 + 429 재시도(기존 quota 재시도 패턴 재사용). 100명 상한 등 기존 bulk 가드 준수.

## 6. 신규/변경 API (초안)
- `POST /api/admin/upsert-cohort` — cohorts 탭 type/template/rootFolder/roster 설정.
- `POST /api/admin/create-cohort-members` — `{ cohort, type, mode:"create"|"link", members:[{name, sheetUrl?}] }` → 위 배치 실행, 결과 리포트 반환.
- 기존 `add-trainee-prep`/`bulk-add-trainee-prep`는 "연동 모드" 백엔드로 재사용.

## 7. 권한/공유 처리 (주의)
- SA가 복제한 시트는 **SA 소유** → 참가자가 못 봄. `shareFileWith(sheetId, 참가자email, writer)`로 공유 필수. (또는 템플릿/루트를 **공유 드라이브**에 두고 거기로 복제 → 멤버 권한 자동.)
- 참가자 email을 추가 단계에서 받을지(공유 위해) 결정 필요 → §10 Open.
- SA는 복제본 접근 유지(앱 read/write 위해). 폴더 권한도 SA에 부여돼 있어야 부모 탐색·연결 동작(ADR-0007 §교훈).

## 8. 가드레일 & 문서 (Hashimoto)
- **ADR-0010 신규**: "Drive/Sheets 쓰기 확장 — 템플릿 복제·폴더 생성·공유(관리자, 지정 범위만)". ADR-0007을 supersede가 아니라 **확장**(읽기 규칙은 유지, 쓰기는 화이트리스트 추가).
- 구조 테스트: drive 쓰기 호출은 신규 화이트리스트 함수에서만, 사용자 데이터 update/delete 금지.
- `docs/domains/sheet-structure.md`에 cohorts 탭 D~G 컬럼 등재(SSOT). scope.md에 "관리자 도구 — 기수 생성"이 trainee MVP와 분리된 운영 기능임을 명시.

## 9. 단계(Phase) 분할 (작고 원자적 PR)
- **P1**: cohorts 탭 D~G 확장 + upsert-cohort API + ADR-0010 + drive-write 함수(copy/ensureFolder/share) + 구조테스트. (UI 없이 백엔드·가드.)
- **P2**: 일반 기수 생성 배치(create-missing-only) + 결과 리포트 UI(admin).
- **P3**: 아레나 구조(아레나 N회 폴더·이름폴더·roster) 생성 배치 + 연결.
- **P4**: 연동 모드 UI 통합(생성/연동 토글) + 공유(email) 처리 마무리.

## 10. Acceptance Criteria
- [ ] 관리자가 "추가>기수>이름(다건)"으로, 없는 사람 시트만 템플릿 복제 생성하고 기존은 건너뜀(멱등). 결과 리포트(생성/건너뜀/실패).
- [ ] 일반 기수: 복제 시트가 관례 제목·지정 위치에 생기고 레지스트리 등록 + (옵션)01 피드백업체 연결.
- [ ] 아레나: 아레나 N회 폴더 안에 이름폴더 생성 + 그 안 시트 복제 + 레지스트리(1인1시트) + 전체 참가자 시트 갱신.
- [ ] 양방향: 기존 주소 붙여넣어 연동도 그대로 동작.
- [ ] 복제 시트가 참가자 계정에 공유돼 참가자가 접근 가능.
- [ ] ADR-0010 + sheet-structure 등재 + 구조테스트(쓰기 화이트리스트) 통과. `npm run check` 통과.

## 11. Open questions
1. ✅ 해결 — email 미수집, 빈값 prep + self-claim (§0.1-1).
2. ✅ 해결 — 공유 드라이브 사용, 개별 공유 불필요 (§0.1-2).
3. ✅ (이번 회차) 해결 — 폴더는 사용자가 사전 생성, 앱은 매칭+복제만 (§0.1-3). 폴더 자동 생성은 후속 Phase.
4. ✅ 해결 — 제목 관례 일반/아레나 확정 (§0.1-4).
5. ✅ 해결 — 전체 참가자 시트(roster): **사용자가 빈 표로 사전 생성**(헤더: 이름·시트링크·폴더링크·등록일). cohorts 탭 G(rosterSheetId)에 그 시트 id 저장. 앱은 **아레나 참가자 생성 시 roster에 1행 append**(이름·복제시트 링크·이름폴더 링크·등록일). 일반 기수는 roster 없음. (이번 회차도 "사전 생성" 원칙과 일치 — 앱은 append만.)

## Log
- 2026-06-05 사용자 결정(1인1시트·쓰기확장·둘다) 반영해 기획 초안 작성(Comork working tree). ADR-0010·구현은 PC Claude Code 핸드오프(§6.7).
