# ADR-0016: 업체정보 TXT 추출 — files.update 제한 화이트리스트

- Status: accepted
- Date: 2026-06-11
- Related: ADR-0011(drive copy), ADR-0015(belie OAuth 생성), consultation-log §3-3

## Context

업체정보 "업체정보생성" 버튼은 그 수강생의 업체관리(아레나)/피드백업체(일반) 폴더에
`업체정보_{업체명}.txt` 를 **업체당 1본 덮어쓰기**로 생성한다(§3-3 — 항상 최신 1본).
Drive 에서 기존 파일 내용 교체는 `files.update`(media) 뿐인데, 구조 가드(ADR-0011)는
files.update/delete 를 전면 금지한다(시트 등 사용자 데이터 훼손 방지).

## Decision

1. **`files.delete` 전면 금지 유지** (변경 없음).
2. **`files.update` 는 `lib/repo/drive-txt.ts` 한 파일에서만 허용** — 용도는 앱이
   직접 생성한 `업체정보_*.txt`(text/plain) 1본 덮어쓰기뿐. 시트(스프레드시트)
   파일에는 사용하지 않는다(코드리뷰 + 본 ADR 규율).
3. `files.create` 허용 파일에 `drive-txt.ts` 추가 (drive-client.ts 와 두 곳) —
   TXT 신규 생성용.
4. 쓰기 자격은 **belie OAuth**(`driveCreatorClient`, ADR-0015) — SA 는 파일 생성
   불가(용량 0). 대상 폴더 = registry O(feedback_folder_id) — 아레나 생성 시
   업체관리 폴더가, 일반 기수는 Drive 연동 시 피드백업체 폴더가 이미 stamp 됨.
   O 비어 있으면 명확한 에러(폴더 탐색·생성으로 오폴더 생성 위험을 지지 않음).

## Consequences

- 구조 테스트(layers.test.ts drive write whitelist)가 위 규칙으로 정밀화된다.
- TXT 는 사용자가 직접 만든 파일과 이름이 겹치면 그 파일을 덮어쓸 수 있다 —
  파일명 prefix `업체정보_` 가 앱 소유 명시 규약. 운영 안내로 충분(MVP).
- 폴더 미연결(O 빈값) 수강생은 버튼이 에러 안내 — Drive 연동 후 사용.
