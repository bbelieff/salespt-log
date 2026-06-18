> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 여러 시트의 미팅/계약/수임비/매출/지표 셀이 `#VALUE!` 로 깨져 웹 조회까지 막힌 사고 — 원인은 이월 guard 가 04 그리드 밖 컬럼(AW)을 참조한 것, 즉시완화는 웹 read 견고화(#416), 근본수정은 수식 재설치.
> - **누가 읽나요**: 개발자, 에이전트, 운영자(belie)
> - **어떤 기능·작업과 연결?**: setup-formulas(01 영업관리 펀넬/일별/지표), arena-carryover 이월 guard, dashboard read, install-formulas-bulk
> - **읽고 나면 알 수 있는 것**: 무엇이 #VALUE! 를 냈나, 왜 생산만 멀쩡했나, 어떻게 고치나(재설치), 재발 방지
> - **관련 문서**: docs/domains/sheet-structure.md(04 이월 AO~AP), docs/plans/active/arena-carryover-migration.md

# 2026-06-18 — 시트 #VALUE! 광범위 (이월 guard 가 그리드 밖 컬럼 참조)

## 증상
- 강구수(A1-5)·이재영(A1-1)·정유영(A1-3) 등 다수 시트: **생산/유입/컨택은 정상**, **미팅·계약·수임비·매출·영업이익·생산성 지표 셀이 전부 `#VALUE!`**.
- 웹의 주차 실적 read 가 그 행을 함께 읽다 막혀 **생산까지 조회 안 됨**.

## 근본 원인 (라이브 FORMULA 진단)
- 01 영업관리 재무 체인: `E1=O4(수임비)`, `E3=O6(매출)`, `I3:I6(지표)=F4/F3 …` 가 모두 #VALUE!.
- 추적: `O4=O38+O72+…`(주차 수임비 합), `F4=SUM(R4:U4)`(미팅 펀넬), `I3=F4/F3` → 공통 뿌리 = **R4:U5 채널 펀넬 COUNTIFS** 와 **일별 K/L/N/O SUMIFS** 가 다음을 참조:
  ```
  COUNTIFS('04 업체관리(앱자동작성용)'!F:F,"매입DB",…!J:J,"예약",'04 …'!AW:AW,"<>이월")
  ```
- **`'04'!AW:AW` = 컬럼 49**. 그러나 **04 시트 그리드는 45컬럼(A~AS)뿐** → AW 는 그리드 밖 → COUNTIFS/SUMIFS 의 criteria_range 크기가 F:F/J:J 와 달라짐 → `#VALUE! (Array arguments are of different size.)`.
- **이월(구분) 컬럼은 AO(41)** 이 정본(sheet-structure §3 AO~AP). 생산/유입/컨택은 이월 guard 가 없어(03 DB·E열 기반) 멀쩡했던 것.

## 왜 라이브가 AW 인가 (코드는 AO)
- `lib/repo/setup-formulas.ts` 는 이월 guard 를 **전부 `AO:AO`** 로 생성(134/139/141/142/160). 코드베이스에 **`AW` 는 어디에도 없음**.
- 즉 라이브 수식이 **과거 04 컬럼 삽입(업체정보 확장 등)으로 `AO→AW` 자동 시프트**된 뒤, 이후 그리드가 45컬럼으로 돌아오며 AW 가 그리드 밖이 된 잔재. 코드가 옳고 **라이브가 stale**.

## 조치
1. **즉시 완화(배포 완료)** — [#416] `fix/web-read-tolerate-cell-errors`: `readWeek` 가 `numCell` 로 셀별 격리(오류셀→0) → 한 셀 #VALUE! 가 행 전체(생산 포함) read 를 안 무너뜨림. 강구수 생산 80 조회 복구.
2. **근본 수정 = 수식 재설치(코드 변경 불요)** — `installFormulas` 가 R4:U5+F4/F5(meetingFunnel)·일별 K/L/N/O 를 **올바른 AO:AO** 로 덮어씀. §2.5 가드: 현재 셀이 수식(`=…AW…`)이라 overwrite 허용, 사용자 입력값은 보존.
   - **실행(belie/admin)**: 배포 정상화 후 admin `수식 일괄 설치`(install-formulas-bulk) 를 **아레나 37시트 + 템플릿 전 시트**에 실행.
   - 단건 확인: install-formulas-by-id 로 강구수 먼저 → 진단 스크립트로 #VALUE! 0건 확인 후 일괄.

## 검증
- `node scripts/diagnose-value-error-2026-06-18.mjs` → 재설치 후 강구수 O4/O6/I3:I6 #VALUE! 0건, E1:E6/대시보드 재무 정상.
- 웹: 강구수 현수막 생산 80 + 미팅/계약/매출/지표 정상값. 표본 3시트 #VALUE! 0건.
- 생산 등 사용자 입력 데이터 손실 없음(§2.5 보존가드).

## 실제 해결 (2026-06-19, belie 승인 SA 스크립트 — admin/tsx 불가)
진단 결과 #VALUE! 는 **두 모집단**이었다(둘 다 "이월 guard 가 04 그리드 밖 컬럼 참조"):
- **① 45컬럼 04 + 수식 `AW:AW`(49)** (강구수 등 9개) — AW 가 45 그리드 밖. → `scripts/fix-formula-aw-to-ao-2026-06-18.mjs` 로 `!AW:AW`→`!AO:AO` 표면 치환(백업·가역).
- **② 37컬럼 04 + 수식 `AO:AO`(41)** (~40개) — AO 가 37 그리드 밖. **admin 재설치로도 안 고쳐짐**(수식은 AO 로 이미 맞음, 그리드가 좁음). → `scripts/fix-04-grid-width-2026-06-18.mjs` 로 04 그리드 37→45 확장.
  - ⚠️ **발견**: 그리드 확장 시 Google Sheets 가 *그리드 밖 참조를 추가 컬럼 수만큼 시프트*(AO 41 → AW 49, +8). 그래서 **순서 = (1) 04 그리드 45 확장 → (2) AW→AO 치환** 2패스로 통일 해결.
- **결과**: 전 trainee **64시트 #VALUE! 잔존 0** 검증. 04 그리드 43개 45 확장, 수식 치환 ~14,768셀(+canary). 데이터 무손실(빈 컬럼·표면 치환만). 원본 수식 백업 `scripts/_backup-formula-aw-*.json`(gitignore).

## 재발 방지 (Hashimoto)
- **웹 read 견고화(#416)** = 증상 차단: 어떤 셀이 #VALUE! 여도 그 주(생산 포함) read 가 안 무너짐.
- **04 그리드 폭은 항상 ≥45컬럼(A~AS)** 이어야 이월 guard(AO~AP)·업체정보(T~AN)·확장(AQ~AS) 참조가 유효. 신규 시트 셋업·04 구조 변경 시 그리드 폭 보장 + installFormulas(AO:AO) 재실행.
- 그리드 밖 참조는 Sheets 가 리사이즈 때 시프트시키므로(우리 사례 AO→AW), **out-of-grid 참조를 만들지 말 것**.
- (후속) 영업이익률 `=F21/D21` 는 0매출 시 #DIV/0! — 이번 incident 무관(웹 tolerant). IFERROR 래핑은 별도 setup-formulas 개선.
- (후속) 그리드폭·수식참조 점검을 admin diagnose 또는 구조테스트로 가드.
