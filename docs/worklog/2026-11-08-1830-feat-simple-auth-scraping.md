## 2026-11-08 · 업무도구 「간편인증 서류 조회」 — 제공사 비교·흐름 결정·목업
- 브랜치 `feat/simple-auth-scraping` (기준 d8676402). [병렬트랙] 담당 파일: `docs/plans/active/simple-auth-scraping.md`, `tests/browser/simple-auth*`.
- 요청(belie): 업무도구에 간편인증 스크래핑. 제안서를 비교해 제공사 선택 → 메일 문의 대신 공개 자료(PDF·개발문서)만으로 비교하기로 정정.
- 결정(belie): 고객 링크 없이 수강생이 앱에서 대표 휴대폰으로 인증을 보내는 「직접 요청형」 하나로 통일(워크플로우 6개, 외부 서비스는 스크래핑 중계 1종). 채권자변동조회 보류(CODEF 공개 상품 없음). 주민번호 미수집(홈택스 회원 간편인증만).
- 제공사: 미정. CODEF 1순위(간편인증 11종·다건 세션·원문·홈택스 증명 전 항목), 틸코 2순위(완료여부 확인 API). 가격 비공개 → 데모 실측 필요.
- 변경: plan 작성, 합성 목업(`node tests/browser/simple-auth-server.mjs`) — 실제 CSS·PhoneInput·CompanyDocDiffTable 재사용, 제공사·서버 호출 없음.
- 미완료: 목업 승인, 제공사 확정·데모 시험, 구현 전체. [plan](../plans/active/simple-auth-scraping.md)

## 2026-11-09 · 목업 승인 → 구현(운영반영 지시)
- 담당 파일 추가: `lib/{types,config,service}/simple-auth*.ts`, `lib/repo/codef-client.ts`, `lib/repo/db/simple-auth.ts`, `lib/repo/db/migrations/0018_simple_auth.sql`, `app/api/simple-auth/**`, `app/(app)/work-tools/simple-auth/page.tsx`, `components/simple-auth/*`, `components/desktop/DesktopNav.tsx`(업무도구 행 1줄), `middleware.ts`(/work-tools 보호), docs data-model·components.
- 결정(belie): 데모 키로 먼저, 지방세 주소는 도로명주소 검색(키 없는 카카오 우편번호), 수강생 전체 공개.
- 검증: 파서 단위 9 · PGlite 흐름 5(승인 전/후·DB 연결·새 DB 유입 미반영·반영 칸 제한·원문 PDF·테넌트 분리·재시작 정리) · 실제 화면을 가상 API 로 PC 캡처 확인.
- 남은 것: 병합·배포, 0018 적용(DB Migrate), VPS `.env` CODEF 키 3개(belie 직접), 실제 1건 시험. 실호출 미검증 항목: 법인 인증서·국세 pfx·4대보험·정부24 지방세 간편인증.

## 2026-11-09 · 인증서 고르기 한 버튼(설치된 인증서·파일 모두)
- 요청(belie): pfx 내보내기 대신 기관 사이트처럼 설치된 공동인증서를 골라 비밀번호만 넣기, 같은 버튼에서 모든 형식 허용.
- 변경: `components/simple-auth/CertPicker.tsx`(새), `lib/util/npki-cert.ts`(새, 인증서 요약·폴더 묶기), `RequestForm.tsx` 인증서 칸 교체. 서버·API 변경 없음(der+key·pfx 기존 경로).
- 검증: `tests/util/npki-cert.test.ts` 6(가상 자체서명 인증서) · 실제 화면 가짜 NPKI 폴더 넣기→2장 목록→개인 선택·이름 자동·der+key 전송, pfx 끌어 놓기(PC·모바일).
- 미확인: 실제 Windows 폴더 창에서 `AppData\LocalLow\NPKI` 선택(자동화 불가 — 크롬 차단 목록상 허용 경로), 실제 발급 인증서의 정책 OID 판별.

## 2026-11-09 · 인증서 창 단순화
- belie 「이부분이 너무 복잡한데?」 → 펼침 창을 목록 + 버튼 1개(「내 PC에서 인증서 찾기」) + 링크 1개(「파일로 고르기(.pfx)」)로 줄였다. 경로 안내·복사는 접힌 「어느 폴더를 고르나요?」로, USB·끌어 놓기 문장 삭제(끌어 놓기 기능은 유지), 「지난번 폴더 다시 열기」·「폴더 올리기」 버튼은 한 버튼에 합쳤다. 목록의 발급기관 칸 삭제.
- 검증: 라이브 셸 1440·390 — 가짜 NPKI 폴더 → 2장 목록 → 개인 선택 → der+key 전송, pfx 끌어 놓기 자동 선택 동일 통과. 실제 Windows 폴더 창은 NOT_RUN(자동화 불가).

## 2026-11-09 · 받을 서류 기관별 묶음
- belie 「받을서류에서 홈택스와 기관을 나눠서 받아, 애매하게 병렬하지말고」 → `SimpleAuthDocDef.site`(홈택스·정부24·4대사회보험 정보연계센터, CODEF 경로 nt·mw·pp 기준) 추가, RequestForm 이 기관 제목별로 칩을 묶는다. 기관명이 제목에 있으니 칩 꼬리 「정부24」·「인증서 전용」은 뺐다. 요청·서버 동작 변화 없음.
- 검증: 라이브 셸 1440·390 공동인증서 탭 화면 확인(3묶음).
