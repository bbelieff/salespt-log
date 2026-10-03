> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 새 기수 시트를 복제할 때 **기수·이름(B3:C3)** 을 찍지 않아 11기가 앱에서 8기로 보였던 사고와 그 봉합.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `app/api/admin/create-cohort-members`, `lib/service/auth.ts`(클레임), `lib/repo/sales-profile.ts`
> - **읽고 나면 알 수 있는 것**: 기수가 어디에 저장되나 / 왜 8기로 보였나 / 왜 클레임이 못 고쳤나
> - **관련 문서**: `docs/domains/sheet-structure.md` §6

# 11기가 8기로 보인 사고 — 새 시트에 기수 도장 찍기

**상태**: 데이터 교정 완료 · 코드 봉합 진행 중
**신고**: belie 2026-09-04 「11기로 적고 들어왔는데 8기로 등록되었어」

## 기수는 세 군데에 있다

| 어디 | 역할 |
|---|---|
| registry **B열** cohort | **deprecated** (`lib/repo/users.ts` 헤더) |
| registry **I열** cohortLabel | 시트 B3 의 **캐시** |
| 수강생 시트 `01 영업관리` **B3** | ★**정본** |

## 무엇이 틀렸나 (2026-09-04 실측)

11기 7명 전원 — **B열 11(맞음) / I캐시 8 / 시트 B3 8**, 그리고 **C3(이름) 빈값**.
날짜(O1/O2)는 옳았다(9/4 시작, 10/24 종강). cohorts 탭에도 11기가 active 로 정상 등록.

belie 는 「11」로 제대로 쳤다 — B열이 그 증거다. 화면이 정본인 B3 를 보기 때문에 8기로 보였다.

## 왜 8이 남았나 — 구멍 둘이 겹쳤다

1. **`create-cohort-members` 가 B3:C3 를 안 썼다.** 템플릿(8기 사본)을 복제하면서
   **O1/O2(날짜)만** 덮어썼다. 같은 파일의 날짜 주석이 이미 *"템플릿에서 딸려온 이전 기수
   날짜"* 를 경고하고 있었는데, **기수·이름은 같은 처방을 못 받았다.**
2. **클레임이 못 고친다.** `lib/service/auth.ts` 는 사전등록 행에 spreadsheetId 가 이미
   있으면 `writeProfile` 을 건너뛴다 — `if (!existingSheetId && !resolved.redirected)`.
   관리자가 미리 만들어 둔 기수는 **항상** 이 조건에 걸린다.

**아레나 라우트(`create-arena-members`)는 이미 이 처리를 하고 있었다** — 주석까지 똑같이
*"claim 시 writeProfile skip 되므로 여기서"*. 숫자 기수 경로만 빠져 있던 **비대칭**이었다.

## 한 것

**① 데이터 교정 (완료, 2026-09-04)** — 7명 시트 B3=11, C3=이름. 딱 14칸.
수식 칸은 건너뛰도록 pre-read 가드를 걸고, 바꾸기 전 값(전부 `8`/빈값)을 전부 출력해 남겼다.
이어서 관리자 [🔄 동기화](`/api/admin/migrate-registry-cache`)로 레지스트리 I~L 캐시와 DB
미러를 시트 값으로 다시 채웠다(processed 160 · updated 139 · failed 2 — 아래 참조).
검증: 세 곳(B열/I캐시/시트B3) 모두 11 일치, `/api/admin/users` 에서 cohortLabel=11 확인.

**② 코드 봉합** — `create-cohort-members` 의 **create 모드**에서 `writeProfile(newSheetId,
parsed.label, name)` 로 B3:C3 를 찍는다. 아레나는 제외(자기 라우트가 이미 처리 + 라벨 모양이
다름: 여기 `parsed.label`="A2", 아레나는 "A2-6기"). 실패는 흡수 — 날짜와 같은 방침으로
기수 생성 자체를 막지 않는다.

## 되돌리기

- 데이터: 7시트 B3:C3 를 `8` / 빈값으로 되쓰면 원상복구(권장하지 않음 — 지금이 맞는 값).
- 코드: `git revert <squash-sha>` 한 번.

## 남은 것

- 동기화가 못 읽은 시트 **2건** — 8기 이용호, A2-6기 최정한. SA 접근권 문제로 보인다
  (`scripts/ops/verify-sa-sheet-access.mjs` 로 확인 가능). 이번 사고와는 무관하지만 캐시가
  낡은 채 남아 있다.
- **link 모드**(남의 기존 시트를 붙이는 경로)는 여전히 B3 를 안 찍는다 — 의도적이다.
  남의 시트를 건드리지 않는다는 기존 방침(날짜도 동일)을 따른다.

## 수용 기준

- [ ] 11기 7명 세 곳 모두 11 (완료)
- [ ] `create-cohort-members` create 모드가 B3:C3 를 찍는다
- [ ] 아레나 경로 동작 불변
- [ ] link 모드는 시트를 안 건드린다
- [ ] `scripts/check.sh` 초록
