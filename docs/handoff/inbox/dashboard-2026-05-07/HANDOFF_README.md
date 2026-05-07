# 📦 Dashboard 핸드오프 패키지 (claude.ai → Claude Code)

> **작성일**: 2026-05-07
> **From**: claude.ai (prototype 디자인)
> **To**: Claude Code (React 구현 + 시트 검증)
> **목적**: Dashboard 페이지 React 포팅을 위한 통합 패키지

---

## 📁 패키지 구성

| 파일 | 용도 | 누가 보나 |
|---|---|---|
| `dashboard-prototype.html` | UI 디자인 SSOT — 모든 시각 요소의 진실의 원천 | Claude Code (디자인 일치 시) |
| `DASHBOARD_DECISIONS_LOG.md` | 작업 중 누적된 모든 결정사항 기록 | Belief + Claude Code (의도 이해) |
| `DASHBOARD_DATA_DISCOVERY.md` | 시트 검증 체크리스트 | Claude Code (디스커버리 작업) |
| `HANDOFF_README.md` | 이 문서 | 시작점 |

---

## 🎯 작업 순서 (권장)

### Phase 1: 컨텍스트 파악
1. **`DASHBOARD_DECISIONS_LOG.md` 읽기**
   - 시트 구조 변경 (§1) — 영업관리 H열 "컨택성공" → "미팅예약"
   - 영업퍼널 6단계 재구성 (§2)
   - 모든 디자인 결정 (§4)
   - 헤더 SSOT 적용 사항 (§5)

2. **`dashboard-prototype.html` 시각 검토**
   - 브라우저에서 직접 열어 디자인 확인
   - 코드 안 주석으로 시트 매핑 / TODO 표시되어 있음

### Phase 2: 시트 디스커버리
3. **`DASHBOARD_DATA_DISCOVERY.md` 체크리스트 작업**
   - 각 항목별 실제 시트에서 검증
   - 결과를 [결과] 칸에 기록
   - 누락된 셀이나 추가 필요 데이터 식별

4. **디스커버리 결과 → SSOT 갱신**
   - `data-model.md` 갱신 (영업관리 H열 헤더 변경, 6단계 정의 추가, 사용자 식별 흐름)
   - `sheet-structure.md` 갱신 (실제 셀 위치 반영)
   - `components.md` 갱신 (대시보드 컴포넌트 등록 — 별도 §9 권장)
   - `tokens.md` 갱신 (brand-red 토큰 등록)

### Phase 3: React 포팅
5. **컴포넌트 구조 결정** (제안)
   ```
   app/(app)/dashboard/page.tsx       # 메인 페이지
   components/dashboard/
     ├── DashboardProgressBanner.tsx  # 메인 배너 (진행도 + 매출/비용)
     ├── FinanceSummaryBoxes.tsx      # 매출/비용 박스 (1:1 grid)
     ├── OperatingProfitCard.tsx      # 영업이익 카드
     ├── FunnelChart.tsx              # 6단계 영업퍼널 SVG
     ├── ProductivityIndicators.tsx   # 생산성 지표 4개 (indigo gradient)
     ├── WeeklyDualChart.tsx          # 8주차 듀얼 차트
     └── ChannelCostDonut.tsx         # 채널별 비용 도넛 + 콜지기소
   ```

6. **데이터 fetch 전략**
   - 서버 컴포넌트로 시트 데이터 fetch (RSC)
   - useMe()는 헤더에서 이미 사용 중 — 그대로 활용
   - 대시보드 전용 데이터: `useDashboardData()` 훅 (캐시 5분 권장)

7. **SVG 차트는 prototype 좌표 그대로 활용**
   - 6단계 funnel SVG: viewBox 0 0 358 250, 모든 좌표 prototype과 일치
   - 8주차 듀얼 차트: viewBox 0 0 358 200
   - 도넛: viewBox 0 0 358 165
   - **prototype HTML의 SVG를 그대로 React 컴포넌트로 변환** (좌표는 props 화)

### Phase 4: Git Commit
8. PR 단위 권장:
   - PR 1: SSOT 문서 갱신 (`data-model.md`, `sheet-structure.md`, `components.md`, `tokens.md`)
   - PR 2: 헤더 컴포넌트 (이미 Belief가 작업 중 — 본 패키지의 헤더 SSOT 적용 검증만)
   - PR 3: Dashboard 페이지 + 컴포넌트들 (PR 1 머지 후)

---

## 🔑 핵심 결정사항 (요약)

### 시트 변경 (이미 적용됨)
- ✅ 영업관리 H열 헤더: "컨택성공" → "미팅예약"

### 명칭/구조 (SSOT 갱신 필요)
- 영업퍼널 5단계 → 6단계: 생산 → **유입(NEW)** → 컨택진행 → **미팅예약(개명)** → **미팅완료(분리)** → 계약
- 미팅예약 = 모든 미팅 약속 (예약+계약+완료+변경+취소)
- 미팅완료 = 실제 진행 미팅 (완료+계약)

### 헤더 SSOT
- D-day = 종강총회일 (`courseStart + 57d`) — ⚠️ 헤더 SSOT v1의 `+50d`는 정정됨
- 라벨 prefix 금지 ("D-N"만)
- 대시보드 버튼: 흰 배경 + brand red 글자/테두리

### 날짜 SSOT
- `courseStart` = `01 영업관리!N1` (수강시작일)
- **헤더 D-day**는 `N1 + 57d` 동적 계산 (Belief 검증 — 6기 4/10 → 6/6 = 57일)
- 수료일/진행률 등 다른 표시는 시트 셀 fetch 또는 동적 계산 모두 가능

### 🚨 헤더 SSOT 핸드오프 v1 정정 사항 (Belief 작업 필요)
v1 문서의 6기 예시에 **세 가지 오류 + 한 가지 누락**:
- ❌ 시작일 `4/17` → ✅ **`4/10`**
- ❌ 종강총회 공식 `+50d` → ✅ **`+57d`**
- ❌ 수료일 `+55d (목)` → ✅ **`+57d (= 종강총회와 같은 날)`**
- ⚠️ 주차 계산 로직 미명시 → 추가 필요: **주차 = 금~목, `currentWeek = floor((today − N1) / 7) + 1`**

검증: `4/10 + 57d = 6/6` (4월 잔여 20d + 5월 31d + 6월 6d = 57일 ✓)
→ 종강총회 = 수료일 = **6/6 같은 날** (Belief 확정)

**6기 주차 검증 표** (주차 = 금~목):
| 주차 | 시작 (금) | 끝 (목) |
|---|---|---|
| 1주차 | 4/10 | 4/16 |
| 4주차 | 5/1  | 5/7  |
| 8주차 | 5/29 | 6/4  |
| 종강총회: 6/6 (토)        |

**권장**: Belief가 Claude Code에서 헤더 SSOT v2 작성 후 React 포팅 단계에서 사용

### 더미값 (시트 검증 필요)
- 6단계 합계: 360/282/242/110/91/23
- 채널별 비용: 280만/120만/80만 (콜지기소는 0)
- 콜지기소 수임비 별도: ₩2,100,000
- 8주차 활동량/영업이익: 8 + 8 = 16 datapoints

---

## ⚠️ 주의 사항

### 디자인 일치
- prototype HTML의 색상, 폰트 크기, 간격은 **전부 의도적 결정**
- 임의로 변경하지 말고, 변경 필요 시 Belief 통해 claude.ai에 피드백
- Tailwind arbitrary value (`text-[15px]` 등)는 토큰화 후 사용

### 디스커버리 우선
- 시트에 데이터가 없거나 위치가 다르면 **임의로 추가하지 말고 Belief에게 확인**
- 24 cells (6단계 × 4채널) 같은 큰 데이터는 시트 구조 변경이 필요할 수 있음 → Belief 결정

### 메인 배너 sticky 적층
- 헤더 (h-12, top-0) + 페이지 배너 (h-12, top-12) + 메인 배너 (top-24)
- 자식 sticky 각각 금지 — 부모에 묶기 패턴 (drift 방지) — 이건 헤더 SSOT 명시
- 메인 배너도 같은 패턴이어야 부드럽게 작동

### 대시보드 자체 헤더
- 헤더 SSOT: "대시보드는 TopHeader 미사용·자체 헤더"
- 그러나 자체 헤더 사양은 **미정**
- prototype은 5탭 헤더 디자인을 차용 중 — Claude Code가 사용자와 함께 결정 필요
- `DASHBOARD_DATA_DISCOVERY.md` §10 참조

---

## 📞 Belief에게 (사용자)

### Claude Code에 전달할 때

이 패키지를 Claude Code에 가져갈 때 다음과 같이 전달하시면 됩니다:

> "Dashboard 페이지 React 포팅 작업을 시작하려고 해. 4개 파일이 있는 패키지야:
> 1. `HANDOFF_README.md` — 이 문서부터 읽어줘
> 2. `DASHBOARD_DECISIONS_LOG.md` — 작업 중 결정한 사항들
> 3. `DASHBOARD_DATA_DISCOVERY.md` — 시트 검증 체크리스트
> 4. `dashboard-prototype.html` — 디자인 SSOT
>
> README의 작업 순서대로 진행하되, Phase 2 (시트 디스커버리) 결과를 먼저 보고해줘. SSOT 갱신과 React 포팅은 그 후에."

### 디스커버리 결과 받으면

Claude Code가 시트 검증 결과를 보고하면, 그 결과를 다시 claude.ai로 가져오세요. 다음 작업:
- 시트 구조와 prototype 가정 사이의 불일치 발견 시 prototype 조정
- 새로 발견된 데이터 항목을 prototype에 추가
- 최종 prototype 다시 핸드오프 → React 포팅 진행

---

## 변경 이력

| 일자 | 내용 |
|---|---|
| 2026-05-07 | 최초 핸드오프 — Dashboard 페이지 + 헤더 SSOT 적용 |
