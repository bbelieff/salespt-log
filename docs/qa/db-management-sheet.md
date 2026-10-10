# DB관리시트 백엔드 검증 (2026-10-11)

## 대상과 경계
- 승인 기준: DB관리시트 목업 v0.31. base `9abae99e6e06381aad4f35e05b64190cb712dc75`.
- 사용자 확정: 메타=직접생산, 업체별 상담한 날짜마다 1건. 같은 날 재저장은 중복 집계하지 않음.
- 인증된 기존 앱 API와 기존 서버 Postgres 연결을 사용. 테스트 데이터는 합성 값만 사용.
- Supabase 기존 프로젝트 `aoevgfroxdvgbmgvzlfb`. 모아워크 프로젝트 미접촉. 키·접속 URL·실제 사용자 자료 없음.

## 완료한 검증
| 범위 | 결과 |
|---|---|
| 실제 브라우저→실제 API/service/repo→PGlite SQL | 메타 CSV 가져오기, 휴대전화 하이픈, reload 복원, 상담 날짜 변경, 미팅 생성 PASS |
| PC 및 모바일 320/375/430 | 목록/상세 확인, 320/430 수평 넘침 없음 |
| PGlite 저장소 통합 8건 | tenant/revision, batch 멱등, rollback, 날짜 집계, 연결 미팅 변경·삭제·재전송 PASS |
| daily 집계/클라이언트 autosave | 수동+자동 기여분 보존, stale UI 저장, 원자 이동, 미팅 카운트, 입력 보존 PASS |
| 실제 Supabase PostgreSQL 격리 probe | API 저장/GET 재조회, 재전송, 날짜별 유입/상담, 예약일과 미팅일, 타 tenant, 동시 revision 한 건 성공 PASS |
| 운영 스키마 0008 | 새 테이블 4개·체크섬 일치·RLS 전체 활성·anon/authenticated 권한 없음 PASS |
| 실행 앱과 migration 대상 | 실행 프로세스의 Next 환경과 migration 연결의 대상/역할 일치, 기존 서버 역할 접근 가능 PASS |

실제 PostgreSQL probe는 `tests/integration/db-sheet-postgres.mjs`로 번들하고, 서버 안의 기존 자격증명으로 실행했다. 임의 전용 스키마를 생성하여 실 API handler/service/repo SQL을 실행했고, 서로 다른 PostgreSQL 세션 2개를 확인했다. 운영 public 테이블의 업무 데이터에는 쓰지 않았으며 시험 스키마 제거까지 PASS. 인증/레지스트리와 외부 Sheets 큐만 합성 경계로 교체했으므로 이 결과를 실사용자 OAuth/Google Sheets/GCal E2E로 부르지 않는다.

## 재현
- `npx vitest run tests/repo/db-sheet.pglite.test.ts tests/repo/db-sheet-daily-bridge.test.ts tests/components/db-sheet-autosave.test.ts tests/api/db-sheet.test.ts tests/service/db-sheet-status.test.ts`
- `node tests/integration/db-sheet-postgres.mjs --build <credential-free artifact path>`
- PostgreSQL probe는 기존 승인된 서버 환경 또는 테스트 DB에서만 실행. 비밀값은 호스트 밖으로 복사하지 않는다. 임의 schema와 합성 데이터만 생성하고 마지막에 자신의 schema만 제거한다.
- `node tests/browser/db-sheet-live/server.mjs`: 127.0.0.1:61111, production component/API와 PGlite. 운영 인증/미러 차단.

## 배포 및 운영
CI·배포 SHA·인증된 운영 페이지 확인은 후속 결과로 기록한다. 공개 health 200만으로 인증 저장 기능까지 검증됐다고 주장하지 않는다.
0008 적용본 SHA256: `d1e03284fc82ce10f4a733475cfe6c7aa1c9a5f2f74940ffa35645aadac60459`. Windows에서 검토·적용한 SQL의 CRLF 바이트를 `.gitattributes`의 해당 파일 한정 `-text`로 보존한다. 적용 이력 체크섬을 변경하거나 재작성하지 않는다. 후속 Linux 배포본도 동일 해시여야 한다.

## 최종 로컬 게이트 및 실제 DB 브라우저 왕복
- production build → check.sh 순차 실행 PASS. 구조 92, 단위/통합 3,436 PASS·45 SKIP, 타입·lint·문서 drift 통과.
- 실제 UI → loopback SSH 터널 → 기존 Supabase의 임의 전용 schema → 실제 API/service/repo → reload PASS.
- UI 직접입력 10/8 직접생산·유입 1, 10/9와 10/10 상담 각 1, 10/10 예약 1(미팅 일정 10/15 14:00), 휴대전화 하이픈 및 소재지 자동 반영 확인.
- 예약됨/미팅예약 상태가 새로고침 후 유지됨. 브라우저 시험 schema 제거까지 PASS. OAuth/외부 미러는 합성 경계이며 public 업무 자료는 변경하지 않음.
- 격리 브라우저 재현은 probe bundle --serve <전용 포트>, 127.0.0.1 SSH 터널 61112, 로컬 DB_SHEET_PROBE_PORT=61112로만 연결. 10분 자동 정리, 종료 시 소유 schema 삭제.

## 운영 완료 — 2026-10-11
- 구현 PR #1129, head e1d64f51f1f57c16d0e0a1af702dbe4066f6badc. 독립 검토 승인, CI 38079221398 success.
- squash 47728f16b561b311801a20a56b43b5a967867f18. Deploy to VPS 38079487265 success, 공개 root HTTP 200.
- 로그인된 운영 /db-sheet에서 저장됨·DB 목록 0 및 새 메뉴 확인, 브라우저 오류 없음. 새소식 팝업은 닫지 않았고 실계정 쓰기는 하지 않음.
- Linux 배포 migration 0008 SHA256이 적용본 d1e03284fc82ce10f4a733475cfe6c7aa1c9a5f2f74940ffa35645aadac60459와 일치.
- 실제 화면→Supabase 쓰기/재조회는 별도 합성 계정·격리 schema에서 확인. 실사용자 OAuth 쓰기·외부 Sheets/GCal E2E는 NOT_RUN이며 성공으로 확대하지 않음.
