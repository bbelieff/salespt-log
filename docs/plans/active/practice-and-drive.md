---
slug: practice-drive-shortcut
status: active
pdca_stage: plan
created: 2026-06-01
worktree: ../wt/practice-drive-shortcut
related: 11-contract-payment-tab, 12-dashboard
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 계약 후 기관진행·수납·할일·Drive를 "실무/수납" 탭으로 통합 — Scope 1=Drive 바로가기+UI 정리, 2=05 실무투두+캘린더, 3=통합 뷰
> - **누가 읽나요**: 개발자(구현 가이드) + 사용자(요구 정합성)
> - **어떤 기능·작업과 연결?**: `app/(app)/payment`, 02 계약수납관리, 신규 `05 실무투두`, 04 캘린더, Drive(`lib/repo/drive-client.ts`), 레지스트리 `users` 탭
> - **읽고 나면 알 수 있는 것**: 3 Scope 분할, 저장 위치(02/04 불변·05 신설), 캘린더 표시 규칙, 명칭 변경 일람, 레포 실측(부록 G)
> - **관련 문서**: `docs/decisions/0006~0008-*.md`, `design-practice-and-drive.md`

# PDCA Plan — 실무진행 & 드라이브 연동 (v6)

> 위치: `docs/plans/active/practice-and-drive.md`
> 저장소: github.com/bbelieff/salespt-log (Next.js 15 + Google Sheets SSOT · Tailwind · lucide-react · 모바일 우선 ~390px · Noto Sans KR · 브랜드 레드 #d71617)
> **데이터 SSOT 템플릿(경영일지)**: docs.google.com/spreadsheets/d/1B-wpYVuoj5xZN1s6jn4FIJ424yWVgmjC-WtKUYBTYgs — 기존 5탭(대시보드/01 영업관리/02 계약수납관리/03 DB관리/04 업체관리) **+ 신규 `05 실무투두`**. **구조 추가(컬럼·테이블·탭)는 이 템플릿에서 하고 전 수강생에 전파.**
> 상태: **기획 확정** — Q1~Q6 + 디자인 세션(UI) 확정 · 3 Scope
> **v6 변경점**: ToDo 저장을 **신규 `05 실무투두` 탭**으로 변경(04 미팅 집계 수식과의 충돌 회피). 04는 **미팅 전용** 유지. 부록 F(05 스키마)·부록 G(레포 실측) 추가. 채널 정규화 기준값 **`콜·지·기·소`** 확정.
> **v6.1 (형 세션 코드 대조 정정)**: 02 웹 쓰기 영역 `F~AA`→**`F~AH`**(부록 B). 5탭 구성에 대시보드 없음(캘린더가 5번째)·대시보드는 헤더 버튼임을 부록 G에 명시.
> **시각 정본**: `practice-payment-mockup.html`, `calendar-todo-mockup.html`
> 관련: `design-practice-and-drive.md`, `0006`(=구 adr-001), `0007`, `0008`

---

## 0. 결정 로그 (Q1~Q6)
| # | 질문 | 결정 |
|---|---|---|
| Q1 | 실무진행 화면 위치 | **"실무/수납" 탭**(기존 수납 탭 확장, 라벨만 변경·아이콘 유지) |
| Q2 | 계약–기관 관계 | **1:N 병렬**. 02의 **수납1/2/3 슬롯이 이미 1:N(기관 최대 3)** 구현 |
| Q3 | 기관 목록 관리 | **빈 레지스트리 → 입력으로 성장**. 소스 = 02 `(N) 진행기관` 칸 |
| Q4 | 캘린더 | **기존 달력 활용** — **04(미팅) + 05(투두)** 읽어 표시, 읽기 전용 |
| Q5 | Drive | **기존 폴더 연결**(생성 아님) → `01 피드백업체` 바로가기 |
| Q6 | 데이터 저장 | **02 불변 · 04 미팅 전용**. ToDo는 **신규 `05 실무투두` 탭**에 행 적재. 기관진행은 **02 슬롯 재사용** |

---

## 1. Context Anchor
- **WHY**: 계약 후 → 기관(소진공·중진공·신보·기보 등) 진행 → 수납까지를 한 화면에서 추적·할 일 관리할 곳이 없음(현재 수동/외부 Pluuug).
- **WHO**: Admin/트레이너(관리), 수강생(Drive 업로드).
- **RISK**: 02는 합계 수식·bulk-write 가드가 걸린 가장 예민한 시트 → 불변. **04는 `1행=1미팅`(미팅 원본)** 이고 01 영업관리·대시보드 집계가 04를 전부 미팅으로 가정 → 투두를 섞으면 퍼널이 틀어짐 → **05 분리**로 회피. Sheets quota(60req/min). Drive 권한·이름 규약.
- **SUCCESS**: ① 1클릭 Drive(Scope 1) ② 슬롯 ToDo + 달력 표시(Scope 2) ③ 기관 진행(02) + 투두(05) 통합 뷰(Scope 3).
- **SCOPE IN**: Drive 바로가기(+플러그 임시) / 슬롯 ToDo(05) + 캘린더(읽기) / 기관진행·통합 뷰 / 탭 배너 시트참조 제거.
- **SCOPE OUT**: Drive 폴더 자동 생성, 달력 직접 수정, 02 슬롯 3칸 초과 확장.

---

## 2. 관통 원칙
1. **`02 계약수납관리` 불변.** 합계 수식(승인총액·수납총액)이 수납1/2/3 슬롯을 집계 → 컬럼/슬롯 구조 미변경. (슬롯 **값**은 기존 웹 쓰기 영역 `F~AH`로 갱신 가능.)
2. **`04 업체관리`는 미팅 전용(`1행=1미팅`).** 투두 안 넣음. **ToDo 전용 탭 `05 실무투두` 신설**(템플릿에 추가→전파) → 미팅 수식/코드와 완전 격리.
3. **진행기관 = 레지스트리 연결형.** 02 `(N) 진행기관` 칸을 레지스트리와 연결 → 통합 뷰 필터 키.
4. **깔끔한 키.** 모든 ToDo 행에 `contract_ref` + `institution_ref` → Scope 3는 **02 슬롯 + 05 투두 키 조인**만으로 완성.
5. **시각 구분 원칙(캘린더):** 영업미팅 = **채널 4색**(파스텔), 실무 = **진회색 단색 + 카테고리 아이콘**. 실무 색이 채널 4색 어디와도 안 겹치게 고정.
6. **Pluuug 모티브** + **다중 세션**(Scope별 worktree + PR).

---

## 3. 데이터 모델

### 3.0 현행 02 구조 (부록 B)
- 한 계약 = 한 줄: 순번/계약일/업체명/수임비 + 체크박스7 + **수납1·2·3 슬롯**.
- 각 슬롯 = `진행기관 · 진행률 · 현황 · 승인금액 · 수납액 · 수납일` → 곧 계약별 기관(1:N, 최대3) 진행 데이터. 합계가 슬롯 집계 → 구조/수식 **불변**.

### 3.1 Drive 링크 (Scope 1)
- 마스터 레지스트리(`SHEETS_REGISTRY_ID`의 `users` 탭, `lib/repo/users.ts`) 수강생 행에: `drive_parent_path`(온보딩 입력) · `feedback_folder_id`(자동 탐색) · (선택) `drive_link_status`·`drive_linked_at`.

### 3.2 ToDo (Scope 2) — 신규 `05 실무투두` 탭 · **슬롯 단위**
- **저장 위치**: 신규 탭 `05 실무투두`(템플릿에 추가→전파). 04(미팅)·02(불변)와 완전 격리 → 미팅 수식/코드 영향 0.
- **UI 위치**: 각 진행 슬롯 **안**(메모와 진행률 사이). ToDo는 **(계약 × 기관)** 단위라 `institution_ref`(=슬롯 진행기관)가 항상 존재 → Scope 3 기관별 보기가 거저 풀림.
- **05 스키마**(부록 F): `id · contract_ref · institution_ref · 업체명 · type(기타/미팅/전화/메시지) · 제목 · 예정일자 · 예정시각(시08~20/분00·30) · 장소 · 상세 · show_on_calendar · 완료여부 · 생성시각`. **담당자 없음.**
- (열림) 계약 공통 ToDo(기관 미지정)는 현재 **미포함**. 필요 시 `institution_ref` 빈 행으로 확장(저비용).

### 3.3 기관 레지스트리 (Q3)
- 빈 상태 시작, 입력 시 적재. 소스 = 02 `(N) 진행기관` + 05 `institution_ref`. 저장(중앙 vs distinct)은 Design 확정.

### 3.4 기관진행 (Scope 3) — 새 저장 없음
- 02 슬롯(기관·현황·금액) + 05 투두를 `contract_ref`/`institution_ref`로 조인 → 업체별/기관별 뷰.

---

## 4. 탭 / UX 구조

### 4.1 "실무/수납" 탭 (per 수강생)
- **요약카드**: 누적 수납/승인 **중앙** + **[Drive 바로가기]** + **[플러그 바로가기]**(둘 다 새 탭; 플러그는 임시).
- **계약 카드 본문 순서**: 업체정보 → 📋 **계약 후 프로세스**(체크박스7) → 📍 로드맵 메모(시트 AE) → 📈 **실무 진행**(슬롯들).
- **슬롯(진행 N) 내부 순서**: 진행도 → 진행기관 → 메모 → **ToDo 섹션(신규, 데이터=05)** → 진행률 → **현황** → 승인금액/수납일/수납액.
- ToDo [추가] → Pluuug식 팝업. 저장 시 제목 **접힘** 누적(05에 기록) + 캘린더 연동.

### 4.2 대시보드
- **상단 헤더 "대시보드 ›" 버튼**(하단 탭 아님). 주간 남은 ToDo 카운트는 대시보드 화면이 **05를 집계**해 표시. 구분 키 = `institution_ref`.

### 4b. 명칭 변경 일람 (코드 적용용)
| 위치 | 변경 전 | 변경 후 | 비고 |
|---|---|---|---|
| 하단 탭 라벨 | 수납 | **실무/수납** | 아이콘(코인+$) **유지** · ADR-0008 |
| 페이지 배너 제목 | 계약수납 | **실무/수납** | 배너 시트참조(02…)는 제거(부록 D) |
| 슬롯 섹션 헤더 | 💰 수납 현황 | 📈 **실무 진행** | |
| 슬롯 칩/추가 | 수납 1/2/3 · 수납 추가 | **진행 1/2/3 · 진행 추가** | |
| 체크박스 섹션 | 📋 실무 진행 | 📋 **계약 후 프로세스** | 위 섹션과 이름충돌 해소 |
| 슬롯 필드 라벨 | 진행내용 | **현황** | 데이터 키는 이미 `현황`(라벨만) |

---

## 5. 캘린더 통합 (Q4) — 표시 규칙 확정
- 신규 달력 없음. 기존 캘린더(`app/(app)/calendar/`, `MonthGrid.tsx`)가 **04(미팅) + 05(실무투두)** 둘 다 읽어 합쳐 표시. **읽기 전용**.
- **월간 셀**: 미팅 핀 = **채널 4색** / 실무 핀 = **진회색 #334155 + 카테고리 아이콘**.
- **채널 4색**(시스템 `MonthGrid.tsx`·`components/dashboard/FunnelChart.tsx` 확인): 매입DB `#1d4ed8`(bg #dbeafe) · 직접생산 `#15803d`(#dcfce7) · 현수막 `#b45309`(#fef3c7) · 콜·지·기·소 `#7c3aed`(#f3e8ff). → 실무 진회색은 이 4색과 비충돌. *(주의: 4번째 채널 정규화 기준값 = `콜·지·기·소`. 시트엔 `콜-지-기-소`/`콜드콜, 지인, 기고객, 소개`/`지인,기고객,소개`로 섞여 있으니 앱이 `콜·지·기·소`로 정규화 후 매핑. CLAUDE.md도 채널 4색 고정값으로 `콜·지·기·소` 명시.)*
- **실무 4종 아이콘**: 미팅(사람들) · 전화 · 메시지 · 기타(점3). (05의 `type`)
- **일자 상세(요약카드, 공통 레이아웃 = 좌측 색바 · 시간 · 배지 · 내용 · 우측)**:
  - **영업(미팅, 04)**: 채널색 좌측바 + 채널색 **"영업" 배지** + 업체명 + 채널명(부제) + 지역(우측, =04 `장소`).
  - **실무(투두, 05)**: 진회색 좌측바 + 진회색 **"실무"+카테고리아이콘 배지** + 업체명 + 투두제목(부제) + 장소(우측, =05 `장소`).
  - **하단 버튼 2개(동일 톤)**: **"← 📋 일정·계약 탭으로 이동"** = 해당 일자(`/schedule?date=YYYY-MM-DD`) · **"💰 실무/수납 탭으로 이동 →"** = `/payment`.
- **범례**: 화면 **맨 아래**. 영업=채널 4색 / 실무=아이콘 4종. 동그라미 크기 동일.
- 이벤트(투두) 클릭 = 읽기 전용 → 원천(실무/수납) 탭.

---

## 6. Drive 연동 (Q5) + 플러그 바로가기
- 온보딩(경영일지 URL 입력, `app/api/setup/route.ts`)에 **Drive 부모 폴더 경로** 입력 → registry 저장 → `01 피드백업체` 탐색(**폴더용 신규 함수** 필요 — 기존 `findSheetByNamePrefix`는 spreadsheet 전용이라 폴더엔 못 씀, ADR-0007) → `feedback_folder_id`.
- 요약카드 **[Drive 바로가기]** → `01 피드백업체`, **[플러그 바로가기]** → https://www.pluuug.com/ . **둘 다 새 탭**(`target=_blank` + `rel=noopener`).
- **플러그 버튼은 Scope 3(앱 내 기관진행) 전까지 임시** — Scope 3 완성 시 제거. (`docs/future/extensions.md`에 "Scope 3에서 제거" 명시.)
- 권한: SA가 부모 폴더 최소 viewer(온보딩 시 admin 공유). 예외 시 [다시 연결]. 범위 밖: 폴더 생성, 업체별 deep link.

---

## 7. 마이그레이션 / 백업
1. 시트 스냅샷 + `git tag v-pre-practice-scope`.
2. **02·04 불변**(04는 미팅 전용 그대로).
3. **`05 실무투두` 탭 신설**(템플릿 → 전 수강생 전파) + `SHEET_RANGES`/`sheet-structure.md` 등재 → ADR-0006 + 스크립트.
4. 레지스트리 `users` 탭에 drive 칸 추가(저위험).
5. 탭 배너 시트참조 제거(부록 D)는 코드 변경만(시트 무관).

---

## 8. Scope 분할 (3개)

### ✅ Scope 1 — Drive 바로가기 + UI 정리 (**완료 — PR #255, `ae7dd50`**)
- 온보딩 Drive 경로 입력 → registry → `01 피드백업체` 탐색·저장(폴더용 신규 drive 함수).
- 요약카드: 누적 중앙 + [Drive 바로가기] + [플러그 바로가기](임시), 둘 다 새 탭.
- **명칭 변경 일람(§4b) 적용** + 탭바 라벨(부록 A) + **탭 배너 시트참조 제거(부록 D)**.
- [다시 연결]/권한 안내.
- **DoD**: 등록 수강생 1클릭으로 `01 피드백업체` 이동, 명칭/배너 정리 반영, `npm run check` 통과.
- **구현 요약 (2026-06-01 머지)**: registry N/O/P(driveParentPath/feedbackFolderId/driveLinkStatus) + `findFolderByNamePrefix`(folder mimeType, parent scope) + `POST /api/drive-link` + `DriveLinkBar` 컴포넌트 + 탭/배너/슬롯 명칭 변경 + 5탭 pageSubtitle 제거. 핸드오프 → `docs/plans/completed/_handoff-scope1.md`.

### Scope 2 — 05 실무투두 + 캘린더
- **`05 실무투두` 탭 신설** + ToDo 행(키 자동). 슬롯 내 ToDo 섹션 + Pluuug 팝업 + 신규 `lib/repo/todos.ts`.
- 저장 → 접힘 누적 + 캘린더 표시(§5 규칙: 04 미팅 + 05 투두 합쳐 그림, 실무 진회색+아이콘).

### Scope 3 — 기관진행 / 통합 뷰
- 02 슬롯 + 05 투두 키 조인 → 업체별·기관별 뷰. 진행기관 → 레지스트리 연결. 대시보드 기관 카운트.
- **완료 시 요약카드의 [플러그 바로가기] 제거.**

---

## 9. ADR 목록
- **ADR-0006 실무 데이터 모델**: ToDo는 **신규 `05 실무투두` 탭**(04 미팅 집계 수식 충돌 회피) + 키(`contract_ref`/`institution_ref`). 기관진행은 02 슬롯 재사용(02 구조/수식 불변, 04 미팅 전용 유지).
- **ADR-0007 Drive 연결·권한**: 연결(비생성), SA viewer, 폴더 prefix 매칭(신규 함수), 재연결.
- **ADR-0008 탭 라벨 변경**: `수납`→`실무/수납`(라벨만, 아이콘 유지). TabBar.tsx 5탭 고정 규칙 + 프로토타입 동기화.

---

## 10. 미해결 (다음 단계 확정)
- [x] ToDo 저장 위치 = **신규 `05 실무투두` 탭**(04 충돌 회피) → 해결.
- [x] ToDo **"장소"** = **05 `장소` 칸**(신규 탭이라 자체 보유) → 해결.
- [x] `contract_ref` 키 형태 = **`${계약일}|${업체명}` 합성키**(시트 행번호 아님 — 행 이동에 강건). `institution_ref` = 슬롯 진행기관 텍스트. → 해결(design §6.1, Scope 2).
- [ ] 계약 공통 ToDo(기관 미지정) 필요 여부 — 현재 슬롯 단위만. (Scope 2 범위 밖)
- [ ] 레지스트리 저장: 중앙 vs distinct (§3.3) — Scope 3.
- [ ] 02 슬롯 3칸 초과 정책 / 조인 뷰 캐시·동시성 — Scope 3.

---

## 부록 A. 탭바 변경 명세
| 항목 | 변경 | 비고 |
|---|---|---|
| 라벨 | `수납` → `실무/수납` | 표시 텍스트만 |
| 아이콘 | **현재 수납 아이콘(코인+$) 유지** | 변경 안 함 |
| 탭 개수/순서·라우트·key | **변경 금지** | 딥링크/상태 보호 |
| 절차 | ADR-0008 + 프로토타입 동기화 | TabBar.tsx 규칙 |

## 부록 B. 현행 02 계약수납관리 구조 (템플릿 실측)
- 상단 합계: 승인총액 / 수납총액 (슬롯 집계 → **불변**)
- 한 줄(계약) 기본: 순번 · 계약일 · 업체명 · 수임비
- 체크박스 7개 = 시트상 **3개 그룹**:
  - **계약당일 받아올 것**: 공동인증서 · 임대차계약서 · 신분증
  - **계약 직후 프로세스**: 드라이브 업로드 · 사업계획서 초안발송 · 컨설팅 5종서류 발송
  - **실무진행**: 플러그 이관 *(시트 라벨 '실무진행' = 플러그 이관 1칸 — UI 라벨과 층이 다름, §4b)*
- 수납1 / 수납2 / 수납3 (각): `(N) 진행기관 · (N) 진행률 · (N) 현황 · (N) 승인금액 · (N) 수납액 · (N) 수납일` (수납1만 '수수료 수납액')
- **웹 쓰기 허용 영역 = `F~AH`** (형 세션 코드 대조 정정, 옛 표기 `F~AA` 아님). 실측: 체크박스 F~L 부근 + 슬롯 값 분산(M~R / Y~AD 등) + **로드맵 메모 AE** + **슬롯별 메모 AF/AG/AH**. 합계/구조는 불변. 정본 = `lib/repo/contract-payment.ts`.

## 부록 C. 디자인 토큰 (시각 정본)
- 브랜드 레드 `#d71617` · 활성 블루 `blue-600` · 모바일 390px · Noto Sans KR
- 02 슬롯 색: 수납1 teal · 수납2 cyan · 수납3 fuchsia
- 캘린더 채널 4색(§5 고정, 변경 금지) / **실무 진회색 `#334155`(신규 토큰 → `docs/design/tokens.md`에 먼저 등재 필요)**
- 아이콘 라이브러리 = lucide-react (탭바는 인라인 SVG 정본)

## 부록 D. 탭 배너 시트참조 제거 (신규 스콥)
- 현재 각 탭 배너에 시트 참조가 `pageSubtitle`로 노출됨:
  | 탭 | pageSubtitle |
  |---|---|
  | 컨택관리 | 01 영업관리 |
  | 일정·계약 | 04 업체관리 |
  | 캘린더 | 04 업체관리 |
  | 실무/수납(수납) | 02 계약수납관리 |
  | DB관리 | 03 DB관리 |
- **조치**: 공용 헤더에서 `pageSubtitle` 제거(또는 미렌더). 5곳 소규모 일괄 변경.

## 부록 E. 04 업체관리(앱자동작성용) 구조 (템플릿 실측) — 미팅 전용 유지
- **04 컬럼(A~S, 19칸)**: id · 예약일 · 예약시각 · 미팅날짜 · 미팅시간 · 채널 · 업체명 · 장소 · 예약비고 · 상태 · 계약여부 · 수임비 · 미팅사유 · 표시_상세 · 표시_요약 · 계약조건 · 계약합성라인 · previousMeetingId · 주차
- **`1행=1미팅`(미팅 원본) — 투두 안 넣음.** 01 영업관리·대시보드 집계 수식이 04를 전부 미팅으로 가정(COUNTIFS/SUMIFS/TEXTJOIN, **채널 키**)하므로, 투두를 섞으면 퍼널이 틀어짐 → 05 분리.
- 캘린더 미팅 표시: `채널`(→색) · `업체명` · `장소`(→지역) · `상태` · `미팅날짜/시간`.
- 앱 read/write: `lib/repo/meetings.ts`(범위 `A2:S`).

## 부록 F. 05 실무투두 탭 스키마 (신규 — 템플릿에 추가→전파)
- 탭 이름 `05 실무투두` (앱 자동기록 — 04처럼 '(앱자동작성용)' 접미사 통일은 구현 시 결정). **1행 = 1투두**, append/update.

| 컬럼 | 의미 | 비고 |
|---|---|---|
| id | 행 고유키 | 앱 생성 |
| contract_ref | 계약 키 | 02 순번 또는 고유키(§10) |
| institution_ref | 기관(=슬롯 진행기관) | Scope 3 조인 키 |
| 업체명 | 업체 | 표시·조인 |
| type | 기타/미팅/전화/메시지 | 캘린더 아이콘 |
| 제목 | 투두 제목 | 슬롯에 접힘 누적 |
| 예정일자 | 날짜 | 캘린더 표시일 |
| 예정시각 | 시(08~20)/분(00·30) | |
| 장소 | 장소 | 캘린더 실무카드 우측 |
| 상세 | 메모 | 팝업 |
| show_on_calendar | 캘린더 표시 ON/OFF | 기본 ON |
| 완료여부 | done | |
| 생성시각 | created_at | |

- 캘린더는 **04(미팅) + 05(투두)** 둘 다 읽어 합쳐 표시(§5). 투두엔 채널 없음 → 진회색.
- 코드 작업: `SHEET_RANGES`에 05 키 + `docs/domains/sheet-structure.md` 등재 + 신규 `lib/repo/todos.ts`(append/update/read) + `lib/types`(Zod)·`docs/domains/data-model.md` 등재.

## 부록 G. 레포 실측 (핸드오프용 — 새 세션이 0에서 참조)
- **기준 버전**: github.com/bbelieff/salespt-log · 기본 브랜치 `master` · 최신 커밋 `2314ac6`(PR #250). 패키지매니저 **npm**(package-lock.json).
- **하단 5탭 실측**(`components/TabBar.tsx`): `컨택관리(/contact) · 일정·계약(/schedule) · 캘린더(/calendar) · 수납(/payment) · DB관리(/db)`. **대시보드는 하단 탭이 아님 — 헤더 "대시보드 ›" 버튼.** 이번 스콥은 탭 추가 없이 `/payment` 라벨만 `실무/수납`으로 변경(ADR-0008) → **5탭 구조 불변**.
- **개발 하네스(`CLAUDE.md`) 필수 규약**:
  - 워크트리 필수(로컬 main 직접수정 금지). 브랜치 `feat/<slug>`(kebab, 2~5단어). pre-commit 훅이 main 직접커밋·plan 없는 lib/app 변경 차단.
  - 커밋/PR 전 게이트 **`npm run check`**(= typecheck · lint · test:structural · test · 파일≤500줄 · doc-drift). 하나라도 실패 시 PR 금지. CI도 동일 실행.
  - **SSOT 4문서**에 먼저 등재 후 코드: 컴포넌트→`docs/design/components.md` · 타입(Zod)→`docs/domains/data-model.md` · 시트좌표(`SHEET_RANGES`)→`docs/domains/sheet-structure.md` · 색/간격/타이포→`docs/design/tokens.md`. Tailwind arbitrary value 금지(토큰 먼저). 디자인 변경 시 `docs/design/preview.html` 동기화.
  - 모든 `.md`는 상단 "문서 요약 카드" 필수(없으면 PR 반려). ADR=`docs/decisions/NNNN-*.md` **불변**(기존 0001/0002/0003/0005, 0004 결번 → 우리 ADR은 0006~0008).
  - MVP 절대원칙: 현재 수강생 1인칭만, YAGNI, 확장은 `docs/future/extensions.md`로 분리.
- **이미 존재(재사용)**:
  - Drive: `lib/repo/drive-client.ts` — `driveClient()` · `findSheetByExactName` · `findSheetByNamePrefix`. **단 둘 다 `mimeType=spreadsheet` 전용** → Scope 1 폴더 탐색엔 **폴더용 신규 함수**(`mimeType=folder`) 추가 필요.
  - 레지스트리: 마스터 시트 `SHEETS_REGISTRY_ID`의 `users` 탭(`lib/repo/users.ts`) — 여기에 `drive_parent_path`·`feedback_folder_id` 칸 추가(현재 없음).
  - 셋업/온보딩: `app/api/setup/route.ts`(+ `app/api/claim/route.ts`·`app/claim/page.tsx`).
  - 미팅 repo: `lib/repo/meetings.ts`(04를 `A2:S`로 read/write). 02 슬롯 웹 쓰기 영역 `F~AH`(구조/합계수식 불변).
  - 캘린더: `app/(app)/calendar/` + `MonthGrid.tsx` + `app/api/meetings/month` — 이미 04 미팅을 월간 표시 중. Scope 2는 여기에 05 머지.
- **SA 이메일**: `masterbot@saleslog-494703.iam.gserviceaccount.com` (Drive 부모 폴더 viewer 공유 대상).
- **env(`.env.example`)**: `AUTH_SECRET`·`AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET` · `GOOGLE_SERVICE_ACCOUNT_EMAIL`·`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` · `SHEETS_REGISTRY_ID`(+`SHEETS_REGISTRY_TAB=users`) · `STUB_USER_EMAIL`(로컬 stub) · (선택)GA·Sentry.
