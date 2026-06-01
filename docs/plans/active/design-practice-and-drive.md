---
slug: practice-drive-shortcut-design
status: active
created: 2026-06-01
worktree: ../wt/practice-drive-shortcut
related: practice-and-drive
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납·Drive 기능의 설계(레이어·모듈 지도·세션 분할). Scope 1·2 상세.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `practice-and-drive.md` Plan, `lib/repo/drive-client.ts`, 온보딩, 요약카드
> - **읽고 나면 알 수 있는 것**: 모듈 책임 분리, Scope별 worktree/PR 흐름
> - **관련 문서**: `docs/plans/active/practice-and-drive.md`, `docs/decisions/0006~0008-*.md`

# Design — 실무진행 & 드라이브 연동 (Scope 1·2)

> 위치: `docs/plans/active/design-practice-and-drive.md`
> 짝 문서: `practice-and-drive.md`(Plan v6), `0006-practice-data-model.md`, `0007-drive-link-permission.md`, `0008-tab-label.md`
> 범위: **Scope 1(Drive 바로가기)·2(05 실무투두+캘린더) 완전 설계 + 전체 모듈 지도.** Scope 3은 착수 시 상세화.
> 진행: ✅ Scope 1 머지(PR #255) · ✅ Scope 2 머지(PR #257) · ⬜ Scope 3 (§7, 미착수).
> 시각 정본: `docs/design/prototypes/practice-payment-mockup.html`(슬롯 ToDo·팝업), `docs/design/prototypes/calendar-todo-mockup.html`(캘린더 04+05).

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

## 6. Scope 2 상세 설계 — 05 실무투두 + 캘린더

> 정본: Plan §3.2·§5·부록 F, ADR-0006, mockup 2종. 본 절은 "착수 시 상세화"(구 §6) 약속 이행.

### 6.1 데이터 키 (Plan §10 미해결 → 확정)
- **`contractRef` = `${계약일}|${업체명}`** — 02 계약의 안정 식별자. 시트 행번호(row) **아님**(행 이동/정렬에 강건, 02는 append 위주라 (계약일,업체명) 쌍이 사실상 고유). payment UI에서 `cp.계약일 + "|" + cp.업체명` 으로 합성.
- **`institutionRef` = 슬롯 `진행기관` 텍스트** (ToDo 생성 시점 스냅샷). 진행기관이 빈 슬롯에는 ToDo 추가 비활성(진행기관 입력 후 활성).
- 슬롯 ToDo 조회 = `todos.filter(t => t.contractRef === cr && t.institutionRef === slot.진행기관)`.
- 엣지(동일 계약 내 두 슬롯이 같은 진행기관) → 두 슬롯이 ToDo 공유. 의미상 동일 기관이라 수용(드묾). 슬롯 인덱스 분리는 YAGNI.

### 6.2 `05 실무투두` 시트 (앱 자동 생성)
- 신규 탭 `05 실무투두`. **앱 자동 생성** — `ensureTodoTab(sid)`: `spreadsheets.get`으로 탭 존재 확인 → 없으면 `batchUpdate{addSheet}` + 헤더행 `A1:M1` write. 모든 append/read 진입 전에 1회(존재 시 no-op, in-process 캐시로 중복 호출 방지).
- 컬럼 A~M (13, 부록 F):

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | contractRef | institutionRef | 업체명 | type | 제목 | 예정일자 | 예정시각 | 장소 | 상세 | showOnCalendar | 완료여부 | 생성시각 |

- **수식 컬럼 없음** → meetings의 split-write(N/O/Q/S 보존) 로직 **불필요**. 전체 행 `A:M` 한 번에 write.
- bulk-write 가드(CLAUDE §2-5): update는 자기 `id` 행만(findById→merge→해당 행 write), append는 A열 기준 빈 행만 → 타 사용자값 침범 0. (전 사용자 일괄쓰기 함수 아님 → pre-read 가드 비대상이나 정신 준수.)

### 6.3 Todo 타입 (Zod · `lib/types` → data-model.md 등재)
```
export const TodoType = z.enum(["기타","미팅","전화","메시지"]);
export const Todo = z.object({
  id: z.string(),
  contractRef: z.string(),                       // "계약일|업체명"
  institutionRef: z.string().default(""),        // 슬롯 진행기관
  업체명: z.string().default(""),
  type: TodoType.default("기타"),
  제목: z.string().min(1, "제목 필수"),
  예정일자: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  예정시각: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).default(""),
  장소: z.string().default(""),
  상세: z.string().default(""),
  showOnCalendar: z.boolean().default(true),
  완료여부: z.boolean().default(false),
  생성시각: z.string().default(""),               // ISO
});
```
- 필드명 컨벤션(data-model.md): 시스템/키 = 영어(id/contractRef/institutionRef/type/showOnCalendar), 시트 도메인 = 한국어(업체명/제목/예정일자…). Meeting·User 패턴과 일치.

### 6.4 repo `lib/repo/todos.ts` (meetings.ts 본보기)
- 함수: `ensureTodoTab(sid)` · `appendTodo(sid, todo)` · `updateTodo(sid, id, partial)` · `clearTodo(sid, id)` · `listTodosByContract(sid, contractRef)` · `findTodosByDateRange(sid, dates)`(캘린더용 — `showOnCalendar=true` & `예정일자∈dates`).
- `todoToRow`/`rowToTodo`(Zod safeParse) + `serialToISODate`/`serialToHHMM`(meetings에서 복제 — repo 격리 원칙상 공유 안 함). id = `crypto.randomUUID()`.

### 6.5 service / api / query
- service(`lib/service/practice.ts` 신규 또는 `contact.ts` 확장): todo CRUD 유스케이스 + email→sid는 me-bundle 재사용.
- **`loadMonthMeetings` 확장** → `CalendarMonthView`에 `daysByTodoDate: {date, todos: Todo[]}[]` 추가. 04 `findByDateRange` + 05 `findTodosByDateRange` 를 `Promise.all`(quota 1+1 read).
- api: `app/api/todos/route.ts` (GET `?contractRef=` list / POST append / PATCH update / DELETE clear). 월간 캘린더 API는 service 확장으로 자동 포함.
- query hooks: `useTodosByContract` / `useAppendTodo` / `usePatchTodo` (기존 contract-payment 훅 패턴).

### 6.6 payment UI (mockup: practice-payment-mockup.html)
- `PaymentSlotForm.tsx`: **메모 필드 ↔ 진행률 그리드 사이**에 ToDo 섹션 삽입. dashed amber 박스 — 헤더("ToDo"·이 기관 할 일) + 항목 목록(type 배지 + 제목 truncate + "M/D HH:MM") + `[+ ToDo 추가]`.
- 신규 컴포넌트(components.md 등재): **`TodoSection`**(슬롯 내 목록+추가 버튼, props: contractRef·institutionRef·업체명·todos) + **`TodoFormModal`**(Pluuug식 팝업 — type탭 4종(기타 기본)·제목*·예정일자*·예정시각 시(08~20)/분(00·30)·상세·"캘린더 표시" 체크(기본 ON)·[생성]).
- `ContractRow`가 슬롯별 todos를 쿼리해 `PaymentSlotForm`에 주입. 생성/완료 토글 후 invalidate → 접힘 누적 재표시.

### 6.7 calendar UI (mockup: calendar-todo-mockup.html)
- `MonthGrid` props에 `todosByDate: Map<string, Todo[]>` 추가. 월간 셀: 미팅 pill(채널 4색) 다음에 **투두 pill** = 배경 `#334155` + 흰 글자 + type 아이콘 + `HH:MM 제목`.
- 일자 상세: 미팅 카드(채널색 좌측바 + "영업" 배지) **+ 투두 카드**(좌측바 `#334155` + "실무"+type아이콘 배지 + 부제=제목 + 우측=장소). 하단 버튼 2개("← 📋 일정·계약 탭" `/schedule?date=` · "💰 실무/수납 탭 →" `/payment`). **범례**(맨 아래): 영업 4색 + 실무 4아이콘. 투두는 **읽기 전용**(원천=실무/수납 탭).
- 토큰(tokens.md 선등재): 실무 진회색 **`#334155`**. type 아이콘 4종 = lucide `Phone`(전화)/`Users`(미팅)/`MessageCircle`(메시지)/`MoreHorizontal`(기타).

### 6.8 세션 분할 (각 독립 커밋 · 단일 PR `feat/practice-todo-calendar`)
| 세션 | 내용 | 레이어 | DoD |
|---|---|---|---|
| S2-a | Todo 타입 + `SHEET_RANGES.todos` + SSOT(data-model·sheet-structure) | types/config/docs | typecheck + doc-drift 그린 |
| S2-b | `todos.ts`(ensureTab + CRUD + date range) | repo | export·그린, 본보기 패턴 준수 |
| S2-c | service + `/api/todos` + month 확장 + query 훅 | service/api | 월간 API 응답에 todos 포함 |
| S2-d | payment ToDo 섹션 + 팝업 + components.md | ui | 슬롯에서 ToDo 추가 → 05 적재 → 접힘 누적 |
| S2-e | calendar 04+05 머지 + tokens.md | ui | 투두 진회색+아이콘 표시·범례·읽기전용 |

### 6.9 범위 밖 (Scope 2)
- 계약 공통 ToDo(기관 미지정) — `institutionRef` 빈 행 확장은 후속(저비용).
- 캘린더에서 투두 직접 편집(읽기 전용). Scope 3(02+05 조인 뷰, 플러그 버튼 제거)는 §7.

## 7. 다음 (Scope 3 착수 시 상세)
- **Scope 3**: `02` 슬롯 + `05` 투두 키 조인 뷰(업체별/기관별) + `02` 진행기관 → 레지스트리 연결 전환 + 요약카드 [플러그 바로가기] 제거.
