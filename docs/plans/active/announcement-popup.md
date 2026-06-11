---
slug: announcement-popup
status: active
created: 2026-06-11
owner: belie
related: sheet-structure, components, tokens, arena-season1-setup
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 앱 접속 시 모두에게 보여주는 "새소식 팝업"(공지 + 최근 업데이트) — 배포 시 자동 수집, admin 팝업관리(MD 에디터·이미지 업로드·노출 옵션) 설계.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: 레지스트리 시트(새 탭 2개), deploy.yml(수집 스텝), 수강생 레이아웃(팝업), admin 마스터메뉴(팝업관리), drive-client(이미지 업로드)
> - **읽고 나면 알 수 있는 것**: 업데이트가 어떻게 자동으로 쌓이나, 공지는 어디 저장되고 누가 어떻게 쓰나, 노출 옵션(대상/빈도/기간)이 어떻게 작동하나
> - **관련 문서**: docs/domains/sheet-structure.md, docs/design/components.md, docs/playbooks/deploy-vps.md

# 새소식 팝업 — 공지 + 업데이트 (확정 설계)

## 0. 개요 (2026-06-11 사용자 확정)
- 접속 시 팝업 1개: **상단 공지 섹션**(운영자 작성, 이미지 가능) + **"새로워졌어요" 업데이트 목록**(최근 노출 10개, 제목 클릭 → 아코디언 펼침, 스크롤).
- 수집 = **배포 시 자동 기록**(매일 폴링 아님). 번호 = **PR번호 기본 + 마일스톤 라벨**(시맨틱 버전 안 씀).
- 공지 이미지 = **Drive 업로드까지 포함**(belie OAuth). HTML 직접 입력은 XSS 위험으로 제외 — **MD + sanitize**.
- 문구는 토스 UX 라이팅 원칙: 쉬운 말, 사용자 혜택 중심("~할 수 있어요"), 짧은 능동형 문장.

## 1. 저장 설계 — 레지스트리 시트에 새 탭 2개
SSOT=Sheets 원칙 유지. `SHEETS_REGISTRY_ID` 시트에 추가(ensureTodoTab 패턴으로 자동 생성).
§2.5 bulk-write 보존 가드 동일 적용(쓰기는 대부분 append).

### 1-1. `updates` 탭 (자동 수집 + admin 보정)
| 컬럼 | 내용 |
|---|---|
| pr | PR 번호 (키, 중복 금지=멱등 가드) |
| date | 머지(배포) 날짜 |
| type | feat / fix / perf / chore / docs (브랜치 접두어에서 추출) |
| title_user | 사용자용 한 줄 (Changelog 줄, 토스 문체) |
| body_md | 상세 (선택) |
| milestone | 큰 묶음 라벨 (admin 수동, 예: "업체정보 기능 출시") |
| visible | TRUE/FALSE — 기본: feat·fix=TRUE, docs·chore·refactor=FALSE |

### 1-2. `notices` 탭 (운영자 공지)
| 컬럼 | 내용 |
|---|---|
| id | 공지 id (타임스탬프 기반) |
| created / updated | 작성·수정 시각 |
| title / body_md | 제목·본문(MD, 이미지는 MD 이미지 문법 + Drive URL) |
| audience | all / arena / regular — arena 판정 = cohort 라벨 `A` 접두(예 A1-6기) |
| display_mode | once(확인 후 안 봄) / daily(하루 1회) / always(매 접속) |
| start / end | 노출 기간 (빈값 = 무제한) |
| pinned / active | 상단 고정 / 활성 토글 |

→ `SHEET_RANGES.updates` / `SHEET_RANGES.notices` 추가 + sheet-structure.md 등재(코드보다 먼저).

## 2. 수집 자동화 (확정: 배포 시 자동 기록)
- `deploy.yml` health check 성공 후 VPS에서 `node scripts/append-updates.mjs` 실행(VPS env의 SA 자격 재사용 — 새 시크릿 불필요).
- 스크립트: master 최근 커밋(squash subject `... (#N)`)에서 PR번호 추출 → updates 탭의 기존 pr 목록과 대조 → **없는 것만 append**(멱등). 커밋 본문의 `Changelog:` 줄이 있으면 title_user로, 없으면 subject에서 type 접두어 제거한 제목 fallback.
- **PR 규약 추가(CLAUDE.md)**: feat/fix PR은 본문(=squash 커밋 메시지에 포함되도록)에 `Changelog: <수강생이 읽는 쉬운 한 줄>` 의무. 구현 시 이 레포의 실제 squash 커밋 메시지 형태를 확인해 추출 로직을 맞춘다.
- **초기 backfill**: PC에서 1회 `gh pr list --state merged` 기반 스크립트로 최근 사용자-가시 PR 10개 등재(문구는 admin이 팝업관리에서 다듬기).
- 실패해도 배포 자체는 성공 처리(append 스텝은 non-blocking, 로그만 남김 — 다음 배포에서 멱등 재시도).

## 3. 수강생 팝업 UI
- 로그인 후 레이아웃 mount 시 `GET /api/announcements` (10분 캐시 패턴 재사용) → 활성 공지(대상·기간 필터) + visible 업데이트 최신 10개.
- 자동 팝업 조건: ① 안 본 새 업데이트 존재(localStorage `lastSeenPr` < 최신 pr) 또는 ② display_mode 조건을 충족하는 활성 공지. 둘 다 아니면 안 띄움.
- 빈도 제어는 **클라이언트 localStorage**(once: `noticeSeen:{id}`, daily: `noticeSeen:{id}:{YYYY-MM-DD}`). 사용자별 서버 기록은 시트 쓰기 과다 → 금지.
- 팝업 구조: 공지(pinned 우선, 이미지 렌더) → 구분선 → "새로워졌어요 ✨" 업데이트 리스트(아코디언: 닫힘=date+title_user, 펼침=body_md). 하단 "확인" 버튼.
- 수동 재열람: 헤더에 "새소식" 진입점 + 새 항목 있을 때 점 뱃지.
- 기존 모달 패턴(z-[300]) 재사용, 신규 색 토큰 불필요(필요 시 tokens.md 먼저).

## 4. admin 팝업관리 (마스터메뉴)
- **상단: 공지 작성/수정** — MD 에디터(미리보기, 이미지 업로드 버튼), 노출 옵션 폼(audience/display_mode/start/end/pinned/active). 기존 공지 목록에서 선택 → 수정.
- **하단: 업데이트 현황** — 자동 수집된 updates 테이블. title_user 인라인 수정, visible 토글, milestone 라벨 입력.
- **이미지 업로드**: 에디터에서 파일 선택 → API → drive-client(belie OAuth, ADR-0015)로 **공지 이미지 폴더 `1vujHrGt5gf6iIERz8-LpmLt2mLoXt5xG`**(사용자 지정, 2026-06-11)에 저장 → anyoneWithLink reader 권한 설정 → URL 반환 → MD 이미지 문법 자동 삽입. 폴더 ID는 **비밀 아님** → `NOTICE_IMAGE_FOLDER_ID` env, 없으면 config 기본값(위 ID) 사용 — #324 마스터 템플릿 기본값과 같은 패턴. **VPS env 추가 작업 불필요.** (.env.local 에는 2026-06-11 등록 완료)
- API: `GET /api/announcements`(수강생) / admin: notices CRUD, updates PATCH, notice-image POST. 전부 Service 경유(레이어 규칙).

## 5. 구현 분할 (PR 단위)
1. **feat/announcement-backend** — 탭 2개+SHEET_RANGES+types+service+API(read)+append 스크립트+deploy 스텝+backfill+CLAUDE.md Changelog 규약.
2. **feat/notice-popup-ui** — 수강생 팝업(아코디언·localStorage 노출 제어·헤더 진입점).
3. **feat/admin-popup-mgmt** — 팝업관리 페이지(에디터+이미지 업로드+현황 테이블). 500줄 초과 시 ③a(공지 에디터)/③b(업데이트 현황) 분할.

## 6. 결정 로그
- 2026-06-11 확정: 수집=배포 시 자동(폴링·수동 아님), 번호=PR번호+마일스톤 라벨(semver 기각=운영 부담·YAGNI), 이미지=Drive 업로드 포함, HTML 입력 제외(MD+sanitize), 빈도 제어=localStorage.
- 2026-06-11 사용자 지정: 공지 이미지 폴더 = `1vujHrGt5gf6iIERz8-LpmLt2mLoXt5xG` (belie My Drive).
- 2026-06-11: 폴더 ID 는 비밀 아님 → config 기본값 + env override(#324 패턴). VPS env 수작업 제거.

## 7. 운영 지침 (2026-06-11 — grouped-updates)

### 7-1. 묶음(그룹) 기준
- 한 기능이 여러 PR 로 나뉘면 **수강생에게는 1개 항목**으로 보여야 한다.
- 그룹 키 = updates 탭 `milestone` 컬럼. squash 커밋의 `Changelog-Group: <키>` 를
  배포 수집기가 적재. 같은 milestone 행들이 팝업·보관함에서 1항목으로 묶인다.
- 그룹 대표 = 그룹 내 **최신 pr 행** — title_user(고객용 한 문장)·body_md(전/후)를
  대표 행에 적는다(팝업관리에서 보정).

### 7-2. 문구 기준 (토스 UX 라이팅)
- 제목: 기능명·기술용어 금지. 고객이 얻는 것 1문장, "~해요" 능동형.
- 상세 body_md 포맷(UI 가 [전]/[후] 뱃지로 렌더):
  `전: <곤란했던 실제 상황 1~2문장>` ⏎ `후: <달라진 경험 + 구체 행동 1~2문장>`
- 이미지: 공지 이미지 폴더(NOTICE_IMAGE_FOLDER_ID) 재사용, MD 이미지 문법.
  모바일 기준 전/후 2장 나란히 권장.

### 7-3. 공개 타이밍 가드 (반쪽 기능 노출 방지)
- `Changelog-Group` 이 있는 PR 은 수집 시 **visible=FALSE** 로 적재.
- 그룹 마지막 PR 커밋에 `Changelog-Done` 한 줄 → 수집기가 그 그룹(milestone=키)
  전체 행을 visible=TRUE 로 전환(멱등 — 자기 그룹 행의 G열만 타격).
- 단건 feat/fix 는 기존대로 즉시 TRUE.

### 7-4. 표시 규칙 (팝업·보관함 공통)
- 접힘: 제목 + 메타줄 — 그룹 "개발 M/D~M/D · 적용 M/D"(그룹 첫~마지막 머지일,
  updates date 의 min~max 로 계산 — 신규 컬럼 불필요), 단건 "적용 M/D".
- 펼침: 첫 줄 "339·340·…번째 업데이트"(그룹 pr 나열, 단건 "345번째 업데이트")
  → [전]/[후] 뱃지 + 문단(공지와 동일 MD 렌더러 — 이미지·sanitize).
- 팝업 = 최근 10개 항목(그룹=1항목) + "지난 업데이트 모두 보기" → 보관함(/updates):
  전체 최신순, 월별 구분선, 더보기 페이징. 헤더 "새소식" 진입점도 보관함으로.
- 소급 큐레이션은 2026-06-11 등재분까지만 — 과거 PR(#1~#338) backfill 금지.

## 8. 완료 기록
- 2026-06-11 전체 완료: PR① #350(backend — 탭·API·자동수집·backfill·Changelog 규약) / PR② #351(수강생 팝업 — 자동/once/daily/수동·점뱃지) / PR③ #352(admin 팝업관리 — 공지 에디터·이미지 업로드(lh3)·업데이트 현황). 배포별 자동 수집 라이브 검증(#350~#352 각 1건 append).
- 2026-06-11 재활성: grouped-updates(묶음·고객 문구·게시판) 작업의 SoR 로 active 복귀 — §7 운영 지침 추가. 완료 시 다시 completed 로.
