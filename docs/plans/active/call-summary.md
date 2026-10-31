---
slug: call-summary
status: active
created: 2026-10-31
worktree: ../_wt/salespt-log/call-summary-contract
---

# 통화 정리 — 녹음 올리기 → AI 정리 → 한 화면 확인 → 확정 저장

> 목적·읽는 대상: 통화 정리 기능을 PR 여러 개로 나눠 만드는 실행 계약. 개발 세션·belie.
> 관련: 0단계 검증 자료(개인 드라이브 `개발관제/70_문서/통화요약_0단계/` — 매핑_및_확정흐름.md · 통화확인_목업.html · 0단계_3차_실제목소리.md), [data-model](../../domains/data-model.md) 「통화 정리」.

## Intent
수강생이 DB관리시트에서 업체의 📞 버튼으로 전화를 걸고(폰 전화 앱이 열림, 통화 녹음은 폰이 저장), 웹으로 돌아오면 「방금 통화한 녹음 올리기」가 뜬다. 녹음을 고르면 AI가 컨택 가이드 1~12번 답·상담메모·업체정보·미팅 약속을 정리하고, 수강생이 「통화 정리 확인」 한 화면에서 고친 뒤 [확정하고 저장] 한 번으로 저장한다. 확정 전에는 DB정보·미팅카드·캘린더·지표에 아무것도 생기지 않는다.

## 결정 (belie)
- D1 AI = Gemini 3.1 Flash-Lite 유료 등급(0단계: 합성 12건 95~97%, 실제 목소리 3건 93%·숫자 틀림 0·미팅 정확). 운영 키·결제는 belie 가 VPS `.env` 에 등록.
- D4 신용점수·기대출개인은 뽑고 「민감」 표시(빈칸이면 기본 체크). 자택주소지·주민등록번호는 뽑지 않는다.
- 미팅카드는 자동 등록하지 않는다 — 확인 화면에서 확정할 때만(2026-10-31).
- AI 는 들은 말만, 변환은 코드(백만원·연도 칸·15분 맞춤). 근거 문장 없는 칸은 버린다.

## 계획 대비 바뀐 점 (2026-10-31, 현재 코드 실측)
- 처음 계획은 옛 DB관리 「콜·지·기·소」 행만 대상이었다. 지금 DB관리시트(`db_sheet_leads`)는 매입DB 등 모든 공급처 유형을 한 표에서 다루고, belie 시나리오도 매입DB → **DB관리시트의 모든 행**이 대상.
- 상담메모·확인된 업체정보·미팅 초안 칸이 이미 `DbSheetContact`(note·ci·meetingDate·time·place·reservationNote)에 있다 → 따로 `lead_notes` 표를 만들지 않는다(YAGNI). 확정은 이 칸들과 기존 미팅 등록 경로를 쓴다.
- 마이그레이션 번호 0008 은 이미 사용 → `0014_call_records.sql`.
- 흐름의 시작은 DB관리시트 📞 버튼(belie 2026-10-31). 누르면 `dialed` 기록(업체·시각)을 남기고 `tel:` 로 전화 앱을 연다. 웹은 폰의 녹음 파일을 스스로 가져올 수 없어(브라우저 제한) 녹음은 수강생이 고른다 — 자동으로 가져오기는 2단계 안드로이드 앱.
- 정리는 Gemini 한 번(녹음 → 글자 + 질문별 답) → 상태를 `processing` 하나로 합침.

## PR 나누기 (직렬 병합, 각 PR check.sh + CI + 배포 health)
1. **PR-1 계약** `chore/call-summary-contract` — `lib/types/call.ts`(CallStatus·CallExtraction·CallMeetingDraft·CallRecord), `0014_call_records.sql`, data-model 등재, 계약 시험. 운영 DB 적용은 PR-2 병합 전 DB Migrate 워크플로로.
2. **PR-2 저장소** — `lib/repo/db/call-records.ts`(생성·상태·대기열 `for update skip locked`·오래된 원본), `lib/repo/ai/call-gemini.ts`(키는 VPS `.env`, 가짜 구현 포함). 녹음 임시 폴더는 레포 밖.
3. **PR-3 변환** — `lib/service/call-extract-map.ts`: 0단계 `convert.py` 규칙을 TS 로(기존 `lib/document-ocr/*`·`company-*` 함수 재사용), 0단계 정답지 15건을 「AI 원답 → 저장 형식」 고정 시험으로.
4. **PR-4 API·작업자** — 📞 기록(`dialed` 생성), 업로드(30MB·30분·하루 상한), 상태 조회, `POST /api/calls/[id]/confirm`(상담메모·업체정보·미팅·컨택결과를 한 번에, 다시 보내도 한 번), `instrumentation.ts` 처리 루프.
5. **PR-5 화면** — DB관리시트 목록·DB정보에 📞 버튼(전화번호 있을 때), 돌아오면 「방금 통화한 녹음 올리기」, 「통화 정리 확인」 화면(목업 승인본 기준, impeccable Operate).
6. **PR-6 켜기** — 첫 업로드 고지(D6), 기능 플래그(연습 기수 + belie).

## Acceptance Criteria — PR-1
- [x] `CallExtraction` 이 자택주소지·주민등록번호를 실을 수 없다(시험)
- [x] 미팅 초안 시간은 15분 단위 또는 빈값, 예약비고 500자(시험)
- [x] `call_records` 는 추가 전용, 리드 삭제 시 함께 삭제, 브라우저 역할 권한 회수·RLS
- [ ] `bash scripts/check.sh` 통과 · CI 초록 · 병합 · 배포 health
- 운영 DB 적용(마이그레이션 실행)은 이 PR 범위 밖 — PR-2 병합 전에 실행

## Log
- 2026-10-31 PR-1 착수. 0단계 완료(실제 목소리 3건 통과).
