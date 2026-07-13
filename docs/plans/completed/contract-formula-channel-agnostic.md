---
status: completed
slug: contract-formula-channel-agnostic
created: 2026-06-06
owner: belie
related: j-formula-channel-agnostic, 0010-meeting-reservation-derived
completed: 2026-06-09
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 콜·지·기·소 채널 계약이 01 영업관리 N(계약건수)·O(수임비) 수식에 미집계되던 버그 — 채널 separator 변종에 강건한 매칭으로 수정.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/repo/setup-formulas.ts`(N/O/P 수식), 대시보드 계약 건수·수임비, 퍼널
> - **읽고 나면 알 수 있는 것**: 왜 콜지기소만 누락됐는지, 왜 채널무관이 아닌 separator-무관 매칭인지, 전파 방법
> - **관련 문서**: [j-formula-channel-agnostic](j-formula-channel-agnostic.md)(같은 계열 선행 — J~M), [sheet-structure](../domains/sheet-structure.md)

# 콜·지·기·소 계약 미집계 (N/O 채널 매칭) fix

## 사용자/PostHog 보고 (2026-06-05)
대시보드 계약 7 vs 실무수납 8 불일치. 오승진 ㈜밤볼 6/5 콜·지·기·소 계약(₩1,100,000)이 01 영업관리 계약건수(N)·수임비(O)에 미집계.

## 증거 (오승진 시트 실측)
- 04 업체관리: ㈜밤볼 | 콜·지·기·소 | 미팅 6/5 | 상태=계약 | ₩1,100,000 — 데이터 정상.
- 01 영업관리 6/5: 오늘미팅수 1·완료 1(밤볼 인식) **but 계약건수=0·수임비=₩0**.
- 02 계약수납관리: 밤볼 포함 8행. 대시보드 매출(02 합산) ₩4,550,000 정확, 계약 건수(01 수식)만 7.

## Root Cause
- N/O/P 는 **채널별** 수식 (j-formula 에서 J~M 만 채널무관化, N/O/P 는 채널별 유지 — 합산 시 4배 방지).
- N = `COUNTIFS(04!D=날짜, 04!F=$D{r}, 04!J="계약")`. 채널을 `04!F:F=$D{r}` **정확매칭**.
- 완료수 L 은 F 필터가 없어(`D:D`만) 밤볼이 잡힘 → **증상이 N/O 만 0** 인 결정적 단서.
- `$D{r}`(영업관리 D 라벨)은 `setDChannelLabels` 가 "콜·지·기·소"로 정규화하지만, **`04!F`(미팅 데이터)는 raw 보존(§2.5)** 이라 separator 변종("콜-지-기-소" 등)이면 정확매칭 실패 → 계약 0.

## Fix (lib/repo/setup-formulas.ts `formulasForRow`)
- **콜·지·기·소 행(channelIdx 3)만** separator-무관 매칭:
  - N/O: COUNTIFS/SUMIFS 채널 criteria = **와일드카드 `"콜*소"`** (콜·지·기·소/콜-지-기-소/콜지기소 모두 매칭, 다른 채널은 콜로 시작 안 해 오매칭 0).
  - P(계약비고): FILTER 채널 조건 = `LEFT(04!F,1)="콜"`.
- 다른 3채널(매입DB/직접생산/현수막)은 separator 없어 **정확매칭 `$D{r}` 유지**(오매칭 위험 0, 회귀 0).
- 채널무관(날짜 전체 집계) 안 쓴 이유: N 은 8주 28행(7일×4채널) 합산 대상이라 채널무관 시 **4배 중복**.
- 단위 테스트: `formulasForRow(13/17/47)` 와일드카드, `(10/11/12)` 정확매칭, 계약·날짜 필터 유지.

## 전파 (기존 시트 + 템플릿 + 8기)
모든 경로가 동일 `installFormulas` + §2.5 가드(`isSafeToOverwrite`: raw 값 skip, 수식/빈셀만 교체) → 사용자 입력값 안 덮음. 재설치 후 각 그룹 1명씩 스팟체크.

- **(a) 7기 전원 + 연습기** — 관리자 `install-formulas-bulk`(레지스트리 순회, 기존 [🛠️ 수식 복원] 버튼).
- **(b) ★ 양식 마스터 템플릿** = SSOT `lib/config/cohort-template.ts:DEFAULT_COHORT_TEMPLATE_ID` = `1OcZedEkncMDD5mcseQmQkJJMEQQ_zuimyUsIBaNnmIE`("0605ver") — **필수**(향후 복사본이 결함 상속 방지). 구 `1nx1Eufk…` 는 deprecated(복제 원본 금지).
- **(c) 8기 기복사 4본** (김승엽·김현민·박상준·이용호) — 레지스트리 미등록.
  - 김승엽 확인분: `1UvveVcsen0uGE-EdCoLYE5dHCgs_DyIKQtFAgpiEDJs`. 나머지는 "★★★★세일즈PT 8기" 폴더(`1rIxiC3G1ndOVZAz_lk1KOuN5R0jjv5q2`) 하위 이름폴더에서 제목 `세일즈PT_ 8기 * 경영일지` 로 찾아 ID 확보.
- **(b)+(c) 설치 경로** — `POST /api/admin/install-formulas-by-id` (시트 ID/URL 배열 직접 지정, 레지스트리 무관). UI: `/admin/users` 헤더 [📋 ID로 수식 설치].
- **(c) Drive 자동 enumerate (구현됨)** — by-id 패널의 [🔍 폴더에서 찾기]: 8기 폴더 ID(`1rIxiC3…`) + 제목 토큰("세일즈PT 8기 경영일지") → `POST /api/admin/discover-folder-sheets`(read-only, `listSheetsInDriveByTokens` — 폴더 driveId 범위 `corpora:drive` 검색, 숫자경계 "8기"≠"18기" 가드) → 발견 시트 ID 를 textarea 에 채움 + 이름 목록 확인 → [설치]. 읽기(발견)/쓰기(설치) 분리로 admin 검토 후 설치.
- 전제: **masterbot 이 세일즈PT★ 공유 드라이브 멤버(콘텐츠 관리자)** — 권한 부여 완료 후 실행. 없으면 by-id 결과 failed.
- **4채널 일반화 점검**: 재설치 후 매입DB/직접생산/현수막/콜·지·기·소 **모두** 계약 집계 정상인지 확인 — 콜지기소만 separator 문제였는지, 다른 채널도 변종이 있는지 확정(다른 채널은 separator 없어 정상일 것으로 예상).

## 범위 밖 (PC 확인 권장)
- `01!K3:L6`(채널별 계약총합)·`R1:U6`(채널 매트릭스)는 **시트 템플릿 수식**(우리 코드 미설치, dashboard.ts 는 read만). K 가 per-channel N 의 SUM 이면 본 fix 로 자동 교정. 만약 K/대시보드 IV 가 04 를 독립 COUNTIFS(정확채널)하면 템플릿 수정 필요(코드 범위 밖) — PC에서 확인.
- 영업관리 I(미팅예약기록)도 `F:F=$D{r}` 정확매칭이라 콜지기소 예약 표시 동일 문제 가능 — 단 본 건은 **계약(N/O)** 보고이며 I 는 예약 display(미보고)라 이번 범위 제외.

## 수용 기준
- [ ] 오승진: 01 6/5 계약건수=1·수임비 ₩1,100,000 → 대시보드 계약 8건·퍼널 8 = 실무수납 8 일치. 채널별 성과 콜지기소 계약 1.
- [ ] 매입DB 등 기존 채널 계약 집계 회귀 없음(다른 수강생 수치 불변).
- [ ] 수식 재설치가 raw 입력값 미손상(§2.5 가드 테스트).
- [ ] (전파) 템플릿 + 8기 4본에 by-id 설치 성공. 8기 1본 + 템플릿에서 콜·지·기·소 계약 **테스트 입력 → 계약건수 집계 확인 → 테스트값 제거**.
- [ ] `npm run check` 통과.
