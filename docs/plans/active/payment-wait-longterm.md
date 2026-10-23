> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 진행률 「조건 대기」(사유 + 단기/장기관리)와 업체 「진행 | 장기관리」(자동 이동 + 직접 지정 + 목록 칩)를 실무/수납에 넣는다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/types/contract.ts · lib/analytics/{contract-slots,payment-work-status,long-term,dashboard-follow-ups}.ts · lib/repo/{contract-payment-row,db/read-daily,db/contracts-clear}.ts · app/(app)/payment
> - **읽고 나면 알 수 있는 것**: 저장 모양(DB 정본·시트 열 없음) · 오늘 챙길 일 규칙 · 장기관리 판정 · 목록 칩 범위
> - **관련 문서**: [item-label-progress-halt](item-label-progress-halt.md) · docs/domains/data-model.md · docs/domains/sheet-structure.md §4 · docs/design/components.md

# 조건 대기 · 업체 장기관리 (feat/payment-wait-longterm)

## 요청 (belie 2026-10-23, 목업 [1]·[5] A안 승인 → 같은 날 [5] 정정)
- [5] 한 달 넘게 조건을 기다리는 진행 → 진행률에 「조건 대기」. 사유 한 줄 + 칩 「단기관리 (2개월 내)」/「장기관리 (3개월 이상)」.
  날짜 칩(2주/한 달/석 달 · 다시 볼 날)은 정정으로 뺐다.
- [1] 업체 상세 배너 「기본 너비」 옆 「진행 | 장기관리」 토글 + 정렬 칩 줄 끝 「장기관리 N」 칩. 진행건이 모두 끝나면 저절로 장기관리.

## 결정
- **저장**: 슬롯 `진행률`에 `"조건 대기"`(enum 확장) + 선택 필드 `대기사유`·`대기기간`("단기"|"장기", 없으면 단기).
  계약 선택 필드 `관리상태`("진행"|"장기관리", 없으면 자동)·`관리상태진행건`(직접 장기관리 때 진행 중이던 번호).
  전부 DB JSONB 정본. **시트 열 추가 없음** — 02 탭 A~AO 에 빈 정의 열이 없다. 시트 진행률은 조건 대기도 빈 칸(`sheetProgress`).
  운영 데이터 이전 없음(옛 기록은 필드가 없어 자동 판정).
- **진행건 끝남(`isSlotClosed`, 이름 유지)** = 수납완료 · 중도중지 · 조건 대기·장기관리. 조건 대기·단기관리는 수납액이 있어도 진행 중.
- **오늘 챙길 일**: 조건 대기·장기관리 진행건은 할 일·멈춤에서 빠진다. 단기관리는 세되 `deferred` 로 맨 뒤(`compareFollowUpUrgency`) + 이유 「조건 대기(단기관리)」.
  장기관리 업체는 통째로 빠진다(`followUpContracts`). 화면(DashboardFollowUps)은 손대지 않았다 — 정렬된 `items` 를 그대로 쓴다.
- **업체 장기관리(`lib/analytics/long-term.ts` 한 곳)**: 직접 「진행」 → 진행. 직접 「장기관리」 → 장기관리, 단 새 진행건이 진행 중이 되면 저절로 진행.
  지정 없음 → 진행건 ≥1 이고 진행 중(`slotKeepsCompanyActive`)인 것이 없으면 장기관리. 두 기본값 모두 belie 확정(2026-10-23).
- **평균 진행률**: 조건 대기는 진행 중(0%)으로 들어간다. 중도중지만 빠진다(기존).
- **목록 범위**: 칩 꺼짐 = 진행 업체만, 켜짐 = 장기관리 업체만. 업체 보기·기관 보기·검색 건수 모두 같은 범위(`scopedRows`), 기관 보기도 칩을 보여 준다.
  성과 요약(수수료·매출)·진행기관 후보·해지 보관함은 전체 그대로.
- **기간 칩 저장**: 진행률처럼 고르는 즉시 저장(ContractRow `typing` 판정에 `대기기간` 추가). 사유 글자는 칸을 떠날 때 저장.
- **토글 저장 경쟁**: 상세 카드 초안 저장은 `관리상태`를 최신 저장값으로 덮어 보낸다 — 오래된 초안이 토글을 되돌리지 않게.

## 할 일
- [x] 타입 · 미러 · DB 읽기/쓰기 화이트리스트
- [x] 규칙(contract-slots · payment-work-status · long-term · dashboard-follow-ups) + 테스트
- [x] 화면(ProgressWaitFields · LongTermToggle · 정렬 칩 · 목록 배지 · 배너 amber) + 테스트
- [x] SSOT(data-model · sheet-structure · components)
- [x] next build · 1280/375 화면 확인(합성 목업 서버 `PAYMENT_WAIT_PREVIEW=1`: 칩 이동·토글 저장·조건 대기 장기 → 자동 이동·오늘 챙길 일 맨 뒤)
- [ ] check.sh(커밋 훅) · PR(머지 안 함)

## 남은 것
- D-day 배지(`D?`)는 조건 대기 진행건도 그대로 보인다(업체 목록 정렬 규칙 미변경).
