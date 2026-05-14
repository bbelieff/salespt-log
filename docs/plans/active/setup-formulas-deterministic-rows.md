> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 영업관리 데이터 행 식별을 "C 셀 숫자 휴리스틱" → 결정론적 공식 계산으로 교체. I~P 수식 누락 사고 방지.
> - **누가 읽나요**: 개발자 (수식복원 동작 이해)
> - **어떤 기능·작업과 연결?**: `lib/repo/setup-formulas.ts` (installFormulas / uninstallFormulas)
> - **읽고 나면 알 수 있는 것**: 왜 I행 일부 셀에 수식이 안 깔렸나? 결정론적 계산이 왜 안전한가?
> - **관련 문서**: `docs/plans/active/formulas-preserve-user-data.md`

# setup-formulas — 데이터 행 결정론적 계산

## 배경 (사용자 보고 2026-05-14)

> I행에서 각 채널별로 미팅예약기록이 되려면 각 셀마다 수식이 걸려있어야 하는데
> 그렇지가 않네. 확인하고 복원될 수식을 정비해줘. 기존에 작성된 내용이 있는
> 셀은 건드리지 않게 주의.

## 원인

`readDataRows` (이전 구현) 가 영업관리 C 컬럼을 읽어서 **"값이 숫자(날짜 serial)인
행"만** 데이터 행으로 인식:
```ts
if (typeof v === "number" && v > 0) dataRows.push(...)
```
→ C 셀이 비었거나 텍스트면 그 행은 데이터 행에서 누락 → `installFormulas` 가
I~P 수식을 안 깖. 수식복원 사고 + 버전복원 후 일부 C 셀 상태가 흐트러져
"각 채널별 미팅예약기록 셀에 수식 없음" 증상.

## 변경

### `lib/repo/setup-formulas.ts`

`readDataRows` (async, 시트 read, 휴리스틱) → `computeDataRows` (sync, 결정론적):

```ts
// row = blockStart(10) + (week-1)*blockStride(34) + dayIdx*4 + channelIdx
// 8주 × 7일 × 4채널 = 224 데이터 행
```

- **`sales.ts:salesRowFor` 가 쓰기에 쓰는 바로 그 공식** — 읽기/쓰기 좌표 일관성.
- C 셀 상태(빈 셀·텍스트·숫자)와 **무관**하게 224개 구조적 데이터 행을 항상 정확히 산출.
- 합계/헤더 행은 공식상 절대 포함 안 됨 (각 34행 블록의 28행만 데이터).
- 시트 read 0회 — installFormulas/uninstallFormulas API 호출 1회 감소.

`installFormulas` / `uninstallFormulas` 호출부 `await readDataRows(spreadsheetId)`
→ `computeDataRows()` 로 교체.

## 사용자 데이터 보존 — 그대로 유지

PR #186 의 `isSafeToOverwrite` 가드는 손대지 않음. computeDataRows 가 데이터 행을
**더 많이** 찾아도, 각 셀은 여전히 셀별 pre-read → raw 값 있으면 skip. 즉:
- 빈 데이터행 I 셀 → 수식 깔림 (이번 fix 의 목적)
- raw 값 있는 I 셀 → 보존 (PR #186 가드)

## 테스트

`tests/repo/setup-formulas-rows.test.ts` — 9 케이스:
- 224행 (8×7×4), 첫 행 10, 마지막 275, 2주차 시작 44 (stride)
- 중복 없음, 오름차순, 합계행(38·43·72·77) 미포함, 범위(10~275) 내

## 검증

- [x] `bash scripts/check.sh` 통과 (51 unit test green)
- [ ] 사용자 라이브: 수식복원 후 모든 (날짜,채널) I 셀에 수식 — 단 raw 값 셀은 보존
