---
slug: contact-meeting-count-derive
status: active
created: 2026-06-05
owner: belie
related: 0010-meeting-reservation-derived, fix-crosstab-channel-sync
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅예약 수(H)와 미팅 카드 수 드리프트를 "H=카드수 파생" 구조로 제거. 본 PR=읽기 파생+저장 재계산 핵심, 후속 PR=즉시동기화·일괄정정·테스트.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/contact.ts`, (후속)`lib/repo/sales.ts·meetings.ts`, 컨택탭·대시보드
> - **관련 문서**: [[docs/decisions/0010-meeting-reservation-derived]]

# 미팅예약 수 = 카드 수 파생 (드리프트 제거)

## 원인
H(영업관리)를 독립 카운터로 ±1 누적/직접입력 → 카드 추가·삭제·cascade 경로마다 갱신 제각각 → 누적 드리프트(5/18 H=2 vs 카드 7).

## 이번 PR (핵심 — 자가교정, 저위험)
- **[1] loadDay**: 채널별 `meetingReservation` = 그 예약일 미팅 카드 수 파생(시트 H 무시) → 컨택탭 read 시 항상 일치(드리프트 자동 교정).
- **[2] saveContactMetrics**: 저장 시 클라이언트값 무시, `findByDate(date,"reservation")` 카드 수로 H 재계산 기록 → 저장마다 시트 H = 카드 수. registerNewSlot 은 appendMeeting 후 호출되어 새 카드 포함.
- **[5] page**: loadDay 파생값으로 초기화 + 기존 step/setVal 가드(contactProgress≥카드수)로 표시 동기화 — 별도 코드 변경 없이 일관(서버가 진실 강제).
- ADR-0010 기록.

## 후속 PR (별도 — 권장)
- **[3]** append/remove 가 저장 미경유 시 즉시 H 동기화(`decrementMeetingReservation` ±1 → COUNT 재계산 set, append 시도 동일). 현재는 다음 저장 시 [2]가 교정.
- **[4]** 대시보드 퍼널(readWeekFunnel, H 합산) — [2] 후 자동 정합. 검증만.
- **[6]** 관리자 진단(`sheet-diagnostics` / `diagnose-sheet·fix-sheet`)에 "H vs 카드수 불일치 감지→COUNT 정정" 추가 → 기존 5/18류 일괄 정정.
- 불변식 구조/단위 테스트(H==카드수).

## Acceptance Criteria (이번 PR)
- [ ] 컨택탭 어느 화면/저장 경로에서도 미팅예약 수치 == 카드 수(5/18 로드 시 자동 일치).
- [ ] 카드 추가/삭제 시 수치 정확 반영(loadDay 재조회 시).
- [ ] 저장 시 시트 H 가 카드 수로 기록됨.
- [ ] 비생산 경로(removeMeeting/patchMeeting) 회귀 0. §2.5 가드 위반 없음(H=값 컬럼).
- [ ] `npm run check` 통과.

## Log
- 2026-06-05 [1] loadDay 파생 + [2] save 재계산 + ADR-0010. 후속(3/4/6/테스트) 별도 PR.
