> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 아레나 시즌2(A2) 시트 복사가 0/55로 막힌 문제(BBE-72)의 나머지 후보 ②③을
>   실측으로 배제하고, "A2 없이 개막" 차선책의 코드 안전성을 판정하고, Plan B(대안 생성 경로)를
>   정리한 BBE-76 조사 결과.
> - **누가 읽나요**: FM(반장) · belie · 후속 Claude Code 세션
> - **어떤 기능·작업과 연결?**: BBE-72(근인 카드) · BBE-76(이 조사 카드) · `docs/plans/active/arena-season2-setup.md`
> - **읽고 나면 알 수 있는 것**: 후보 ②③이 왜 아닌지(실측값) / "A2 제외 개막"이 안전한 이유(코드 근거) / 복사가 끝내 안 풀리면 무엇을 선택할 수 있는지
> - **관련 문서**: `docs/playbooks/oauth-console-check.md`(후보 ①), BBE-72, `docs/decisions/0015-admin-oauth-drive-create.md`

# A2 시트 복사 병목 — 후보 ②③ 배제 + 차선책 안전성 + Plan B (BBE-76)

## 확정된 사실 (BBE-72에서 넘어온 것, 재조사 안 함)

- 토큰 유효 · scope = `drive` 전체 · 소유자=admin 본인 · `canCopy=true` · 서로 다른 3명 원본 교차검증 전부 동일 실패
- 남은 모순: `canCopy=true`인데 실제 `files.copy`만 `403 PERMISSION_DENIED / forbidden`

## ② Drive 저장용량 — **배제 (실측 완료)**

FM 실행: `Arena Season2 Batch(mode=whoami)`, run [`31026502670`](https://github.com/bbelieff/salespt-log/actions/runs/31026502670), 2026-08-05 16:42 UTC, success.

```
admin Drive 저장용량: usage=67,931,258,322 bytes / limit=5,497,558,138,880 bytes (1.2% 사용)
```

63.3GB 사용 / 5TB 한도 중 **1.2%**. 저장공간은 문제와 무관 — **배제 확정**.

## ③ 파일 개별 복사 제한 — **배제 (실측 완료)**

같은 run, 원본 시트 메타데이터:

```
shared 플래그: true · 이 admin 계정의 복사 가능 여부(canCopy): true · 다운로드 가능: true
copyRequiresWriterPermission: false · 파일 용량: 44014 bytes
```

`copyRequiresWriterPermission=false` — 파일 자체가 "복사하려면 쓰기 권한 필요"라는 제한을 걸어두지
않았음. 파일 용량도 44KB로 정상적인 시트 크기. **파일 개별 정책은 문제와 무관 — 배제 확정.**

## 남은 후보 = ①뿐

②③이 실측으로 모두 배제되면서, `canCopy=true`인데 `files.copy`가 거부되는 모순을 설명할 수 있는
후보가 **① Google Cloud OAuth 앱 게시 상태(테스트/프로덕션)** 하나로 좁혀졌다. belie 콘솔 확인
안내서 = [`docs/playbooks/oauth-console-check.md`](../playbooks/oauth-console-check.md).

---

## ④ 차선책("A2를 DB 게이트에서 제외하고 시트 읽기로 개막") 안전성 판정

### 배경

`docs/plans/active/arena-season2-setup.md` §7-8이 이미 이 차선책을 언급했다("백필이 개막 전에
못 끝날 때"). 이번 조사는 그 차선책을 **코드로 직접 추적**해 안전성을 확인한 것 — 코드 수정
없음(읽기만).

### 코드 추적 결과

`lib/service/daily-source.ts`:

```ts
const DB_READ_COHORTS = new Set(["8", "9", "연습"]);
export function isDbReadPilot(cohort) {
  const norm = ...;
  return DB_READ_COHORTS.has(norm) || isArenaCohortLabel(norm);   // ← A1·A2 전부 여기로 편입
}
export function chooseDailySource(cohort, dbOn) {
  return dbOn && isDbReadPilot(cohort) ? "db" : "sheet";           // 읽기
}
export function chooseWriteSource(cohort, dbOn) {
  return dbOn && isDbReadPilot(cohort) ? "db" : "sheet";           // 쓰기 — 읽기와 대칭(고의 설계)
}
```

**결론 1 — 읽기·쓰기 둘 다 "sheet"로 간다.** `isDbReadPilot`이 false가 되면 읽기·쓰기 게이트가
동일하게 "sheet"를 반환한다(두 함수가 대칭이라 한쪽만 sheet로 가는 비대칭 상태는 발생하지 않는다
— read-your-writes 문제 없음).

**결론 2 — "sheet" 경로는 A2 참가자 본인의 새 시트로 정상 연결된다(A1로 되돌아가지 않는다).**
`chooseDailySource`/`chooseWriteSource`는 "DB냐 시트냐"만 결정하고, **어느 스프레드시트인지는
관여하지 않는다.** 어느 시트인지는 registry 조회(`findUserByEmail`)가 email로 사람을 찾아 그 행의
`spreadsheetId`를 쓰는 별도 경로다. `--flip-emails` 실행 후에는 그 사람 email이 **A2 행**에만
있고(원본 행은 `appendA2Row`가 A email 칸을 비워둔 채 만들고, `flipEmails`가 원본 행 email을
지운다 — `scripts/ops/arena-season2-batch.mjs:appendA2Row,flipEmails`), A2 행의 `spreadsheetId`는
새로 복사된 시트다. 즉 "sheet" 경로를 타도 **본인의 A2 시트**를 정상적으로 읽고 쓴다 — A1로
되돌아가지도, 허공에 뜨지도 않는다.

**결론 3 — 이월매출·시즌 표시는 DB/시트 경로와 무관하게 동일하게 계산된다.** 이월(시즌 전 성과)
판정은 `lib/types/contract-status.ts::isCarryoverContract`가 **읽는 시점에 계산**한다:

```ts
export function isCarryoverContract(p, courseStartISO) {
  if (p.구분 === "이월") return true;
  return iso(계약일) && iso(courseStartISO) && 계약일 < courseStartISO;
}
```

이 함수는 순수 함수 — 계약 데이터가 DB에서 왔든 시트에서 왔든 입력값(`구분`·`계약일`·
`courseStartISO`)만 맞으면 동일하게 동작한다. `courseStartISO`(=O1)는 배치 스크립트의
`setCourseDates()`가 새 A2 시트에 이미 써둔다(`arena-season2-batch.mjs:setCourseDates`). **셀에
숫자를 미리 계산해 넣지 않는 한**(설계도 §7-5가 이미 금지) 이월·시즌 매출 표시는 게이트 상태와
무관하게 안전하다.

### ⚠️ 발견한 위험 — 카드 문구를 문자 그대로 구현하면 안 된다

BBE-76 본문은 "`isArenaCohortLabel` 정규식에서 A2를 뺀다"고 적혀 있는데, 이 함수는
`lib/repo/user-priority.ts`에 정의되어 있고 **daily-source 게이트 말고도 3곳에 더 쓰인다**:
`dedupKeepIndex`(중복 행 정리 우선순위) · `pickPreferredUser` · `pickActiveArenaRow`(로그인 시
어느 행으로 연결할지 결정). **이 공용 함수 자체를 고치면 로그인·행 우선순위 로직까지 같이
바뀐다** — 의도한 것은 "DB 읽기 게이트만 A2 제외"인데 "A2 사용자 로그인 우선순위"까지 건드리는
훨씬 넓은 블라스트 반경이 된다.

**안전한 구현 방향(제안, 이번 카드 범위 밖이라 실행 안 함)**: `isArenaCohortLabel` 자체는 그대로
두고, `daily-source.ts::isDbReadPilot` 내부에서만 시즌 번호를 갈라 A2를 제외한다(예:
`isArenaCohortLabel(norm) && !norm.startsWith("A2-")`). 이러면 로그인·dedup 로직은 전혀 손대지
않고 DB 읽기 게이트 한 곳만 바뀐다 — 파급 범위가 정확히 의도한 만큼으로 좁아진다.

### 판정: **안전함** (위 안전한 구현 방향을 따를 때)

- 읽기·쓰기 대칭 유지 · 본인 A2 시트로 정상 연결 · 이월/시즌 표시 정상.
- 단, 구현 시 `isArenaCohortLabel` 자체가 아니라 `isDbReadPilot` 내부만 수정할 것(위 경고 참고).
- 이 판정은 §7-8이 이미 전제한 "복사는 됐는데 DB 백필이 못 끝난" 시나리오용이다. **지금 당장은
  복사 자체가 0/55라 이 차선책이 필요한 상황이 아직 아니다** — ①이 풀려 복사가 되기 시작한
  뒤에도 백필이 늦어질 경우에 대비한 판정으로 읽어야 한다.

---

## ⑤ Plan B — `files.copy`가 끝내 안 풀릴 경우의 대안 생성 경로 (조사만, 구현 없음)

| 방법 | 실현 가능성 | 소요 시간(추정) | 잃는 것 |
|---|---|---|---|
| **A. `spreadsheets.create` + 값만 복제** | 중간 — API 자체는 동작하나, 지금 막힌 것이 "OAuth 앱 게시상태로 인한 민감 동작 제한"이라면 파일 **생성**도 같은 제한에 걸릴 가능성이 있다(미검증 — ①이 풀리기 전엔 판단 불가). | 스크립트 작성 1일 내외 + **수식 재설치**(`docs/playbooks/setup-sheets.md`의 `[ID로 수식 설치]` 도구, #490) 별도 필요 | 원본이 값+수식 혼합 시트인데(CLAUDE.md §2.5 "시트 수식 자동" 컬럼들) 값만 복제하면 **수식이 전부 죽는다** — 대시보드·영업관리 자동계산 칸이 정적 숫자로 굳는다. 수식 재설치 도구로 복구 가능하나 별도 작업. |
| **B. belie가 Drive UI에서 직접 복사** | **높음 — 즉시 가능, ①과 완전히 무관** (belie 개인 브라우저 세션이라 우리 앱의 OAuth 앱 게시상태 제한을 아예 타지 않는다). Drive는 여러 파일 다중선택 후 "사본 만들기"가 가능해 55개를 한 번에 복사할 수 있다(이름은 개별 정정 필요). | 다중복사 자체는 수 분. **이름 정정 55건**(관례 `세일즈PT_A2_{기수}기 {이름}_대표님 경영일지`) = 사람당 ~1분, 총 **~1시간**. 이후 날짜(O1/O2) 기입·SA 공유·registry 적재는 **SA 권한(읽기/편집 전용, 생성 아님)으로 스크립트가 이어받을 수 있다** — 새 파일 ID를 제목으로 찾아 매칭하는 소규모 스크립트 변경 필요(이번 카드 범위 밖, 별도 소형 PR 필요). | 서식·수식은 원본 그대로 보존(Drive 사본 만들기는 완전 복제) — **잃는 것 없음.** belie의 수작업 시간(~1시간)이 유일한 비용. |
| **C. 서비스 계정(SA) 경유 생성** | **기각 유지 — 재론하지 않음.** ADR-0015: masterbot(SA) storageQuota.limit=0, My Drive 폴더에서 SA가 파일을 만들면 소유자가 SA가 되어 용량 0으로 즉시 실패. 이미 실측·문서화된 결론. | — | — |

**권장 순서**: ①(콘솔 확인)이 D-2 안에 안 풀릴 경우 → **B(belie 수동 복사 + SA 이어받기 소형 스크립트)**가
가장 현실적인 Plan B다. A는 수식 유실이라는 확실한 손실이 있고 ①과 같은 벽에 걸릴 수도 있어 B보다
후순위. B를 쓰려면 "새 파일 ID를 이름으로 찾아 매칭"하는 소형 스크립트 변경이 필요한데, 이건
`scripts/ops/arena-*` 레인(FM 소유)이라 이 카드에서 구현하지 않았다 — 필요해지면 FM에게 별도
계약으로 요청.

## Log

- 2026-08-05 작성(경영일지 작업원D, BBE-76) — ②③ 실측 배제(FM run `31026502670`), ④ 코드 추적
  안전성 판정 + 안전한 구현 방향 경고, ⑤ Plan B 3안 표. 쓰기 0건.
