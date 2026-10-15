# DB관리시트 운영 구현 확인용 합성 환경

`npm ci`와 `npm run build` 후 `node tests/browser/recording-release/server.mjs`를 실행하고 http://127.0.0.1:4526/db-sheet 를 연다.

- 운영 React/CSS와 실제 DB관리시트·미팅 보관함/복원 API, service, repo를 사용한다.
- PGlite는 프로세스 메모리 안의 합성 DB다. 재시작하면 초기화된다.
- 계정 확인은 합성 계정으로 고정하고 외부 Sheets/Calendar 미러 전송은 차단한다. `DB_SHEET_PROBE_PORT` 외부 연결을 허용하지 않는다.
- `/fixture-proof`는 합성 sales/meetings 저장값을 확인한다. 운영에는 라우트가 추가되지 않는다.
- 화면 하단 미팅 보관함 버튼은 동일 제품 컴포넌트를 별도로 노출한 검증 전용 진입점이다.
- 선택적 `FONT_BUILD_ROOT`는 해당 checkout의 production build 폰트 디렉터리만 지정한다.

확인: 직접등록·새로고침, 공급처 이력, 가져오기 전체/행별 유입기록, 사후반영 1회성, 중복 경고 기존업체 열기, 삭제 영향 미리보기, 미팅 같은ID복원, PC/320/375/430 가로넘침과 카드 높이. 외부 서비스 실제 전송과 운영 데이터 쓰기는 이 환경에서 검사하지 않는다.
