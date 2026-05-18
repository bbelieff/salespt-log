> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 수식복원 클릭이 사용자 raw 입력 데이터를 덮어쓰던 사고 → 셀별 pre-read + skip 안전 가드 도입.
> - **누가 읽나요**: 개발자, 마스터 (사고 대응 + 정책)
> - **어떤 기능·작업과 연결?**: `lib/repo/setup-formulas.ts`, `app/api/admin/install-formulas-bulk/route.ts`, `components/auth/InstallFormulasButton.tsx`
> - **읽고 나면 알 수 있는 것**: 왜 사고 났는가? 어떻게 같은 사고 재발 차단?
> - **관련 문서**: `docs/domains/sheet-structure.md`

# Formulas install — user data 보존 안전 가드

## 사고 (2026-05-14 KST 약 11시)

마스터가 `🛠️ 수식 복원` 버튼 클릭 → 옛 기수 (4기 등) 영업관리 I/J/K/L/N/O 컬럼에 admin 이 **수동 백필했던 데이터** 가 수식으로 덮어써짐 → 화면에서 값 사라짐.

복구: 각 수강생 시트 `파일 → 버전 기록` 으로 수식복원 직전 버전 복원 가능 (Google Sheets revision history).

## 원인

`installFormulas` v1 은 다음 가정으로 무조건 덮어씀:
- 04 업체관리 N/O/Q = 자동 수식 컬럼, 사용자 입력 없음
- 01 영업관리 I~P = 자동 수식 컬럼, 사용자 입력 없음

가정이 깨진 케이스:
- 옛 기수 (앱 도입 전) 의 데이터는 admin 이 직접 시트에 raw text/숫자 로 백필
- 신규 수강생은 앱이 04 업체관리에 미팅 추가 → 영업관리 I~P 수식이 자동 집계
- 둘이 섞인 시트에 수식복원 호출 → admin 백필 데이터 손실

## v2 안전 가드 (이 PR)

### `lib/repo/setup-formulas.ts`

1. **타겟 범위 pre-read** (`valueRenderOption: "FORMULA"`):
   - 04 업체관리 N/O/Q 전체 (1~1000행)
   - 01 영업관리 I~P 데이터 행만
2. **셀별 `isSafeToOverwrite` 검사**:
   - `undefined`/`null`/`""` → safe (빈 셀)
   - `"=..."` (수식 문자열) → safe (옛 수식 → 새 수식 교체)
   - 그 외 (raw text, number, boolean) → **unsafe → skip + preservedCells 에 누적**
3. **batchUpdate 는 safe 셀만**.
4. **`InstallReport`** 에 `preserved`, `preservedCells[]` 필드 추가.

### `app/api/admin/install-formulas-bulk/route.ts`

- `SuccessItem` 에 `preserved`/`preservedCells` 추가, 클라이언트로 전송 (cell list 최대 50 개).

### `components/auth/InstallFormulasButton.tsx`

- confirm 다이얼로그: "사용자 raw 입력값 자동 보존됩니다" 명시.
- 결과 alert: 보존된 셀이 있으면 시트별로 `⚠️ raw 입력 보존된 시트 N개` 섹션 표시 + 셀 ref 5개까지 sample 표시.

## 테스트

`tests/repo/setup-formulas-guard.test.ts` — 13 케이스:
- safe: undefined, null, "", "=...", "=", "=#REF!"
- unsafe: 일반 text, number, 0, 한글, apostrophe-prefixed, boolean, 공백

## Hashimoto note

CLAUDE.md §0 원칙: "같은 실수를 두 번 안 하게 환경을 고친다." 이 사고는 첫 발생이지만 데이터 손실 위험이 너무 커서 **즉시 가드 + unit test** 로 박제. 향후 자동화 작업 (특히 batchUpdate · clear) 추가 시 같은 패턴 (pre-read 후 user content 보존) 적용 필요.

## 검증

- [x] `bash scripts/check.sh` 통과 (13 새 unit test 포함)
- [ ] 사용자 사고 시트 복구 완료 확인
- [ ] 사용자 라이브: 수식복원 재실행 시 보존 셀 alert 표시
