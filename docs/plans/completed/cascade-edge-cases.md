---
status: completed
slug: cascade-edge-cases
created: 2026-05-18
completed: 2026-05-18
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅예약 → 미팅 → 계약 3단계 부모-자식 lifecycle 의 모든 transition 정의 + 누락된 엣지케이스 catalog
> - **누가 읽나요**: 개발자 + PM (사용자 review)
> - **읽고 나면 알 수 있는 것**: 어떤 액션이 어떤 다운스트림에 cascade 되는지, 무엇이 미구현인지

# cascade-edge-cases

## 1. Entity 모델

```
L1 미팅예약 (Reservation)
 │   = 영업관리 채널×날짜 H 컬럼 카운터
 │   = 컨택탭 4지표 입력의 "미팅예약" metric
 │
 └─ L2 미팅 (Meeting)
     │   = 04 업체관리 row
     │   = 일정탭 미팅카드, 컨택탭 펼침 영역 카드 (같은 entity 두 view)
     │   = 상태: 예약 / 완료 / 취소 / 계약 / 변경
     │
     └─ L3 계약 (Contract)
         = 02 계약수납관리 row
         = 수납탭 계약카드
         (L2 상태=계약 일 때만 1개 존재)
```

**Cardinality**:
- L1 1개 = L2 N개 (한 날 한 채널에 미팅 여러 개 가능)
- L2 1개 = L3 0 or 1개 (계약 결과인 미팅만 L3 보유)

## 2. 사용자 정책 (2026-05-18 확정)

| 방향 | 규칙 |
|---|---|
| **부모 삭제 → 자식** | cascade 자동 삭제 |
| **자식 삭제 → 부모** | 부모 entity 유지, **metric/state 만 일관성 update** |

부모 entity 유지 ≠ metric 변경 금지:
- L2 삭제 시 L1 entity (컨택탭 카드) 자체는 사라지지 않음
- 단 L1 H 카운트는 -1 (자식 1개 사라진 사실 반영)

## 3. State Transition Matrix

### 3.1 Create (생성)

| ID | 액션 | 효과 | 현재 구현 |
|---|---|---|---|
| C1 | 컨택탭 H +1 | L1 카운터 +1, L2 row 1개 append (빈 슬롯) | ✅ |
| C2 | 일정탭 미팅카드 채우기 | L2 row 의 업체명·일정 등 채워짐 | ✅ |
| C3 | 일정탭 미팅 결과 = "계약" | L2.J=계약, L3 row append (fan-out) | ✅ PR #190 |
| C4 | 수납탭 계약카드 직접 추가 | L3 row append (부모 L2 없이) | ⚠️ 가능 — 정책 미정 |

### 3.2 Update (상태 변경)

| ID | 액션 | 효과 | 현재 구현 |
|---|---|---|---|
| U1 | 미팅 결과 "예약" → "계약" | L2.J=계약, L3 append | ✅ |
| U2 | 미팅 결과 "계약" → "예약" (되돌리기) | L2.J=예약, **L3 cascade 삭제** | ✅ PR #209 (revertMeeting) |
| U3 | 미팅 결과 "예약" → "완료/취소" | L2.J 갱신, L3 변동 없음 | ✅ |
| U4 | 미팅 결과 "계약" → "완료/취소" | L2.J 갱신, **L3 cascade 삭제?** | ❓ 미정의 |
| U5 | 미팅 결과 "계약" → "변경" | L2.J=변경, 새 자식 미팅 append, **L3 cascade 삭제?** | ❓ 미정의 |
| U6 | L3 (수임비/계약조건) 수정 | L2 변동 없음 | ✅ |
| U7 | L2 업체명/일정 수정 (계약 있는 상태) | L3 의 표시 라인도 갱신? | ❓ 미정의 |

### 3.3 Delete (삭제) — **사용자 핵심 관심사**

| ID | 액션 | 사용자 정책상 효과 | 현재 구현 | Gap |
|---|---|---|---|---|
| D1 | **컨택탭 미팅 row 1개 삭제** | L2 clear + **L3 cascade 삭제** + L1 -1 | L2 clear + L1 -1 only | ❌ **L3 cascade 누락** |
| D2 | **일정탭 미팅카드 삭제** | L2 clear + **L3 cascade 삭제** + L1 -1 | UI 존재 여부 확인 필요 | ❌ 통합 cascade 없음 |
| D3 | **수납탭 계약카드 삭제** | L3 clear + L2.J=계약→예약 + L1/L2 entity 유지 | L3 clear + L2 revert | ✅ PR #211 |
| D4 | 컨택탭 H -1 (수치만 감소, row 삭제 없이) | 의미적으로 L2 1개 삭제와 동일? | metric -1 만 | ⚠️ 정책 미정 |

### 3.4 사용자 경고 팝업 (cascade preview)

사용자 명시 요구: "삭제시에는 팝업으로 알림을 해줘서 이걸 지우는 결과가 뭔지 알려줘야지"

| 액션 | 팝업 내용 |
|---|---|
| D1 (컨택) | "X 업체 미팅을 삭제합니다. 함께 삭제: ① 일정탭 미팅카드 / ② 수납탭 계약카드 (수임비 ₩N, 있으면) / 영업관리 H -1" |
| D2 (일정) | 동일 |
| D3 (수납) | "X 업체 계약 (₩N) 을 삭제합니다. 함께 변경: 일정탭 미팅 결과 = '계약' → '예약' 되돌림" (이미 #211 모달 있음) |

## 4. 누락 케이스 catalog (구현 필요)

### 4.1 D1/D2 (미팅 삭제) cascade 강화 — **최우선**
- [ ] `removeMeeting` service 가 L3 cascade 까지 처리
  - 흐름: ① L2 의 (미팅날짜, 업체명) 읽기 → ② L3 매칭 row 찾기 → ③ L3 clear → ④ L2 clear
  - `removeContractPaymentWithCascade` 의 역방향 패턴
- [ ] 컨택탭/일정탭 삭제 UI 가 cascade 모달 → 영향 미리보기 → 확인 시 실행
- [ ] L1 -1 은 그대로 유지 (사용자 정책상 metric 일관성)

### 4.2 U4/U5 (미팅 결과 변경 시 L3 처리)
- [ ] "계약" → "완료/취소/변경" 시 L3 자동 삭제 (cascade)
- [ ] "변경" 시 새 자식 미팅 append 는 기존 로직 유지, L3 만 cascade

### 4.3 U7 (L2 업체명/일정 수정 시 L3 sync)
- [ ] L3 의 link key (계약일, 업체명) 가 L2 와 불일치하면 데이터 깨짐
- [ ] L2 수정 시 L3 의 동일 필드도 동기화 (또는 L2 수정 차단 — 정책 결정 필요)

### 4.4 D4 (컨택탭 H 직접 -1) 정책
- [ ] 컨택탭에서 H 카운터만 직접 -1 가능한 UI 있나?
- [ ] 있다면: L2/L3 중 어느 row 를 삭제할지 모호 → 차단 또는 "어떤 미팅 삭제?" 선택 UI
- [ ] 없으면 (UI 가 row 단위 삭제만 허용) → 본 케이스 무시

### 4.5 C4 (수납탭 계약카드 직접 추가) 정책
- [ ] 부모 미팅 없이 계약만 추가 가능한가? 가능하면 데이터 모델상 orphan L3
- [ ] orphan L3 허용 vs 차단 결정 필요

## 5. 구현 plan (확정 후 단계별 PR)

1. **D1/D2 cascade fix** (1-2 PR)
   - `removeMeetingWithCascade` service 신규 (mirror of `removeContractPaymentWithCascade`)
   - 컨택탭/일정탭 삭제 UI 가 새 service 호출 + cascade 모달
   
2. **U4/U5 cascade fix** (1 PR)
   - `updateMeeting` 시 J="계약"→"非계약" transition 감지 → L3 cascade clear
   
3. **사용자 경고 팝업 통합** (1 PR)
   - `CrossTabCascadeModal` 컴포넌트 — 영향 미리보기 + 확인
   - 모든 삭제 액션이 일관된 UX

4. **U7 (L2 수정 sync) — Phase 2** (별도 논의)
   - 정책 결정 필요 후 구현

## 6. 사용자 정책 확정 (2026-05-18)

| Q | 결정 |
|---|---|
| Q1 미팅 삭제 시 L1 카운트 | **-1 한다** (PR #230 동작 유지) |
| Q2 컨택탭 미팅예약 직접 -1 | **"어떤 미팅 지울지" 선택 팝업** |
| Q3 수납탭 계약 직접 추가 | **차단** (반드시 미팅→결과=계약 경로) |
| Q4 미팅 결과 계약→취소/완료/변경 | **L3 자동 cascade 삭제** |
| Q5 L2 업체명/날짜 수정 | **L3 자동 sync** |
| Q6 삭제 confirm UX | **친절한 confirm() — "함께 사라지는 것들" 명시** |
|   |  예) "Y 업체 미팅 삭제? 일정탭 미팅카드 1건, 수납탭 계약카드 1건 함께 사라집니다" |

추가 핵심 인사이트 (사용자):
> "엣지케이스는 컨택+일정+수납 3개 탭에 카드가 다 있을 때 주로 발생"
> → 테스트는 3 카드 모두 연결된 시나리오에 집중

## 7. 구현 Phase plan

### Phase 1 — 미팅 삭제 cascade 강화 (최우선)
- `removeMeetingWithCascade` service 신규
  - L2 의 (미팅날짜, 업체명) 매칭 L3 찾기 → L3 clear → L2 clear
- 컨택탭/일정탭 미팅 삭제 UI 가 새 service 호출
- 친절한 confirm: "X 업체 미팅 삭제? 일정탭 카드 1건, 수납탭 계약카드 N건 함께 사라집니다"
- L1 -1 은 그대로

### Phase 2 — 미팅 결과 변경 cascade
- `updateMeeting` 시 J="계약" → "취소/완료/변경" transition 감지
- 변경 시 매칭 L3 자동 clear
- 사용자에게 confirm: "계약 → 취소로 변경하면 수납탭 계약카드 1건 사라집니다. 진행?"

### Phase 3 — L2 수정 시 L3 sync
- `updateMeeting` 시 업체명/미팅날짜 변경 감지
- 변경 시 매칭 L3 의 동일 필드도 update (기존 L3 row 유지, 필드만 sync)
- silent sync (별도 confirm X) — 사용자 의도가 명확하므로

### Phase 4 — 컨택탭 미팅예약 직접 -1 선택 팝업
- stepper − 버튼 누르면 "어떤 미팅 지울지" 카드 list 모달
- 선택한 미팅을 Phase 1 의 cascade service 로 삭제
- 또는 stepper - 자체 차단 + "펼침 영역에서 X 버튼 사용하세요" 안내

### Phase 5 — 수납탭 계약카드 직접 추가 차단
- 수납탭의 "추가" 버튼 (있다면) 제거 또는 비활성
- 안내: "계약은 일정탭에서 미팅 결과를 '계약' 으로 설정해야 만들어집니다"
