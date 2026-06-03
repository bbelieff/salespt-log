---
slug: practice-payment-polish
status: active
created: 2026-06-03
owner: belie
related: practice-and-drive, 0007-drive-link-permission
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 탭 + 캘린더 사용성 폴리시 10건 (PostHog 행태분석 + 피드백). Scope 3 묶음의 UX 마감 작업.
> - **누가 읽나요**: 개발자, 에이전트
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/**`, `app/(app)/calendar/**`, `lib/repo/{drive-client,users,todos}.ts`, `app/api/drive-link/route.ts`
> - **읽고 나면 알 수 있는 것**: 10건 각각의 근본원인·수용기준·적용방식(직접/컨펌), 토큰/SSOT 영향
> - **관련 문서**: [[docs/plans/active/practice-and-drive]] (§7 Scope 3), `docs/decisions/0007-drive-link-permission.md`, [[docs/design/tokens]]

# 실무/수납 탭 + 캘린더 폴리시 10건

## Intent (왜)
PostHog 행태분석(수강생 흐름 관찰) + 사용성 피드백에서 도출. 기능은 동작하나 **개념 노출/문구/레이아웃**이 직관적이지 않아 수강생이 헤맴. Scope 3 통합 뷰 전 UX 마감.

## 적용 방식 구분
- **바로 적용 OK**: [1] [2] [3] [5] [8] [9] [10]
- **제안→컨펌 후 적용**: [4](투두 생성 UX 재설계) · [6](토스 카피 점검 표) · [7](카드 디자인 폴리시 최종안)

## 항목별 명세

### [1] Drive 폴더 연결 UX — "자동으로 찾기"
- 파일: `DriveLinkBar.tsx`, `app/api/drive-link/route.ts`, `lib/repo/drive-client.ts`, `lib/repo/users.ts`
- 근본원인: 현재 "부모 폴더 URL 입력" 방식 — 수강생이 "부모 폴더" 개념을 모름.
- 개선 A(우선): **[자동으로 찾기]** 버튼. 연동 스프레드시트의 부모 폴더를 `drive.files.get(fileId, fields:"parents")`로 구한 뒤 그 안에서 `findFolderByNamePrefix("01 피드백업체", parent)`로 자동 연결. `getFileParentId(fileId)` 신규 + `/api/drive-link {mode:"auto"}` 분기(URL 없이).
- 개선 B(수동 fallback): URL 칸은 "01 피드백업체 폴더 주소를 그대로 붙여넣어도 됨" — 폴더 URL이면 직접 사용, 상위 폴더면 그 안에서 탐색(둘 다 허용).
- 문구에서 "부모 폴더" 제거, 쉬운 말로.

### [2] 로드맵 메모 (바로 적용)
- 파일: `ContractRow.tsx` (~291–308)
- "📍 로드맵 메모 · 전체 수납기관 진행 로드맵 (시트 AE)" → **"(시트 AE)" 제거**.
- placeholder → "예: [1] 미소재단 후 [2] 대환으로 신용점수 올리고 [3] 신용보증재단 진행"

### [3] 진행기관 입력 = 구글시트 드롭다운형 콤보박스
- 파일: `PaymentSlotForm.tsx`, `lib/repo/todos.ts`(또는 02 진행기관 컬럼)
- 자유입력 + 과거 입력값 자동완성/드롭다운. 후보 = 그 수강생 기존 슬롯 진행기관값 + 05 institution_ref distinct. 신규 입력 시 목록 누적.

### [4] "진행기관 저장해야 투두 생성" UX 재설계 (제안→컨펌)
- 파일: `PaymentSlotForm.tsx`, `TodoFormModal.tsx`, `TodoSection.tsx`
- 컨셉(기관 확정 후 그 기관 투두 추가) 유지하되 "저장" 단계 의미를 분명히. 기관 선택([3]) → 그 자리에서 바로 투두 추가 가능하게. **UI안 제안 후 적용.**

### [5] 계약 후 프로세스 체크박스 1행 (바로 적용)
- 파일: `CheckboxList.tsx`
- 수집 항목 체크박스가 1 row에 담기도록 가로 wrap/축약 레이아웃.

### [6] 토스 UX 라이팅 점검 (제안→컨펌)
- 실무/수납 탭 전체 문구 토스 원칙 점검. 변경안 **표로 제시 → OK한 것만 반영**.

### [7] 전반 UI 완성도 폴리시 (제안→컨펌)
- 카드 여백·위계·정렬을 tokens.md 기준으로 다듬기. 과한 재작성 금지, 기존 구조 유지.

### [8] 캘린더 일 칸 크게 (바로 적용)
- 파일: `MonthGrid.tsx`, `calendar/page.tsx`
- 월간 셀 세로 확대 + 미팅 업체명 안 잘리게.

### [9] 캘린더 데스크탑 확대 + 탭 정렬 (바로 적용)
- 파일: `calendar/page.tsx`, `MonthGrid.tsx`
- 데스크탑에서 캘린더 폭↑(우측 패널 유지), 상단 탭 모여 보이게 정렬.

### [10] 실무(ToDo) 카드에 주제 표시 (바로 적용)
- 파일: `PaymentSlotForm.tsx` 또는 `TodoSection.tsx`
- 실무 카드 우측 여백에 주제 = 진행기관명(예: "미소재단") 표시.

## Acceptance Criteria
- [ ] [1] [자동으로 찾기] 1클릭으로 URL 없이 01 피드백업체 연결됨. 수동 URL은 폴더/상위 둘 다 허용. "부모 폴더" 문구 제거.
- [ ] [2] "(시트 AE)" 미노출 + 새 placeholder 적용.
- [ ] [3] 진행기관 입력 시 과거값 드롭다운 노출 + 자유입력 + 신규값 누적.
- [ ] [4] (컨펌된 안으로) 기관 선택→투두 추가 흐름이 직관적.
- [ ] [5] 체크박스가 한 줄(wrap)로 정리됨.
- [ ] [6] (컨펌된 카피만) 반영.
- [ ] [7] (컨펌된 폴리시만) 반영. 토큰 외 arbitrary value 0.
- [ ] [8] 월간 셀 커지고 업체명 안 잘림(모바일).
- [ ] [9] 데스크탑 캘린더 폭↑ + 탭 정렬.
- [ ] [10] 실무 카드에 진행기관명 표시.
- [ ] `npm run check` 통과(typecheck·lint·structural·test·500cap·doc-drift).
- [ ] 모바일+데스크탑 스크린샷(특히 1·5·8·9·10).

## 범위 밖
- 색 토큰·채널 4색 변경, 신규 기능, 데이터 모델 변경(02 불변·04 미팅 전용·05 스키마 유지).

## Log
- 2026-06-03 plan 작성. 바로적용 항목부터 구현 → [4][6][7] 제안.
