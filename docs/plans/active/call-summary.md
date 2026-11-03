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
- 안드로이드·아이폰은 녹음 위치가 다르다(belie 2026-10-31): 안드로이드 = 기본 통화녹음(Recordings/Call), 아이폰 = 에이닷·익시오 등 앱 안 → 「파일에 저장」 후 고르기. **익시오 m4a 내보내기 확인됨**(0단계 실제 목소리 3건이 아이폰 익시오 녹음). 업체는 📞 를 누른 줄로 정해진다. 파일은 「그 통화가 맞나」만 확인한다: DB 번호는 연락처에 저장하지 않으므로 녹음 파일 이름에 전화번호가 붙는다(belie 2026-11-01) → **파일 이름 번호 = 📞 번호** 가 1차 확인, 저장 시각(File.lastModified)이 📞 시각과 30분 넘게 어긋나면 2차 경고. 이름에 번호가 없는 앱이면 시각만 본다. **📞 는 통화 앱을 고른다**(belie 2026-11-01: 익시오·에이닷·제3의 녹음 앱일 수 있고, 다른 앱에서 `tel:` 로 건 전화는 기본 전화로 가서 녹음이 빠짐): 익시오·에이닷·기본 전화·다른 녹음 앱 중 선택, [이번만]/[항상 이 앱으로], 고정값은 설정 › 통화 앱에서 변경(이 폰에만 저장). 녹음 앱이면 번호 복사 + 그 앱 열기, 기본 전화면 `tel:`. 각 앱을 웹에서 바로 여는 주소(URL 스킴)는 미확인 — 안 되면 번호 복사까지만 하고 직접 열어 붙여 넣기. 선택지는 앱 이름만 보여 준다(설명 문구 없음, belie 2026-11-01). 갤럭시 기본 녹음은 아직 실측 안 함. 📞 뒤 안내를 폰 종류별로 다르게, 녹음 대신 그 앱이 만든 **글자 붙여 넣기**도 받는다(`CallSource` audio|text). 자동화(2단계)는 안드로이드 = 폴더 감시 앱, 아이폰 = 「경영일지로 공유」 정도(앱스토어 앱 필요).
- 정리는 Gemini 한 번(녹음 → 글자 + 질문별 답) → 상태를 `processing` 하나로 합침.

## PR 나누기 (직렬 병합, 각 PR check.sh + CI + 배포 health)
1. **PR-1 계약** `chore/call-summary-contract` — `lib/types/call.ts`(CallStatus·CallExtraction·CallMeetingDraft·CallRecord), `0014_call_records.sql`, data-model 등재, 계약 시험. 운영 DB 적용은 PR-2 병합 전 DB Migrate 워크플로로.
2. **PR-2 저장소·스위치** `chore/call-summary-store` — `lib/repo/db/call-records.ts`(생성·녹음 붙이기·대기열 `for update skip locked`·멈춘 처리 회수·재시도 3회·오래된 원본), `lib/repo/ai/call-gemini.ts`+`call-prompt.ts`(0단계 지시문 그대로, 키는 VPS `.env`, 키 없으면 멈춤·가짜 답은 로컬 `CALL_AI_FAKE=1` 만), 기능 스위치 `CALL_SUMMARY_EMAILS`(`lib/config`). 녹음 임시 폴더는 레포 밖. 녹음은 요청에 그대로 실어 보내므로 **파일 상한 14MB**(0단계 익시오 42kbps 기준 약 45분).
3. **PR-3 변환** — `lib/service/call-extract-map.ts`: 0단계 `convert.py` 규칙을 TS 로(기존 `lib/document-ocr/*`·`company-*` 함수 재사용), 0단계 정답지 15건을 「AI 원답 → 저장 형식」 고정 시험으로.
4. **PR-4 API·작업자** — 📞 기록(`dialed` 생성), 업로드(14MB·하루 상한), 상태 조회, 닫기, `instrumentation.ts` 처리 루프.
   **PR-4b 확정** — `POST /api/calls/[id]/confirm`(상담메모·업체정보·미팅·컨택결과를 한 번에, 다시 보내도 한 번). DB관리시트 저장 경로를 건드리므로 PR-4 에서 나눔(2026-11-03).
5. **PR-5 화면** — 스위치(`isCallSummaryUser`)가 켜진 사람에게만. DB관리시트 목록·DB정보에 📞 버튼(전화번호 있을 때), 돌아오면 「방금 통화한 녹음 올리기」, 「통화 정리 확인」 화면(목업 승인본 기준, impeccable Operate).
6. **PR-6 켜기** — 첫 업로드 고지(D6), `CALL_SUMMARY_EMAILS` 에 belie·연습 기수 등록. 스위치는 PR-2 로 앞당김(belie 2026-11-01: 하나씩 운영에 붙여 조립 — 화면이 스위치보다 먼저 나가면 바로 보이므로).

## Acceptance Criteria — PR-1
- [x] `CallExtraction` 이 자택주소지·주민등록번호를 실을 수 없다(시험)
- [x] 미팅 초안 시간은 15분 단위 또는 빈값, 예약비고 500자(시험)
- [x] `call_records` 는 추가 전용, 리드 삭제 시 함께 삭제, 브라우저 역할 권한 회수·RLS
- [x] `bash scripts/check.sh` 통과 · CI 초록 · 병합(#1292, 294ed588) · 배포 run 41303143451 success · health 200
- [x] 운영 DB 적용 — DB Migrate dry-run(대기 = 0014 하나) 후 belie 실행 run 41304443399 「적용 완료: 0014_call_records.sql」

## Acceptance Criteria — PR-2
- [x] 대기열은 오래된 것부터 한 번만, 멈춘 처리는 10분 뒤 다시, 3번 넘으면 failed(시험)
- [x] 정리 끝·실패 때 녹음 경로를 돌려주고 비운다, 오래 남은 원본을 찾는다(시험)
- [x] Gemini: 키는 헤더로만, 키 없으면 보내지 않음, 14MB 초과 거절, 429·5xx 재시도 / 400 아님, 오류 문구에 키·본문 없음(가짜 fetch 시험)
- [x] 스위치 미설정 = 아무도 안 켜짐(시험)
- [x] check.sh · CI · 병합(#1298, 94ff05ae) · 배포 run 41312547283 success · health 200. 사용자 화면 변화 없음

## Acceptance Criteria — PR-3
- [x] 0단계 정답지 15건(합성 12·실제 목소리 3)의 AI 원답 → convert.py 와 같은 CallExtraction(고정 시험, 사례 파일에 받아쓰기 없음)
- [x] 채운 칸마다 근거 문장(evidence), 근거 없는 답은 버림, 자택주소·주민번호는 실리지 않음(시험)
- [x] 백만원 표기는 기존 `wonToMillion`, 매출 칸은 `salesSlotOf` 재사용. 말 금액(「3천」=3천만·「십이억」)은 서류 글 해석 `parseSalesAmount` 와 규칙이 달라 `spokenWon` 으로 따로 둠
- [x] check.sh · CI · 병합(#1299, ec853d21) · 배포 run 41627875613 success · health 200. 사용자 화면 변화 없음
- 남은 차이: 0단계의 소개처(`q1_referrer`)는 CallExtraction 에 칸이 없어 아직 버린다 — 필요하면 PR-4b 확정 때 계약에 추가

## Acceptance Criteria — PR-4
- [x] `POST /api/calls`(📞 → dialed) · `GET /api/calls?leadId=` · `GET /api/calls/[id]` · `POST /api/calls/[id]/upload`(multipart 녹음 또는 JSON 글자) · `POST /api/calls/[id]/discard`
- [x] 스위치 밖 = 404, 쓰기는 내 계정·같은 사이트만(시험). 없는 업체 = 404(외래 키)
- [x] 녹음: m4a·mp3·wav·aac·ogg·flac, 14MB, 빈 파일 거절, 하루 상한 `CALL_DAILY_LIMIT`(기본 30). 레포 밖 임시 폴더, 무작위 이름, 폴더 밖 경로 거절(시험)
- [x] 작업자: 녹음/글자 → Gemini → `mapCallExtraction` → review. 429·5xx 다시 대기(3회), 그 밖 failed. 끝·실패·닫기 때 녹음 삭제, 하루 넘은 파일 정리(시험). 스위치가 비면 루프를 돌리지 않음
- [ ] check.sh · CI · 병합 · 배포 health. 사용자 화면 변화 없음(스위치 비어 있음)

## Log
- 2026-10-31 PR-1 착수. 0단계 완료(실제 목소리 3건 통과).
- 2026-11-01 PR-1 병합·배포·운영 DB 적용 완료. PR-2 착수(스위치 앞당김, 파일 상한 14MB).
- 2026-11-01 PR-2 병합(#1298)·배포 완료. PR-3 착수.
- 2026-11-03 PR-3 병합(#1299)·배포 완료. PR-4 착수, 확정 저장은 PR-4b 로 나눔.
