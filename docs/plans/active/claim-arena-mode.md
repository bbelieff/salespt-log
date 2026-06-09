---
slug: claim-arena-mode
status: active
created: 2026-06-09
owner: belie
related: arena-create, cohort-template-master
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 자가 클레임 폼에 아레나 모드(시즌·자기기수·이름 3칸)를 추가하고, create-arena-members 의 레지스트리 라벨을 동일 포맷 `A{시즌}-{기수}기` 로 맞춰 본인 아레나 시트 자동 연결.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/claim/page.tsx`, `lib/service/cohort-token.ts`(아레나 빌더), `app/api/admin/create-arena-members`, `components/auth/ArenaCreateModal.tsx`
> - **읽고 나면 알 수 있는 것**: 아레나 식별자 3요소, 라벨 정규화 매칭, prep 전제
> - **관련 문서**: `docs/plans/completed/arena-create.md`, `docs/decisions/0012-arena-folder-create.md`

# 자가 클레임 — 아레나 모드 (시즌·자기기수·이름)

## 아레나 식별자 3요소
- **시즌** `A{n}` · **자기기수** `{m}기` · **이름**.
- **레지스트리 cohort 라벨(매칭 키)** = `A{시즌}-{기수}기` (예: 시즌1·1기 → `A1-1기`). 하이픈.
- **시트명** = `세일즈PT_A{시즌}_{기수}기 {이름}_대표님 경영일지` (예: `세일즈PT_A1_1기 김믿음_대표님 경영일지`).
- **시즌 레벨 config 키**(cohorts 탭 템플릿/폴더) = `A{시즌}` (`arenaSeasonLabel`). 참가자별 라벨과 분리.

## 변경
1. **`cohort-token.ts`** — `arenaCohortLabel(season,gisu)=A{n}-{m}기` 신규. `buildArenaSheetTitle`/`buildArenaCompanyFolderName`/`decideArenaAction` 가 `gisu` 인자 받음(기존 "0기" 고정 폐기). `arenaSeasonLabel` 은 config 키로 유지.
2. **claim 폼** — 상단 토글 [일반 기수]/[아레나]. 아레나: 시즌(A 고정+숫자)·본인기수·이름 → `cohort = A${season}-${gisu}기` 조합해 `/api/claim` 호출. 미리보기 `→ A1-1기 이름`. 힌트 모드별 분기.
3. **create-arena-members** — body `members:[{name,gisu}]`. 참가자별 `cohortLabel=arenaCohortLabel(season,gisu)` 로 `findExistingSheetIdByCohortName`·`addTraineePrepRow` 수행 → claim 키와 포맷 일치. config 조회는 `seasonKey=A{season}` 유지.
4. **ArenaCreateModal** — 명단 입력을 한 줄 `"이름, 기수"` 로 파싱 → `members`. 미리보기/라벨 안내 갱신.
5. **(follow-up 반영)** create-arena 가 복제 직후 `writeProfile(sheetId, label, name)` 로 B3/C3 를 아레나 라벨로 기록 → claim 시 `writeProfile` skip(existingSheetId) 되어도 템플릿 기수값 잔존 방지.

## 매칭 정규화 (prep ↔ claim)
- 양측 모두 `String(c).replace(/기\s*$/,"").trim()` 동일 정규화 (`addTraineePrepRow` / `findExistingSheetIdByCohortName`).
  - 저장 `A1-1기` → `A1-1`, claim `A1-1기` → `A1-1` → 매칭. `기` 유무·후행 공백 흡수.
  - claim 폼이 항상 대문자 `A` 로 조합 → case-fold 불필요(정책: 폼 통제 표준형).
- `claimAccount` 의 `isTrainer` = `toUpperCase()==="T"` → `A1-1기` 오인 없음.
- **아레나는 prep 등록 전제**: Drive 이름검색 fallback(`세일즈PT_ A1-1기 … 수강생`)은 아레나 시트명과 불일치 → prep 없으면 not_found. 운영자가 명단 등록 후 클레임.

## 수용 기준
- [ ] 아레나 참가자: [아레나]→시즌1·기수1·이름 → `A1-1기 이름` 으로 본인 시트 연결.
- [ ] 일반 수강생/트레이너 claim 회귀 없음. create-arena-members 라벨 포맷 일치.
- [ ] `npm run check` + 단위테스트. 아레나 claim 1명 + 일반 1명 검증.
