# 기수 생성 수강시작일 — 전달 보장 + 결과 가시화

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: admin 기수 생성에서 수강시작일이 조용히 유실되던 두 지점(클라 미전달 · 서버 미기록)을 막고, 날짜가 안 들어간 사실을 생성 결과 화면에서 즉시 보이게 한다.
> - **누가 읽나요**: 개발자, 운영자(belie)
> - **어떤 기능·작업과 연결?**: `components/auth/CohortCreateModal.tsx` · `app/api/admin/create-cohort-members/route.ts` · `lib/repo/course-dates.ts` · `lib/service/cohort-dates.ts`
> - **읽고 나면 알 수 있는 것**: ① 왜 같은 사고가 2번 났는가 ② 무엇을 고쳤는가 ③ 무엇을 일부러 안 고쳤는가
> - **관련 문서**: `docs/plans/active/finalize-cohort10-dates.md`(사고 수리 SoR, `chore/finalize-cohort10` 브랜치) · `docs/decisions/0005-week-counting-convention.md` · `docs/design/components.md`

## 1. 왜 (사고 2회 — 같은 증상, 원인은 둘)

`영업관리!O1` 은 대시보드 `C33:H40` 주차 버킷의 **앵커**다. 복제 템플릿(0605 = 8기 사본)의
잔존 O1(`2026-06-12`)이 새 기수 시트에 남으면 개막 후 모든 기록이 9주차 밖으로 튀어 **전 지표가
0** 으로 보인다. `B3`(기수)은 앱 표시 기수의 정본(`lib/service/me.ts:403` 이 시트 값을
레지스트리보다 우선)이라 잘못된 기수까지 함께 표시된다.

실제 사고 2건: 연습용2(`scripts/ops/fix-cohort-b3-practice2.mjs`) · 10기 6명
(`scripts/ops/finalize-cohort10.mjs`, 2026-08-05 수리 완료).

**원인은 하나가 아니라 둘이었다** — 둘 중 하나만 고치면 사고가 또 난다.

| # | 지점 | 무슨 일이 벌어지나 |
|---|---|---|
| **A. 클라이언트 미전달** | `CohortCreateModal` | 폼 자체는 정상 controlled input(`value`+`onChange`). 다만 **자동화(브라우저 조작)가 DOM `.value` 를 직접 세팅**하면 React `onChange` 가 발화하지 않아 state 는 빈 채로 제출 → 서버가 "날짜 없음 → 시트 값 유지" 경로. |
| **B. 서버 미기록** | `create-cohort-members/route.ts:273` | 날짜가 **제대로 전달돼도** `writeCourseDates` 를 `allowTemplateOverwrite` 없이 호출. 템플릿 O1 은 raw 날짜(`2026-06-12`)라 `isSafeToOverwrite`=false → **O1·O2 둘 다 보존**, 입력 날짜는 `console.warn` 한 줄만 남고 버려진다. |

B 는 아레나 쪽에서 이미 같은 처방으로 고쳐졌다(#658 `create-arena-members`). 일반 기수 경로만
남아 있었다. 게다가 두 실패 모두 **화면에 아무 흔적을 남기지 않아** 운영자가 개막 후에야 알았다.

## 2. 무엇을 한다 (3갈래)

### ① 제출 시 ref 폴백 — 자동화·자동완성 방어
`resolveCourseStartInput(state, dom)`(순수, service) 로 **state 우선 · 비었으면 input 의 DOM
value 폴백**. 폴백으로 값을 찾으면 화면 state 도 동기화해 "보이는 값 = 보낸 값"을 맞춘다.

### ② 결과 리포트 가시화 — 조용한 실패를 화면으로
응답에 `dates: [{ name, sheetId, status, written, courseStartISO, graduationISO, sheet? }]` 추가.
- `status` = `written` / `no_input` / `preserved` / `error` (`classifyCourseDateOutcome`, 순수).
- `written` 이 아니면 그 시트의 **O1·O2·B3·C3 를 실측 readback**(`readCourseDateCells`,
  FORMULA 렌더 — `=O1+50` 같은 템플릿 잔재가 그대로 보이게) 해서 응답에 담는다.
- 모달은 초록(기록됨: O1 → O2, N명) / 앰버(미기록 + 시트에 실제 남은 값 표) 두 블록으로 표시.

readback 은 **비정상 경로에서만** 호출한다(정상 생성 시 시트 read 0회 — 요청당 추가 호출 없음).

### ③ 날짜 미입력 확인 1회 (create 모드)
`create` + 날짜 빈값이면 첫 [실행]에서 앰버 경고만 띄우고 **멈춘다**. 한 번 더 누르면 진행.
날짜를 입력하면 확인 상태는 해제된다.

### ④ (B 근본수리) 갓 복제한 시트에 `allowTemplateOverwrite: true`
`plan.action === "create"`(= 방금 `copyTemplateSheet` 한 빈 복제본)일 때만 켠다. `link` 모드와
재사용 시트는 **그대로 §2.5 보존 가드** 아래 남는다. 정본 로직(`planCourseDateWrite`)은 손대지
않고 기존 플래그를 넘기기만 한다 — 새 쓰기 경로 없음.

## 3. 일부러 안 한 것 (스코프 밖)

- **B3/C3 자동 기록**: 일반 기수 생성 경로는 `writeProfile` 을 호출하지 않는다(claim 시점에
  `lib/service/auth.ts:196` 이 쓴다). 여기서 쓰기를 추가하면 claim 정본과 두 갈래가 된다 →
  이번엔 **읽어서 보여주기만** 한다(`sheet.b3`). 쓰기 필요 여부는 별건.
- **개막 전 저장 500 → 400 매핑**(finalize-cohort10 §6-1): 별건.
- **10기/연습용2 실데이터**: 이미 ops 스크립트로 수리 완료. 이 PR 은 코드만.

## 4. 게이트

- [x] `npm run typecheck` · `lint` · `test:structural` · `test` (= `scripts/check.sh` 초록)
- [x] 회귀 테스트: 순수 함수(resolve/classify/parse) + 라우트 레벨(allowTemplateOverwrite 전달·
      no_input readback·link 모드 미접촉)
- [ ] PR 머지 + §6.8(배포 run success + health 200)

## 5. 되돌리기

단일 squash 커밋 → `git revert <sha>` 로 전량 원복. 시트에 남는 부작용은 ④ 가 새 복제본 O1/O2 를
입력값으로 덮는 것뿐이며, 이는 현재 운영자가 손으로 수리하던 값과 동일하다.
