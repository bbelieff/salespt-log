> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 미팅예약 수(영업관리 H)는 독립 카운터가 아니라 **업체관리 미팅 카드 수에서 파생**한다. 불변식 `H(채널,예약일) == COUNT(업체관리 rows where 예약일 & channel)`.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `lib/service/contact.ts`(loadDay·saveContactMetrics), `lib/repo/sales.ts`(H 쓰기), `lib/repo/meetings.ts`, 컨택탭·대시보드 퍼널
> - **읽고 나면 알 수 있는 것**: H 드리프트 사고 원인, 파생 구조, 단일 진실원천
> - **관련 문서**: `docs/decisions/0005-week-counting-convention.md`, `docs/plans/active/contact-meeting-count-derive.md`

- **Status**: accepted
- **Date**: 2026-06-05
- **Supersedes**: 없음

# ADR-0010 — 미팅예약 수 = 업체관리 카드 수 파생

## 맥락 (문제)
미팅예약 수(영업관리 `H` 컬럼)와 업체관리 미팅 카드 수가 **드리프트**하는 사고 반복(예: 연습기 5/18 H=2인데 카드 7건). 원인: H 를 **독립 카운터**로 취급해 클라이언트가 ±1 누적/직접 입력하고, 카드 추가·삭제·cascade·reschedule 경로마다 H 갱신이 제각각이라 누적 오차 발생.

## 결정
**미팅예약 수의 단일 진실원천(SSOT) = 업체관리(미팅 카드 행).** H 는 파생값이다.

불변식:
```
H(channel, 예약일) == COUNT(업체관리 rows where 예약일=그날 AND channel=그채널)
```

- **읽기(`loadDay`)**: 채널별 `meetingReservation` 을 시트 H 가 아니라 그 예약일 미팅 카드 수로 채운다 → read 시점에 드리프트 자동 교정.
- **쓰기(`saveContactMetrics`)**: 클라이언트가 보낸 `meetingReservation` 을 무시하고, 그 예약일·채널의 실제 카드 수로 재계산해 H 에 기록 → 저장 시마다 시트 H 가 카드 수와 일치.
- **대시보드 퍼널**(H 합산)은 H 가 카드 수와 같아지면 자동 정합.

## 후속(별도 PR)
- 미팅 추가/삭제(append/remove)가 저장을 거치지 않는 경우의 **즉시 H 동기화**(±1 누적 → COUNT 재계산으로 통일).
- **관리자 진단 일괄 정정**(`sheet-diagnostics`): 기존 데이터(5/18 등)의 H vs 카드수 불일치 감지 → COUNT 로 set.
- 불변식 단위/구조 테스트.

## 근거
- 카드(업체관리 행)는 실제 미팅의 원본 — 사라지지 않는 한 진실. 파생하면 "한쪽만 갱신"이 구조적으로 불가능.
- §2.5 일괄쓰기 보존 가드와 무관(H 는 사용자 데이터 값 컬럼, 수식 아님 — 일반 값 쓰기).
