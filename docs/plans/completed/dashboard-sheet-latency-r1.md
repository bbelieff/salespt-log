> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 시트 fallback의 프로필 의존 미팅 조회를 초기 조회와 겹친 release의 완료 영수증입니다.
> - **누가 읽나요**: 개발자, 독립 검증자, 배포 담당자
> - **어떤 기능·작업과 연결?**: `lib/service/dashboard.ts`의 `loadDashboardFromSheet`와 집중 회귀 테스트
> - **읽고 나면 알 수 있는 것**: 어떤 호출을 병렬화했는가 / 무엇을 보존했는가 / 어디까지 운영 검증했는가
> - **관련 문서**: `CLAUDE.md`, `docs/worklog.md`, `docs/domains/data-model.md`, `docs/domains/sheet-structure.md`

# Dashboard Sheet Latency R1

status: completed
work-id: SALES-PT-LATENCY-R1-SHEET-FALLBACK-01
docs-close-work-id: SALES-PT-LATENCY-R1-DOCS-CLOSE-01
base: 1a11406d52fdf0aeb4b7988991a15d51a634aedb
candidate-commit: 505c071ed917602972d3609994b4629bbebb6c8a
merge: ccedd64c18e03803d2b3fce96cbb50cafdd5b508

## 완료 결과

`loadDashboardFromSheet`는 프로필을 얻은 직후 `readCourseMeetings`를 시작하고, 다른 초기 Sheets 조회와 함께 기다린다. 반환 `DashboardView`, 해지 오버레이, 프로필 오류 전파, 정확히 일곱 번의 Sheets 호출은 유지됐다. DB/admin/background parity와 `reverseShadowCompare` 경로는 변경하지 않았다.

## 검증·출시 영수증

- [x] 결정론적 held-promise 테스트: focused 2/2, 관련 dashboard 27/27 PASS
- [x] 독립 검증: exact 4-file SHA256/blob/diff와 여섯 acceptance lens `PASS_TO_RELEASE`
- [x] 로컬 `check.sh`: lint 0, structural 23/23, unit/integration 877/877, doc-drift·file-cap PASS
- [x] production build: 69/69 static pages PASS
- [x] hook 감사: 정상 hook이 환경성 장시간 timeout으로 두 번 끝나지 않아 Foreman 승인 1회 `--no-verify`; 이후 canonical GitHub CI가 PASS
- [x] PR [#645](https://github.com/bbelieff/salespt-log/pull/645): Typecheck & QA run `30647375417` SUCCESS, GitGuardian SUCCESS, MERGEABLE+CLEAN
- [x] squash merge: `ccedd64c18e03803d2b3fce96cbb50cafdd5b508`
- [x] master QA run `30647563257` SUCCESS
- [x] Deploy to VPS run `30647563313` SUCCESS; production `HEAD is now at ccedd64`
- [x] health: deploy local `/api/health` 200, 독립 public `https://salesptlog.online/api/health` 200·`ok:true`
- [x] 안전한 live read-only: 기존 인증 세션에서 대시보드 렌더·loading 해제·console warn/error 0, 운영 데이터 write 0
- [x] `AUTH_TIMING_BLOCKED`: 브라우저 도구가 직접 API 탭을 차단하고 page sandbox가 `fetch`를 제공하지 않아 신뢰할 수 있는 sheet-fallback cold/warm 수치를 만들지 않았다. public redirect를 인증 timing 증거로 대체하지 않았다.

## Rollback

회귀가 확인되면 merge SHA `ccedd64c18e03803d2b3fce96cbb50cafdd5b508`를 정상 revert PR로 되돌린다. 그러면 기존 순차 미팅 조회로 복귀하며, 데이터 migration이나 운영 데이터 변경은 없다. Last-good은 `1a11406d52fdf0aeb4b7988991a15d51a634aedb`다.
