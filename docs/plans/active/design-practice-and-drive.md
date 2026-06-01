---
slug: practice-drive-shortcut-design
status: active
created: 2026-06-01
worktree: ../wt/practice-drive-shortcut
related: practice-and-drive
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납·Drive 기능의 설계(레이어·모듈 지도·세션 분할). Scope 1 상세.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `practice-and-drive.md` Plan, `lib/repo/drive-client.ts`, 온보딩, 요약카드
> - **읽고 나면 알 수 있는 것**: 모듈 책임 분리, Scope별 worktree/PR 흐름
> - **관련 문서**: `docs/plans/active/practice-and-drive.md`, `docs/decisions/0006~0008-*.md`

# Design — 실무진행 & 드라이브 연동 (Scope 1 집중)

> 위치: `docs/plans/active/design-practice-and-drive.md`
> 짝 문서: `practice-and-drive.md`(Plan v6), `0006-practice-data-model.md`, `0007-drive-link-permission.md`, `0008-tab-label.md`
> 범위: **Scope 1(Drive 바로가기) 완전 설계 + 전체 모듈 지도.** Scope 2·3은 착수 시 상세화.

---

## 1. 설계 원칙 (Plan §2 요약)
- `02` 불변(합계 수식 의존) · 구글 시트 탭 미증가(Scope1) · 진행기관=레지스트리 연결 · ToDo에 깔끔한 키(contract_ref/institution_ref) · layered import 준수.

## 2. 아키텍처 한눈에 (레이어)
| 레이어 | 역할 |
|---|---|
| UI | "실무/수납" 탭(수강생 요약 + 업체 카드), 온보딩/등록 폼 |
| 서버(액션/route) | drive-link 처리, 시트 읽기/쓰기 오케스트레이션 |
| 데이터 접근 | master registry read/write, `02`·`04` read (me-bundle / pMapBundle 재사용) |
| 외부 연동 | Google Drive API 클라이언트(SA), Google Sheets API |

> 정확한 파일/심볼명은 Code 세션에서 기존 구조에 맞춰 확인. 부록 G(레포 실측) 참조.

## 3. Scope 1 상세 — Drive 바로가기

### 3.1 흐름 (3단계)
1. **등록**: 온보딩(`app/api/setup/route.ts`, 경영일지 URL 입력)에서 **Drive 부모 폴더 경로**도 함께 입력 → master registry 저장.
2. **연결(탐색)**: 부모 폴더에서 `01 피드백업체` 폴더 탐색(**폴더용 신규 함수** — `findSheetByNamePrefix`는 spreadsheet 전용이라 못 씀, ADR-0007). prefix 매칭: `01 ` 시작 + "피드백" 포함 → `feedback_folder_id` 저장.
3. **사용**: "실무/수납" 탭 수강생 요약에 누적 수납/승인 **중앙 정렬** + **[Drive 바로가기]** → `01 피드백업체` 폴더 새 탭으로 열기.

### 3.2 데이터 (master registry 칸 추가)
- `drive_parent_path` (입력) · `feedback_folder_id` (탐색 결과) · `drive_link_status`(ok/미연결/오류) · `drive_linked_at`

### 3.3 권한
- SA(`masterbot@saleslog-494703.iam.gserviceaccount.com`)가 부모 폴더에 최소 **viewer** 필요. 온보딩 안내에 "SA 이메일을 부모 폴더에 공유" 단계 포함. (코드로 자가 부여 불가 — belie 수동 1회.)

### 3.4 예외 처리
- 폴더 못 찾음 / 권한 없음 / 경로 오타 → 상태 배지 표시 + **[다시 연결]**(경로 재입력 → 재탐색).

### 3.5 범위 밖
- 폴더 생성, 업체별 deep link, 권한 자동 부여.

## 4. 모듈 지도 (역할 기준)
- **(UI) 탭바**: 라벨 `"수납"`→`"실무/수납"`, 아이콘 유지 (Plan 부록 A · ADR-0008).
- **(UI) "실무/수납" 요약 영역**: 누적값 중앙 정렬 + [Drive 바로가기]/[플러그] 버튼 + 상태 배지.
- **(UI) 온보딩/등록 폼**: Drive 부모 폴더 경로 입력칸 + SA 공유 안내.
- **(서버) drive-link 액션**: 경로 수신 → Drive API로 `01 피드백업체` 탐색 → registry 저장 → 결과 반환.
- **(데이터) registry 접근 레이어**(`lib/repo/users.ts`): 위 칸 read/write.
- **(외부) Drive API 클라이언트(SA)**(`lib/repo/drive-client.ts`): 폴더용 신규 검색 함수, 열기 URL 구성.

## 5. 세션 분할 (worktree + PR)
| 세션 | 내용 | 레이어 |
|---|---|---|
| S1-a | registry 스키마 + 온보딩 폼에 경로 입력칸 | 데이터/입력 |
| S1-b | drive-link 액션 + `01 피드백업체` 폴더 탐색·저장 (신규 folder 함수) | 서버/외부 |
| S1-c | "실무/수납" 요약 UI(누적값 중앙 + 버튼) + 탭바 라벨 + 배너 시트참조 제거 | UI |
| S1-d | 예외/재연결 + 권한 안내 마감 | 마감 |

각 세션 독립 PR, `npm run check` 통과 후 머지.

## 6. 다음 (Scope 2·3 착수 시 상세)
- **Scope 2**: `05 실무투두` 탭 신설 + ToDo 행(contract_ref/institution_ref) + Pluuug식 팝업 + 신규 `lib/repo/todos.ts` + 달력 연동(04 미팅 + 05 투두 머지, 진회색+아이콘).
- **Scope 3**: `02` 슬롯 + `05` 투두 키 조인 뷰(업체별/기관별) + `02` 진행기관 → 레지스트리 연결 전환 + 요약카드 [플러그 바로가기] 제거.
