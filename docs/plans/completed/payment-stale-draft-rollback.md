> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납(02)에서 저장한 내용이 이탈 팝업의 "저장하고 이동"에 의해 옛값으로 롤백되던 데이터 유실 hotfix 계획.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/ContractRow.tsx`, `components/DirtyGuard.tsx`, `app/(app)/payment/page.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 저장이 롤백됐나 / 어떤 3가지를 고치나 / 회귀를 무엇으로 고정하나
> - **관련 문서**: `docs/design/components.md`(DirtyGuard 등재), `docs/worklog.md` 📮🚑(2026-07-21)

# 🚑 hotfix — 실무/수납 저장 유실 + 이탈 팝업 루프

**상태**: ✅ 완료 (DevC, 2026-07-21) — #613 master e68b1d4 · 배포 success · health 200
**브랜치**: `fix/payment-stale-draft-rollback`
**신고**: belie · **원인 확정**: Cowork 라이브 재현(김지훈 A1-1, network 로그)

## 1. 증상

PC에서 계약 카드를 편집·저장하면 저장은 성공하는데, 화면을 이동하려 하면
"저장하지 않고 나갈까요?" 팝업이 **반복**해서 뜬다. 팝업의 **"저장하고 이동"을 누르면
방금 저장한 내용이 편집 전 옛값으로 되돌아간다**(유실).

실측 network: `PATCH(새값) 200` → 팝업 저장 → `PATCH(옛값)` 발사.

## 2. 원인 (클라이언트 2중 결함 — 서버·R3 경로 결백)

무변경·변경·원복 PATCH 전부 200, 라운드트립 diff 0 → 서버 재검증 불요.

### ① stale draft 가 false-dirty 로 등록되어 롤백을 일으킴

`ContractRow` 는 `const [draft, setDraft] = useState<ContractPayment>(cp)` 로 로컬 draft 를 만든다.
**`useState` 초기값은 마운트 1회만 적용** — 이후 `cp` prop 이 바뀌어도 draft 는 옛값에 동결된다.

PC 마스터-디테일은 **같은 계약 행을 2개 인스턴스로 렌더**한다:

| 인스턴스 | props | body(편집 UI) | key |
|---|---|---|---|
| 목록 | `selectable` | `showBody=false` → **렌더 안 됨** | `cp.row` (선택 변경 시 remount ❌) |
| 상세 | `forceOpen` | 렌더됨 | `detail-${row}` (행 변경 시 remount ✅) |

상세에서 편집·저장 → refetch 로 `cp` 갱신 → **목록 인스턴스의 옛 draft ≠ 새 cp** →
`useDirtyEntry` 에 dirty 로 등록 → 이탈 시 팝업 → 팝업 저장이 **그 옛 draft 를 PATCH = 롤백**.
롤백으로 cp 가 옛값이 되면 이번엔 상세 인스턴스가 dirty → 팝업 → … **두 인스턴스 핑퐁 = 무한 팝업**.

### ② `onSave` 미-await 로 저장 실패가 은폐됨

`ContractRow.saveAll` 이 `onSave(draft)` 를 **await 하지 않는다**(Props 타입이 `void`).
`DirtyGuard.saveAll` 은 `await e.save()` 의 throw 로 실패를 세는데, 즉시 resolve 되므로
**fail 은 항상 0** → 저장이 실패해도 "성공"으로 간주하고 이동한다(가짜 성공 이동).

## 3. 수정 (수용 기준)

- **ⓐ** `selectable`(편집 UI 없는 목록) 인스턴스는 **저장 주체에서 제외** — `useDirtyEntry` 조건을
  `dirty && !selectable`. 근거: `selectable` 이면 `showBody=false` 라 draft 를 바꿀 `onChange` 경로가
  물리적으로 존재하지 않는다(업체정보 `ciTouched` 포함) → 제외해도 사용자 편집 유실 0.
- **ⓑ** `cp` prop 이 바뀌었고 **사용자가 편집 중이 아니면** draft 를 새 cp 로 **재기준**(`setDraft(cp)`).
  "편집 중" 판정 = `localEdited` ref (편집 onChange 계열에서 set, 저장 성공·discard 에서 clear).
  저장 in-flight 중 새 편집이 들어온 경우를 구분하기 위해 **편집 세대(generation) 카운터**로
  스냅샷 비교 후에만 clear 한다(=in-flight 편집을 clear 가 삼키지 않음).
- **ⓒ** Props `onSave` 를 `Promise<void>` 로 바꾸고 `saveAll` 에서 **await** → 실패가 DirtyGuard 로 전파.

> ⚠️ **ⓒ 보강(감사에서 발견)**: `page.tsx handleSave` 가 `try/catch` 로 에러를 **삼키므로**
> 시그니처만 결선하면 `failMsg` 는 여전히 작동하지 않는다. 실패 전파를 실제로 성립시키려면
> handleSave 가 toast 후 **re-throw** 해야 한다. (감사 결과에 따라 확정)

## 4. 500줄 캡 제약

`ContractRow.tsx` = **498줄** (상한 500). 수정을 얹으면 초과 → **순수 로직을 `_lib/` 로 추출**한다.
이 레포는 vitest `environment:"node"` · include `tests/**/*.test.ts` 만이라 **React 컴포넌트/훅 테스트가 불가능**하다.
따라서 추출은 캡 해소와 **회귀 테스트 가능성**을 동시에 만족시키는 필수 선택이다.

추출 대상: `app/(app)/payment/_lib/draft-sync.ts` — 부수효과 없는 판정 함수
(dirty 참여 여부 · 재기준 여부 · dirty 계산). 기존 선례 = `_lib/payment-progress.ts` +
`tests/service/payment-progress.test.ts`(`@/app/(app)/payment/_lib/...` import).

## 5. 회귀 테스트 (고정할 시나리오)

1. 편집 → 저장 → refetch(cp 갱신) 후 **어떤 인스턴스도 dirty 로 등록되지 않는다**.
2. 저장 in-flight 중 이동 → 팝업 저장이 **최신 draft** 를 저장한다(옛값 롤백 금지).
3. `selectable` 인스턴스는 cp 가 어떻게 바뀌어도 저장 주체가 되지 않는다.
4. 사용자가 **편집 중**일 때 cp 가 외부에서 바뀌어도 draft 를 덮어쓰지 않는다(편집 보존).
5. 모바일 아코디언(단일 인스턴스) 동작 회귀 0.

## 5.5 적대적 검증 결과 (5렌즈 × 3반증자 = 65 에이전트, 20주장 → 9생존)

**BLOCKER 1건이 이 PR 안에서 잡혔고, 같은 PR 에서 닫았다.**

- 🛑 **저장 실패 시 가드가 통째로 풀림 (이 수정이 만든 회귀, 반증 0/3)**
  `handleSave` 가 에러를 삼켜 `await onSave(draft)` 가 성공처럼 resolve → `setTouched(false)` →
  dirty=false → DirtyGuard 가 엔트리 해제 + **beforeunload 리스너까지 제거** → 이후 이탈·새로고침·
  창 닫기에서 **무경고 유실**. master 는 dirty 가 값 비교라 실패 시 cp 불변 → dirty 유지로 붙잡았다.
  → **"ⓒ 를 후속 PR 로 분리" 판단이 틀렸음이 증명됨**. 새 dirty 모델이 에러 전파에 의존하므로 동시 수정:
  - `page.tsx handleSave`: 토스트 후 `throw e` **재전파**(같은 줄 — 500/500 유지)
  - `saveAll`: 실패 시 `setTouched(false)` **미도달** → 의도 유지 → 가드 존속 + `DirtyGuard.failMsg` 작동
  - 비-가드 호출처 unhandled rejection 차단: `onClick={saveAll}` · `onEnsureSaved` ×3 을 `.catch` 로 감쌈
    (TodoSection:86 은 fire-and-forget `() => void` 라 필수)
- 🛑 **업체정보 POST 실패를 삼킨 뒤 ciTouched 해제** → `res.ok` 확인 후에만 해제 + 실패 시 throw.
- ⚠️ **업체정보 in-flight 보호 부재** → ci onChange 도 `editSeq` 를 올리고, POST 중 새 입력이면 해제 보류.

### 범위 밖 잔여 위험 (기록만 — 이 PR 이 만든 것 아님)
- **dirty 한 ContractRow 가 언마운트되면 가드 엔트리가 조용히 해제된다**(업체 검색어 입력으로
  `visibleRows` 에서 빠지는 경우 등). `useDirtyEntry` 의 cleanup `register(id, null)` 은 master 와 동일 —
  기존 결함이며 전역 가드 설계 차원의 별도 과제.
- `handleSave` 의 `if (!next.row) return;` 무음 반환(시트 row 없는 계약 — 사실상 도달 불가).
- 타입 인지형 ESLint(`no-floating-promises`) 부재 — Hashimoto 후속으로 규약을 린트에 박을 것.

## 6. 게이트

`bash scripts/check.sh` 초록 → 단독 PR → §6.8 배포 success + health 200.

`Changelog: 실무/수납에서 저장한 내용이 사라지지 않아요.`
