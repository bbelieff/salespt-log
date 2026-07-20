# 2026-07-20 · DB생산 카드 거짓 dirty·유령 이탈 가드 → 편집 유실

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: DB생산 탭 카드에서 미저장 판정을 **첫 onChange(computed) 스냅샷**으로 잡아, 수식/자동값이 흔들릴 때마다 상시 거짓 dirty → 이탈 가드 모달 반복 + discard 오되돌림으로 편집 유실. dirty 판정을 자동필드 제외 순수함수로 옮기고 접힘-리셋+가드로 마감.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: DB생산 탭(`app/(app)/db`), 미저장 이탈 가드(`components/DirtyGuard`), R3-4 DB 정본 전환
> - **읽고 나면 알 수 있는 것**: 무엇이 터졌나 / 근인 3겹 / 왜 게이트가 못 잡았나 / 하네스 갭
> - **관련 문서**: `docs/domains/*`(db), `docs/worklog.md`

## 무엇이 터졌나 (belie 리포트, 연습용 계정)
DB생산 탭 **최신 카드**에서:
1. **이전 저장 내용이 날아감** — 편집한 내용이 사라짐.
2. **"저장 후 이동" 이탈 가드 모달 반복** — 저장/이동해도 다음 이동마다 또 뜸.

belie 가 연습용(파일럿·DB 정본)에서 겪었고 수강생도 동일 위험 → **유실급 급행**.

## 근인 (3겹, 순차로 드러남)

### ① 거짓 dirty — 기준선을 "첫 computed" 로 잡음
`RowCard` 가 미저장 기준선을 `RowForm` 의 **첫 `onChange(computed)` 스냅샷**에서 잡았다.
`computed` 는 formula/자동 필드(개당단가·주문금액·기간예산)를 포함하고 **타이밍 의존**이라,
수식·자동값이 mount 정착·refetch 로 흔들리면 카드가 **상시 거짓 dirty**. 최신 행 자동 펼침과
결합해 이동마다 가드 모달이 반복됐고, 가드 discard 가 잘못된 기준선으로 되돌려 유실을 체감시켰다.

**수리(커밋 1)**: dirty 판정을 순수함수 `rowFormDirty(fields, base, current)` 로 이관 — **formula
필드 제외**, `norm()` 으로 number/string/bool/undefined 정규화(타입차 거짓 dirty 방지). `RowForm`
이 `blank`(서버 파생, 자동필드 없음) vs `draft` 로 판정해 `onDirtyChange` 로 보고. `blank` 은
`useMemo([channel.cls])` 라 `initial(=서버 row)` 이 refetch 로 바뀌어도 재계산 안 됨 → **편집 중
draft 안 덮임**(유실 벡터 차단). 회귀 테스트 9(거짓 dirty 0).

### ② 유령 이탈 가드 — dirty 가 접힘 시 안 풀림 (①수리가 남긴 회귀)
①에서 `RowCard.dirty` 를 `useState` 로 바꿨는데, 유일한 setter 인 `RowForm.onDirtyChange` 는
**펼침에서만 렌더**된다. 접히면 `RowForm` 언마운트 → `dirty` 가 `true` 로 **얼어붙어** DirtyGuard
엔트리가 잔류 → 다음 이동마다 유령 모달. **💾 저장 경로**(handleSave→collapse)에서도 나서
리포트 증상 ② 그 자체였다(이 회귀는 master 파생-dirty 시절엔 없었음).

**수리(커밋 2)**: `RowCard` 에 `useEffect(() => { if (!expanded) setDirty(false) }, [expanded])` —
접힘 유발 모든 경로(저장·무시·× · 다른 행 전환)에서 dirty 해제. 단 이 리셋이 편집을 무음
유실시키지 않게 `page.tsx` 의 `onExpand`(다른 행 클릭)·`+추가` 버튼을 `guardedNav` 로 감쌈
(§2.5 사용자 작성값 절대 보존, 선확인). 불변식: **"펼친 행만 dirty 가능 · 떠날 땐 항상 가드"**.

### ③ 저장 실패 시 가드가 이동 강행 → 편집 유실 (②수리가 좁게 악화)
`handleSave` 가 patch 실패를 **삼키고 rethrow 안 함** → `DirtyGuard.saveAll` 이 항상 성공으로
관측 → '저장하고 이동' 시 저장이 실패해도 pending 이동 실행 → 행이 접히며 ②의 collapse-effect
가 dirty 를 지워 **저장 실패한 편집이 무음 유실**. 접힘-리셋 도입 전엔 파생 dirty 가 유지돼
보존되던 경로 — ②가 좁게 악화시킨 지점.

**수리(커밋 3)**: `handleSave` 가 실패 시 `throw e`(토스트 후) → `saveAll` 이 실패 관측 → `fail>0`
→ 모달 '…건 저장 실패' 유지·이동 취소·행 펼침 유지(편집 보존). 추가폼(append, try/catch 없음)은
이미 throw→모달 유지라 정합. 직접 💾버튼은 `void Promise.resolve(onSave(draft)).catch(()=>{})`
로 rethrow 삼켜 unhandled rejection 방지(가드 saveAll 경로는 throw 관측 유지).

## 왜 게이트(check.sh)가 못 잡았나 — **핵심 갭**
근인 3겹 모두 **React 컴포넌트 상태·이펙트 배선**(dirty 기준선·언마운트 시 미해제·비동기 저장
실패 전파)에 있다. `check.sh` 는 typecheck·lint·구조테스트·서비스/레포 단위테스트를 돌리지만
**컴포넌트 렌더링/이펙트 테스트(RTL) 인프라가 없다** → 이런 상호작용 버그를 정적으로 못 잡는다.
- ①의 순수 판정 로직은 `rowFormDirty` 로 떼어내 단위테스트(거짓 dirty 0)로 박제 가능했지만,
  ②③(언마운트 시 dirty 해제·가드 저장 실패 전파)은 렌더 타이밍이라 **적대 리뷰**로만 잡혔다.

## 하네스 갭 (Hashimoto — 재발 방지 후보)
1. **컴포넌트/이펙트 테스트 인프라 부재** — dirty-guard 류 상호작용 회귀를 기계 검증 못 함.
   후보: React Testing Library + jsdom 도입, 최소한 DirtyGuard 등록/해제 불변식(접힘→해제,
   저장 실패→유지)을 테스트로 박제. (도입 비용 큼 — 별도 트랙 제안)
2. **판정 로직은 순수함수로 뽑아 테스트** — ①처럼 dirty 판정을 컴포넌트 밖 순수함수로 두면
   단위테스트로 거짓양성/음성을 고정할 수 있다. 새 폼 가드는 이 패턴을 우선.
3. **비동기 저장 콜백은 실패를 throw 로 전파** — 가드(saveAll)·재시도 로직이 실패를 관측하려면
   `mutateAsync` 실패를 삼키지 말 것. 삼키면 "성공으로 오인 → 이동 강행 → 유실". (③ 교훈)
4. **에이전트 교훈**: dirty-guard 수리는 "판정"만 고치면 안 되고 **등록/해제 생명주기 전체**
   (마운트·언마운트·저장·무시·전환·실패)를 경로별로 추적해야 한다. 적대 리뷰가 ②③을 연쇄로
   드러냈다 — 1차 수리 후 재검증이 없었으면 회귀를 그대로 배포했을 것.

## 상태
`fix/db-card-dirty-guard` 3커밋. check.sh 초록(725). 적대 리뷰 2라운드로 ②③ 발굴·마감,
유령 모달 4경로 소멸·신규 무음 유실 없음 확인. 라이브 재검증 = D 요청(dispatch 지시).
