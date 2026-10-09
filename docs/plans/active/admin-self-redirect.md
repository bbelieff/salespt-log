> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 관리자 본인 화면 바로가기가 운영에서 localhost로 이동하는 오류 수정
> - **누가 읽나요**: 경영일지 개발자
> - **어떤 기능·작업과 연결?**: `/admin/me`, `appBaseUrl`
> - **읽고 나면 알 수 있는 것**: 원인, 수정 범위, 운영 검증 결과
> - **관련 문서**: ../../worklog.md, ../active/company-vault.md

# 관리자 본인 바로가기 공개 주소 복원

- 담당: 경영일지 데탑 G총괄(261009), 사용자 DC 인계 요청의 운영 육안 확인 중 발견.
- 기준: master `eac6e2fc2f0a0cb48dbc398131947ab3a30106ed`.
- 실측: 2026-10-09 운영 Chrome에서 `/admin/me` → `https://localhost:3000/dashboard` → ERR_CONNECTION_REFUSED. `/dashboard` 직접 진입은 본인 GM 화면 정상.
- 원인: 프록시 내부 `req.url`로 절대 리디렉션 구성. 기존 `lib/config/index.ts:31`에 같은 사고와 공개 주소 정본 `appBaseUrl()`이 이미 정의되어 있음.
- 범위: 해당 라우트의 세 리디렉션을 기존 정본으로 통일. 계정·권한·DB·PIN 변경 없음.
- 수용: 관리자 대리 보기 해제 유지, 비관리자는 상태 변경 없음, 비로그인 첫 화면 이동; 모든 목적지는 설정된 공개 URL. 운영 `/admin/me`에서 공개 `/dashboard` 도착.
- 검증: check.sh, 프로덕션 build, CI, squash merge, Deploy to VPS success, 공개 HTTP 200, Chrome 본인 바로가기 확인.
- 복구: squash 커밋 revert.
- 병행 제한: #1002·#798 무접촉. 새소식 팝업은 사용자만 닫음. 보관함 3단계와 컨택 스크롤 후속은 이 PR 밖.
- Linear: 재인증 요구로 BBE-75 조회/게시 실패; 이번 기록은 worklog에 보존. 임의 다른 이슈 게시 없음.
- 로컬 검증: check.sh PASS — 구조 92개, 단위·통합 3,326개 통과 / 기존 45개 스킵; 프로덕션 build PASS. CI·머지·운영 재검증은 후속 게이트.
