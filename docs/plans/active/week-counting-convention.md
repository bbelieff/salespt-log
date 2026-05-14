> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 종강총회 offset(55/57/50 혼재) 을 ADR-0005 로 박제하고 코드/문서 통일.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/me.ts`, `lib/repo/sales.ts`, `docs/decisions/0005-*`, `docs/domains/data-model.md`, `docs/domains/api-spec.md`, `CLAUDE.md`
> - **읽고 나면 알 수 있는 것**: 왜 숫자가 통일됐나? 6기/7기 차이는?
> - **관련 문서**: `docs/decisions/0005-week-counting-convention.md`

# 주차 카운팅 컨벤션 통일

## 배경

사용자: "중요한 지침을 바꿔야 해. 자꾸 변경되는것같은데 다시 깨달았어."

코드베이스에 종강총회 offset 이 55(CLAUDE.md/api-spec) / 57(me.ts/sales.ts/data-model)
/ 50(실 운영) 세 값 혼재. 6기·7기 운영 방식 차이를 코드/문서가 반영 못 함.

사용자 실측: 6기 O1=4/10 → 종강 6/6 (+57), 7기 O1=5/15 → 종강 7/4 (+50).

## 변경

### `docs/decisions/0005-week-counting-convention.md` (신규 ADR)
- 7기+ 현행: O1 = 1주차 강의시작일(금), 종강총회 = O1+50.
- 6기 legacy: O1 = ~1주 앞, 종강총회 = O1+57. 보존만, 건드리지 않음.
- weekIndexOf/salesRowFor 코드 불변 — 차이는 O1 값으로 흡수.
- 편집유예(+69) 는 out of scope 명시.

### 코드
- `lib/service/me.ts`: `GRADUATION_OFFSET_DAYS` 57 → **50** (fixture 전용, production 은 O2 직접 읽음).
- `tests/service/me.test.ts`: 6기 fixture(+57) → 7기 fixture(O1=5/15 → 7/4, +50).
- `lib/repo/sales.ts`: `readGraduation` 주석 `=O1+57` → 7기+ `=O1+50` / 6기 legacy 명시.

### 문서
- `docs/domains/data-model.md`: O2 수식 설명 + courseStart fixture → 7기 기준.
- `docs/domains/api-spec.md`: endDate 설명 갱신 (O2 직접값, ADR-0005).
- `CLAUDE.md` §2.5: "+55일" → 종강총회 = O1+50 (7기+), ADR-0005 SSOT 링크.

## 후속 (이 PR 범위 밖)

- `docs/playbooks/setup-sheets.md` 의 O2 수식 안내 갱신 — PR #191 이 해당 파일 전면
  개정 중이므로 #191 머지 후 별도 반영.
- 편집유예 마감일(+69) 7기+ 재조정 — 사용자 재정의 시 ADR-0005 supersede 또는 별도 ADR.

## 검증

- [x] `bash scripts/check.sh` 통과 (42 unit test green)
- [ ] 사용자: 7기 시트 O2 = `=O1+50` 인지 확인 (이미 `=O1+57` 이면 수동 수정)
