> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: BBE-49(비파일럿 수료자 컨택 저장 500) — Cowork가 origin/master 기준 클린 클론에서 코드 수정을 완료·typecheck+lint+전체 vitest(1019 passed) 검증까지 마쳤고, 패치 파일만 남았다. Claude Code 세션이 워크트리에서 적용 → 리뷰 → 커밋 → 배포하면 끝난다.
> - **누가 읽나요**: 이 이슈를 집어드는 Claude Code(Dev) 세션, belie
> - **어떤 기능·작업과 연결?**: `docs/worklog.md` 📮 R4 BLUEPRINT 항목 ⑫, Linear BBE-49
> - **읽고 나면 알 수 있는 것**: 원인 / 무엇을 왜 이렇게 고쳤는지 / 적용 방법 / 이미 통과한 검증 / 남은 것
> - **관련 문서**: `docs/worklog.md`(2026-08-05 로그 2건), `lib/service/daily-source.ts`, `lib/service/sales-write.ts`, `lib/service/contact.ts`

# BBE-49: 비파일럿(7기 등) 수료자 컨택관리 저장 500 — 패치 준비 완료

## 왜 (재현·근본원인)
김현지(7기, 개강 5/15, 수료 7/4, 현재 12주차) 임퍼스네이션 라이브 재현: `/contact`에서 유입/컨택진행/미팅예약
+버튼 후 저장 → `POST /api/daily/2026-08-05` 500, `"영업관리 좌표 계산 실패: 날짜 2026-08-05는 편집 가능
기간(1~10주) 밖입니다."` 원인: `lib/service/daily-source.ts`의 `DB_READ_COHORTS=["8","9","연습"]`(+아레나)
파일럿 목록에 7기가 없어 `chooseWriteSource`가 "sheet" 반환 → 레거시 시트정본 경로(`salesRowFor`)가 시트
물리 상한(week>MAX_SHEET_WEEK=10)에서 무조건 throw. wave-1(#631)의 "11주+=DB-only"는 파일럿 기수 전용이라
비파일럿엔 미적용 — DevE가 7/29에 "비파일럿 수료자 저장 영구실패"로 이미 보고했으나 판정 라운드에서 누락된 채
"6·7기 확대=wave-2"로 이연되어 있었음. belie 지시(2026-08-05, "실제로 고쳐줘")로 이 좁은 범위만 지금 닫는다.

## 무엇을 고쳤나 (범위를 의도적으로 좁게 잡음)
`DB_READ_COHORTS`에 7기를 추가하는 "wave-2 전체 확대"가 아니다 — 그건 대시보드·통계·아레나 등 전 영역에
영향을 주는 더 큰 결정이라 이 세션 범위가 아니다. 대신 **딱 이 버그의 물리적 원인만** 수리:

1. `lib/service/sales-write.ts::persistSalesRows` — 파일럿 여부와 별개로, 저장하려는 날짜가
   `weekIndexOf(date, courseStart) > MAX_SHEET_WEEK` 이면 DB 로 우회 저장(시트엔 좌표가 없어 애초에
   못 쓰는 게 사실이므로). `persistProductionCell`/`persistMeetingReservationCount` 는 건드리지 않음
   — 그쪽은 무필터 집계 오염 방지를 위해 11주+ 를 의도적으로 제외하는 별개 설계.
2. `lib/service/contact.ts::loadDay` — 위 쓰기측과 대칭으로, 같은 물리한계 조건이면 DB 읽기를 시도.
   안 맞추면 "저장은 DB에 됐는데 조회 화면은 계속 0" 이라는 읽기/쓰기 비대칭이 재발한다(비용원장
   사고와 동일 클래스 — §0 정본 이원화 금지 위반).
3. `tests/service/sales-write.test.ts` — 기존 "비파일럿은 완전 불변" 테스트를 "물리한계 **안**에서는
   완전 불변"으로 좁히고, "물리한계 **밖**은 DB 우회"를 새 케이스로 추가(대칭 짝).

## 검증 완료 (origin/master 클린 클론에서, 2026-08-05)
- `npx tsc --noEmit` — 0 에러
- `npx eslint lib/service/sales-write.ts lib/service/contact.ts tests/service/sales-write.test.ts` — 0 경고
- `npx vitest run` (전체) — **115 test files, 1019 passed, 1 skipped(기존 무관 skip), 0 failed**
- `tests/structural/*` (layers·period-hardcode·dev-watch) 전부 초록 — 레이어 경계·8주 하드코딩 가드 위반 없음
- 파일 크기: `sales-write.ts` 231줄, `contact.ts` 359줄 (500줄 캡 여유)

## 적용 방법 (다음 Claude Code 세션이 할 일)
```bash
# 1. 새 워크트리(하네스 규칙 §3 step 4 — 메인 직접수정 금지)
git worktree add wt/bbe-49-nonpilot-week11 -b fix/bbe-49-nonpilot-week11-save origin/master
cd wt/bbe-49-nonpilot-week11
npm ci

# 2. 패치 적용
git apply ../../docs/incidents/2026-08-05-bbe49-nonpilot-week11-save.patch
# 안 먹으면(공백/줄바꿈 diff): git apply --whitespace=fix 로 재시도. 그래도 실패하면
# 이 문서의 "무엇을 고쳤나" 섹션 보고 3개 파일을 수동 반영(로직은 단순함).

# 3. 재검증 (원본 검증은 클론에서 했으니 워크트리에서 한 번 더 확정)
npm run check   # 또는 scripts/check.sh — typecheck+lint+structural+test+파일크기+doc-drift

# 4. 라이브 확인 대상: 김현지(7기) 계정으로 /contact 2026-08-05(or 오늘) 저장 → 200 확인,
#    새로고침 후 저장한 값이 화면에 그대로 남아있는지(읽기측 대칭 확인) 재확인 필수.

# 5. 커밋 메시지에 Changelog 포함 권장(§6.5) — 예:
#    fix(sales): 수료 후 11주+ 컨택 저장 500 수리 — 비파일럿 기수도 물리한계 밖은 DB 로 (#?)
#    Changelog: 수료 후에도 컨택관리 기록을 계속 남길 수 있어요.

# 6. PR → check.sh 초록 → 직렬머지(§0.7②, 조건 충족 시 자율) → §6.8(배포관찰+health) 완주.
```

## 적용 세션(DevA, 2026-08-05) — 적대리뷰 4렌즈에서 BLOCKER 2·HIGH 4 발견 → 수정 후 배포

패치를 그대로 적용하지 않고 아래를 고쳐서 머지했다. 원 패치의 진단(원인·범위 축소 판단)은 옳았고,
구현에서 **읽기/쓰기 게이트가 서로 다른 courseStart 를 보는** 문제 등이 있었다.

| 지적 | 무엇이 위험했나 | 수정 |
|---|---|---|
| **BLOCKER** 게이트 원천 불일치 | 읽기(loadDay)는 레지스트리 K 캐시, 쓰기(persistSalesRows)는 시트 O1 로 물리한계를 판정 — 두 값이 10/11주 경계에서 갈리면 이 패치가 막겠다던 read/write 비대칭이 그대로 재생산 | 판정 원천을 **시트 O1 로 통일**(비파일럿 한정 1회 read, 시트 폴백이 재사용해 총 read 수 불변) |
| **BLOCKER** 시트 폴백의 courseStart 교체 | 비파일럿 **전원·전 주차**의 주차 블록 선택이 O1 → K 캐시로 바뀜(BBE-49 와 무관한 곁다리 최적화). K 가 비ISO(`"46122"` 시리얼)면 NaN → 전 지표 0 → draft 0 시드 → **다음 저장이 정본을 0 으로 덮음** | 시트 폴백은 **기존대로 O1** 사용 |
| **HIGH** 비파일럿 DB 백필 부재 | 미러는 2026-07-07~ 파일럿만 적재 — 7기 DB 엔 과거 데이터가 없다. 그런데 DB 분기가 누적합·미팅·현수막 주문합까지 DB 에서 재계산해 **유입대기·현수막 재고가 0**(현수막 게시 버튼 하드 블록) | 비파일럿은 **그 날 4지표만 DB**, 누적합·미팅·주문합은 시트 정본 유지 |
| **HIGH** 주간 퍼널 0 (`contact-week.ts` 미수정) | 같은 화면 상단 주간 퍼널은 `readWeekFunnel` 이 11주+ 에서 항상 0 → "날짜칸엔 보이는데 위 합계는 0" | 비파일럿·11주+ 에 한해 퍼널만 DB 로 재계산(실패 시 기존 0 유지) |
| **HIGH** `dbEnabled()` 가드 누락(쓰기) | DATABASE_URL 을 내리는 **롤백 레버**를 쓰면 DB 우회가 그대로 실행돼 "호출부 게이트 오류" 500 | 쓰기 분기에 `dbEnabled()` 추가(읽기와 대칭) |
| **HIGH** 읽기측 테스트 0건 | 패치의 절반(대칭)이 회귀 그물 밖 | `contact-unlimited-roundtrip.test.ts` 에 비파일럿 5케이스 추가(O1 기준 판정·누적합 시트 유지·1~10주 불변·DB off) |
| MED | 배치에 날짜 혼재 시 `rows[0]` 하나로 전체 판정 · 주석이 "드문 경우에만 read" 라고 사실과 다르게 단언 | 비파일럿 한정 혼재 즉시 실패(테스트 포함) · 주석을 실제 비용(비파일럿 저장마다 read 1회)으로 정정 |

## 남은 것 (이 패치 범위 밖)

- **생산(E) 기입은 비파일럿 11주+ 에서 여전히 유실** — `persistProductionCell` → `writeProductionCell`
  이 편집창 밖에서 조용히 skip 하고, 비파일럿은 DB 기록 경로가 없다(파일럿은 `upsertSalesCells` 로 남음).
  03 DB관리발 생산 입력이 대상. 별도 티켓.
- **`syncDirectProductionForDate`(직접생산 M 동기화)** 는 비파일럿에서 시트 1~10주만 합산 —
  11주+ 유입이 반영되지 않는다. 위와 같은 티켓으로 묶어 처리 권장.
- DB read 실패 시 11주+ 화면이 0 으로 보이는 폴백 특성은 **파일럿과 동일**(기존 설계). 그 상태에서
  저장하면 정본이 0 으로 덮이는 위험이 남아 있어, 후속에서 "정본 못 읽음 = 쓰기 잠금" 플래그가 필요.
- **wave-2**: 6·7기를 `DB_READ_COHORTS`에 정식 편입할지(대시보드·통계·아레나 전 영역 영향) — 별도 belie
  결정 필요. 이 패치는 그 결정을 선점하지 않는다(딱 저장 500만 닫음).
- 10기(8/7 개강)도 개강+11주째(10월 중순경)부터 같은 물리한계에 닿는다 — 8·9·연습·아레나만 파일럿이라
  10기 역시 이 패치 덕에 그 시점부터 문제없이 저장/조회된다(비파일럿 경로에 이미 물리한계 예외가 생겼으므로).
- 원본 root 체크아웃(`C:\...\dev-harness` 루트)이 origin/master 대비 126커밋 뒤처져 있고 무관한
  uncommitted 변경이 대량 있음(이번 조사 중 발견) — 패치는 origin/master 기준 클린 클론에서 만들어
  이 문제와 무관하지만, 루트 체크아웃 자체의 위생은 별도로 다룰 필요.
