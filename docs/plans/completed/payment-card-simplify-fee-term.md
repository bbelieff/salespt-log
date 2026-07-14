---
slug: payment-card-simplify-fee-term
status: active
created: 2026-07-14
completed: 2026-07-14
owner: belie
related: contract-edit-linked-fields, 11-contract-payment-tab
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 계약 카드의 중복 정보 박스(고객사/계약일/수임비+수정)를 제거하고, UI 용어를 "수임비"로 통일.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie), 사용법 글 작성 세션(캡처 영향)
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/LinkedFieldsEditor.tsx`, ContractRow(헤더), 실무/수납 탭.
> - **읽고 나면 알 수 있는 것**: 왜 박스를 뺐나 / 수정 진입은 어디로 갔나 / 무엇을 안 건드렸나
> - **관련 문서**: docs/design/components.md(LinkedFieldsEditor), contract-edit-linked-fields

# 계약 카드 단순화 + 용어 "수임비" 통일 (belie 확정 2026-07-14)

## 1. 용어 통일 — UI 표시 레이어만
- 서비스에서 **수임료/수임비 혼용** → **"수임비"** 로 통일.
- 스코프 = **UI 표시 문자열만**(라벨·placeholder·도움말). 실측 결과 UI(.tsx)의 "수임료"는 `LinkedFieldsEditor` 한 곳뿐 → 라벨 `수임료 (원)`→`수임비 (원)`, 도움말 문구, 로컬 상태변수(`수임료`→`수임비`, 순수 로컬 — 데이터 무관) 정리. UI 잔여 0 확인.
- **무접촉(파서 영향 금지)**: 시트 헤더·수식·데이터 키(`ContractPayment.수임비` 필드명·02 E열·04 L열). **ADR-0026**("매출 = 수임료 + 수납액")은 §5 불변 원칙 → 수정 금지(문구 그대로 보존). service/repo 주석의 "수임료" 표현도 스코프 밖(무접촉).

## 2. 카드 정리 — 중복 박스 제거
- **문제**: 계약 카드 펼침 시 `LinkedFieldsEditor` 가 읽기 박스로 **고객사·계약일·수임비**를 다시 보여줬는데, 이는 **ContractRow 헤더**(업체명 + `계약일 · 수임비 ₩…`)와 **완전 중복**. 탭 복잡도만 증가.
- **수정**: 읽기 박스 **제거**. `LinkedFieldsEditor` 는 평소 **[✎ 계약정보 수정] 버튼만** 렌더(값 미표시). 클릭 시 기존 편집 폼(업체명·계약일·수임비 + 저장/취소 + 연동 배지)은 **그대로**.
- **정보는 한 곳에 한 번**: 값은 헤더에서만.

### 2.1 수정 진입 위치 — 자율 결정(reversible)
디스패치 제안은 "업체명 배너 옆". 실측 결과:
- ContractRow **헤더 전체가 `<button>`**(아코디언 토글) → 그 안에 `<button>` 중첩은 **HTML/a11y 위반**(nested interactive).
- `ContractRow.tsx` = **498줄 / 500줄 캡** → 헤더 재구조화 여력 없음.
→ **채택**: 수정 진입을 **펼침 본문 최상단 우측**(헤더 업체명 바로 아래, 카드 펼침 시에만 노출)에 컴팩트 버튼으로 배치. 디스패치의 "카드 펼침 시 노출" 의도 충족 + a11y·캡 안전. **Revert**: `git revert`(읽기 박스 복원).

## 3. 콘텐츠 영향 ⚠️
- **계약 카드 펼친 모습이 바뀜**(중복 박스 사라지고 [✎ 계약정보 수정] 버튼만) → **사용법 글/캡처 갱신 필요**. 게시글 작성 세션에 전파(worklog 기록).

## 4. 수용 기준
- UI 잔여 "수임료" 0. 편집 폼·저장 연동(02↔04↔06)·DirtyGuard 동작 불변. check.sh 초록. 브라우저 실검증(카드 펼침 렌더·수정 토글). §6.8 배포·health 200. SSOT(components.md) 갱신.

## Log
- 2026-07-14 구현(DevC): LinkedFieldsEditor 읽기박스 제거→[✎ 계약정보 수정] 트리거만, 용어 수임비 통일(UI+로컬변수), components.md SSOT 갱신. ContractRow 무변경(캡 498 보존). ADR-0026·시트 키·파서 무접촉.
