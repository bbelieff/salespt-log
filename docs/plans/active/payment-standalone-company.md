> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납에서 일정·계약(미팅) 기록 없이 계약 업체를 바로 추가하는 「영업기록 없이 업체추가」 기능의 계획·결정·검증 기록.
> - **누가 읽나요**: 개발자, PM(belie)
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_components/StandaloneCompanyAdd.tsx`, `POST /api/contract-payment/standalone`, `lib/service/contract-payment-add.ts#addStandaloneContract`, `lib/util/contract-link.ts`
> - **읽고 나면 알 수 있는 것**: 매출이 이월/이번 과정 중 어디로 잡히는지 · 재시도해도 업체가 두 번 생기지 않는 이유 · `manual:` 링크를 미팅으로 오인하지 않게 막은 곳
> - **관련 문서**: `docs/plans/active/arena-start-revenue-split.md`(이전 계약 직접등록 §A), `docs/design/components.md`(PC 실무/수납 워크스페이스), `docs/plans/active/db-write-flip.md` §6 R3-3(append 재시도 원칙)

# 실무/수납 — 영업기록 없이 업체추가 (PR-2)

상태: active · 작성 2026-09-28

## 목표 (belie 요청)
- 실무/수납 **업체 모드**(PC·모바일)에서 업체/진행기관 토글과 첫 업체 사이에 점선 1줄 버튼 「＋ 영업기록 없이 업체추가」.
- 누르면 제자리 인라인 폼: 업체명(필수) · 계약일(기본 오늘 KST) · 수임비(원, 0 이상, 천단위 콤마) · 안내 「계약일이 수강 시작일보다 앞이면 이월로, 이후면 이번 과정 매출로 잡혀요.」 · 취소/추가.
- 성공 → 목록 재조회 → 폼 닫힘 → 새 업체 선택(PC) / 펼침(모바일) — 바로 업체정보를 채울 수 있게.
- 계약이 하나도 없을 때(빈 안내)에도 표시. 진행기관 모드에서는 숨김.

## 결정
1. **이월 강제 안 함** (belie 결정) — `addPriorContract` 와 달리 carryover 를 넘기지 않는다. 매출 귀속은 읽기 시점 규칙 `isCarryoverContract`(깃발 OR 계약일 < 수강시작일)가 계약일로 가른다.
2. **멱등키 = AK `manual:<requestKey>`** — 클라이언트가 폼을 열 때 uuid 를 1개 만들어 재시도에도 같게 보낸다. `appendFromContract` 의 meetingId 자연키 upsert(BBE-53)를 그대로 타서 같은 키면 같은 행을 갱신한다. `dateCompanyFallback` 은 쓰지 않는다(같은 날짜·이름의 무관한 정식 계약행 덮어쓰기 방지).
3. **시트 쓰기 뒤 throw 금지**(#558) — 서비스는 append 뒤 아무 것도 하지 않는다. DB 미러는 기존 R2 no-throw 경로.
4. **`manual:` = 연결 미팅 없음** — 순수 유틸 `lib/util/contract-link.ts`(`isManualContractLink`·`meetingIdFromLink`)로 모든 미팅 소비처를 거른다:
   - `editContractLinkedFields`: 02 행은 manual 키로 찾되 04 미팅 patch 는 건너뜀(가짜 조회·「04 반영 실패」 오표시 방지).
   - `removeContractPaymentWithCascade`: 행의 AK 를 읽어(옛 A:AJ 그리드면 실패→빈 값, 기존 동작) manual 이면 같은 날짜·이름의 계약 미팅을 예약으로 되돌리지 않는다.
   - `terminatedByChannel`/`terminatedByWeek`: manual 행은 raw(미팅 기준) 계약수에 없으므로 해지 차감에서도 제외.
   - 목록 재조회 union 백필(linkedMeetingId 2차 키)·`findRowByLink`(id 매칭)는 manual 값이 고유 키라 그대로 안전.
5. **권한** = prior 라우트와 동일(`getWritableUserEmail`, 임퍼스네이션 대상 시트에 쓰기). 세션 없으면 401. 별도 403 경로는 만들지 않았다(prior 에도 없음).
6. **요청경로 시트 가드** — 새 쓰기는 이미 화이트리스트된 `lib/repo/contract-payment.ts`(append-계열)만 탄다. 가드 항목 추가 불필요.
7. 목록·모바일 카드에 회색 `영업기록 없음` 배지 — `linkedMeetingId` 가 이미 클라이언트 타입에 있어 타입 확장 없음.

## 작업
- [x] `lib/util/contract-link.ts` + 소비처 가드(service contract-payment·termination-count, repo readContractCascadeKey AK)
- [x] `addStandaloneContract` (contract-payment-add.ts) + service index 재수출
- [x] `POST /api/contract-payment/standalone` (zod: 계약일 YYYY-MM-DD, 업체명 trim 1~100, 수임비 정수 ≥0, requestKey uuid)
- [x] `useAddStandaloneContract` 훅(재조회까지 대기) + `StandaloneCompanyAdd` 컴포넌트 + page.tsx 배선(PC 목록·모바일·빈 안내) + `ContractRow openSignal`
- [x] 테스트: 서비스·유틸·repo 멱등·라우트·컴포넌트
- [x] 리뷰 후속: `findRowByLink` 의 (계약일+업체명) 폴백이 `manual:` 행을 건너뜀 — 미팅 계약 되돌리기·삭제(clearRowByLink)·수임비 동기(syncFeeFromContract)·미팅 계약 병합(addFromContract 폴백)이 같은 날짜·이름의 수동 행을 지우거나 덮지 않는다(수동 행은 자기 `manual:<key>` 로만 찾힘)
- [x] 리뷰 후속: 삭제 cascade 의 AK 읽기를 C:D 읽기와 병렬화(요청 경로 직렬 시트 왕복 추가 없음)
- [x] 리뷰 후속: 모바일 펼침 신호 1회 소비(`onOpened` → openedRow null, PC 는 신호 안 켬) · 오류는 고정 쉬운 문구 · 취소 시 점선 버튼·성공 시 새 업체로 포커스

## 남은 위험
- 수동 추가 업체는 미팅이 없어 **계약 건수(미팅 기준 통계)에는 잡히지 않고 매출(02 기준)에만 잡힌다** — 의도된 비대칭이지만 대시보드 건수와 매출 합계가 1건 어긋나 보일 수 있다.
- 같은 날짜·이름으로 이미 미팅 계약이 있는 업체를 수동으로 또 추가하면 행이 2개가 된다(중복 경고 없음). 이후 그 미팅을 다시 계약 저장하면 id 매칭이 우선이라 수동 행과 합쳐지지 않는다.
- 업체정보(06)는 기존대로 (계약일+업체명) 키 — 같은 날짜·이름의 미팅이 있으면 그 미팅 업체정보도 함께 갱신된다(기존 동작).

## 되돌리기
- squash 커밋 1건 `git revert` — 이미 만든 수동 업체 행은 일반 계약행으로 남는다(AK `manual:` 값만 있음, 읽기·편집 정상).
