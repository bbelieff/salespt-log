# ADR-0004: 2026-05-13 사고군 — 데이터 무결성·캐시·배포 가드 도입

## 📄 이 문서는 무엇인가요?

- **한 줄 요약**: 2026-05-13 하루에 발생한 5건의 운영 사고를 분석해 도출한 5가지 하네스 규칙·코드 가드의 결정 기록.
- **누가 읽나요**: 개발자, 운영자 (admin), 미래의 Claude 세션.
- **어떤 기능·작업과 연결?**: Sheets I/O 경계, React Query 캐시, claim 흐름, deploy 워크플로우.
- **읽고 나면 알 수 있는 것**:
  - 같은 종류 사고를 다시 만났을 때 어디부터 의심해야 하는가?
  - 왜 `unstable_cache` 가 Date 객체를 직접 못 받는가?
  - 왜 `queryClient.clear()` 가 `removeQueries` 보다 안전한 선택인가?
- **관련 문서**: `CLAUDE.md` §0 (Hashimoto 원칙), `docs/architecture.md`, `docs/playbooks/setup-sheets.md`.

**상태**: `approved` | **날짜**: 2026-05-13 | **결정자**: bbelieff

---

## Context

같은 날 하루에 5건의 사고가 운영에서 트리거됨. 각각 원인이 다르지만 패턴이 공통 — **타입 시그니처가 거짓말** + **캐시 boundary 에서 직렬화 가정** + **silent failure 채널**.

### 사고 1 — cohort number 형변환으로 /claim 무한루프 (commit c1255d7)

- 증상: 7기 신규 수강생 vigilantback (김송송) 이 /claim 입력 후 폼만 reset, 오류 메시지 없이 무한루프.
- 원인: Sheets API `valueRenderOption: "UNFORMATTED_VALUE"` 가 셀 타입 그대로 반환. cohort 컬럼에 `"7"` 만 입력하면 시트가 자동으로 number 7 로 인식 → `readRange` 가 `string[][]` 시그니처지만 실제 `(string|number)[][]` 반환 → `parseRow` 의 `cohort: r[1] ?? ""` 가 number 그대로 Zod `z.string()` 에 전달 → 검증 실패 → `parseRow` null → `findUserByEmail` null → /claim redirect.
- 기존 사용자가 `"5기"` `"6기"` 처럼 한글 접미사 포함이라 text 유지 → 영향 X. 신규 prep 단계 순수 `"7"` 입력 시 첫 폭발.

### 사고 2 — 6기/4기 시트 SA writer 누락

- 증상: 황정환 (6기) 등이 "The caller does not have permission" 으로 업체등록·일지저장 실패.
- 원인: 시트 권한 모델 v1 → v4 진화 과정에서 6기·4기 시트들이 admin Drive 폴더 외부에서 만들어져 SA writer 권한 누락. anyone-with-link 권한이 service account 에는 자동 상속 안 되는 Google 정책.

### 사고 3 — unstable_cache 가 Date 객체를 ISO string 으로 직렬화

- 증상: /api/me 가 `{"error":"a.getFullYear is not a function"}` 500. 헤더 깨지고 "← 메뉴" 버튼 사라짐. 가끔 다른 사람 시작일/종강일 표시.
- 원인: `lib/service/me.ts` 의 `cachedReadBundle = unstable_cache(...)` 가 `readProfileBundle` 결과 (Date 포함) 그대로 캐시. Next.js `unstable_cache` 는 결과를 JSON 직렬화 → Date → ISO string. cache hit 시 `bundle.courseStart` 가 string → `toISO()` 의 `.getFullYear()` TypeError.
- cache miss 시(PM2 restart 직후, 60s 만료 후)만 정상이라 재현·진단 어려움.

### 사고 4 — deploy.yml OOM build silent failure

- 증상: PR 머지 → GitHub Actions deploy job → silent 하게 빌드 실패. 운영자는 "merge 됐고 사이트 200 이니 적용됐겠지" 라고 인지, 실제로는 옛 빌드 그대로.
- 원인: `NODE_OPTIONS=--max-old-space-size=4096` 이 VPS RAM(3.8GB) 초과 → kernel OOM-killer 가 node build 프로세스 SIGKILL → `set -e` 가 deploy 스텝 fail 처리하지만 PM2 는 옛 빌드로 계속 동작 → public health check HTTP 200 통과.

### 사고 5 — impersonation 시 첫 trainee 데이터 고정

- 증상: admin/trainer 가 picker 에서 trainee A 클릭 → /dashboard A → 다시 picker → trainee B 클릭 → /dashboard 가 여전히 A 본문 표시. 헤더만 B.
- 원인: `AdminUserPicker.pick` 등이 `queryClient.removeQueries({queryKey:["me"]})` 만 호출. `useDashboard / useDailyContact / useWeeklyMeetings / useContractPayment / useDb` 등 trainee data hook 들이 각자 `staleTime` + `refetchOnMount:false` 라 cache hit 시 첫 trainee 데이터 그대로.

### 부수 사고 — prep row 매칭 시 writeProfile skip

- 증상: 7기 5명 (김현정·문보혜·오승진·이승익·함진숙) + 4기 손기학 시트 C3 (이름) 비어있음 → 헤더에 이름 placeholder.
- 원인: `claimAccount` line 91-94 `if (!existingSheetId) writeProfile()` — prep row 매칭 케이스에서는 `existingSheetId` 가 truthy 라 skip. 의도는 multi-account-per-sheet 의 두 번째 등록자가 첫 등록자 이름 덮어쓰지 않게 막는 것이었으나, **시트 B3/C3 가 admin 복제 시 비어있는 경우** 까지 skip 되어 영원히 빈 채.

---

## Decision

### 규칙 1 — Sheets I/O boundary 에서 모든 셀 string 강제 정규화

`lib/repo/sheets-client.ts` 의 `readRange()` 가 반환 직전 모든 셀을 `String()` 으로 wrap. 함수 시그니처 `Promise<string[][]>` 가 실제 동작과 일치하게.

```ts
return (res.data.values ?? []).map((row) =>
  row.map((cell) => (cell == null ? "" : String(cell))),
);
```

호출자(parseRow 등) 는 추가 String() wrap 안 해도 안전. UNFORMATTED_VALUE 가 number/boolean 노출하는 자유를 코드 한 곳에서 흡수.

### 규칙 2 — 시트 권한 모델 v4 — admin Drive 폴더 + SA 폴더 권한 상속

- admin (leadbzcenter) 의 Drive 에 "세일즈PT 수강생 시트" 폴더 생성 + SA 를 editor 로 한 번 공유.
- 새 수강생 시트는 그 폴더 안에서 만들거나 만든 후 폴더로 이동.
- 폴더 권한이 자식 파일에 상속되어 SA 가 자동으로 writer 권한 보유.
- anyone-with-link sharing 은 SA 에 안 통하므로 의존 금지.

playbook (`docs/playbooks/setup-sheets.md`) 에 명시.

### 규칙 3 — `unstable_cache` 에 Date 객체 넣지 않기

`unstable_cache` 가 결과를 JSON 직렬화하므로 **JSON 직렬화 안전한 primitive** 만 캐시.

```ts
// ❌ 금지
unstable_cache(async () => ({ courseStart: someDate }), [...])

// ✅ 권장
unstable_cache(async () => ({ courseStartMs: someDate.getTime() }), [...])
// 호출자: new Date(bundle.courseStartMs)
```

Date 외에도 Map, Set, RegExp, function, undefined 같이 JSON-unsafe 한 값 모두 금지. cache wrapper 가 primitive 만 다루도록 설계.

### 규칙 4 — Impersonation 변경 시 `queryClient.clear()` 사용

`["me"]` 만 invalidate/remove 하면 trainee data hook 들 cache 가 남음. impersonation 전환은 명시적 context 전환이라 모든 client cache 비우는 게 의미상 정합.

3 entry points 모두 동일 패턴:
- `AdminUserPicker.pick()` (admin → trainee)
- `TrainerLanding.pick()` (trainer → 담당 trainee)
- `ImpersonationBanner.clear()` (impersonation 해제)

```ts
queryClient.clear();
router.push("/dashboard");
```

새 trainee data hook 이 추가돼도 별도 변경 없이 자동 적용 — Hashimoto 적용.

### 규칙 5 — deploy.yml BUILD_ID 가드 + heap 2GB

```yaml
export NODE_OPTIONS="--max-old-space-size=2048"  # VPS RAM 3.8GB 안전.
rm -rf .next
npm run build
test -f .next/BUILD_ID || { echo "BUILD_ID 누락"; exit 1; }
pm2 restart salespt-log --update-env
```

`npm run build` exit code 외에 BUILD_ID 명시 검증 → OOM 으로 빌드 중간에 죽어도 pm2 restart 차단 → 옛 빌드로 silent fallback 방지.

### 규칙 6 — claimAccount writeProfile 멱등 동작

```ts
if (!existingSheetId) {
  await writeProfile(spreadsheetId, cohortTrim, name);
} else {
  // prep row 매칭 시에도 시트 B3/C3 가 비어있으면 채움.
  const profile = await readProfile(spreadsheetId);
  if (!profile.cohort || !profile.name) {
    await writeProfile(spreadsheetId, cohortTrim, name);
  }
}
```

빈 셀만 채움 → multi-account 보호 의도 유지하면서 prep skip 함정 봉쇄.

---

## Consequences

### Positive
- ✅ Sheets cell 타입 거짓말로 인한 사고 차단 (규칙 1)
- ✅ 신규 수강생 시트 SA 권한 자동 상속 (규칙 2 playbook)
- ✅ Date/Cache boundary 함정 명시 (규칙 3)
- ✅ Impersonation 시 stale cross-trainee 데이터 표시 방지 (규칙 4)
- ✅ deploy silent failure 방지 (규칙 5)
- ✅ prep 케이스에서 시트 헤더 자동 채움 (규칙 6)

### Negative
- ❌ `readRange` 가 모든 셀 String 변환 — 숫자 셀이 필요한 호출자는 명시 `Number()` 캐스트 필요 (영향 받는 caller 검토 끝, 모두 안전)
- ❌ `queryClient.clear()` 가 admin 페이지 데이터까지 비워서 1회 fetch 추가 (latency 미미)
- ❌ deploy heap 2GB 가 향후 코드 증가로 부족할 수 있음 — swap 확장 권장

### Neutral
- 🔄 cache wrapper 패턴이 한 가지 늘어남 (Date ↔ ms 변환 boilerplate)

---

## Implementation Notes

이 ADR 의 6개 규칙은 같은 PR `fix/post-incident-hardening-2026-05-13` 에서 일괄 적용. 개별 규칙별 적용 PR 은 다음과 같이 분리:

| 규칙 | PR | 커밋 |
|---|---|---|
| 1 (string 정규화) | #158 | c1255d7 |
| 2 (v4 권한) | 운영 작업 (PR 아님) | — |
| 3 (Date→ms 캐시) | #161 | 42e9450 |
| 4 (queryClient.clear) | #163 | 8d6b3ed merge |
| 5 (deploy 가드) | #162 | 907af17 merge |
| 6 (writeProfile 멱등) | 이 PR | — |

### 사고 회피 체크리스트 (다음 Claude 세션용)

비슷한 증상 만났을 때 5분 안에 후보 좁히는 진단 체크:

1. **/api/me 500 + error 가 함수 호출 실패** ("getFullYear is not a function", "X is not iterable") → cache 에 직렬화 불가능 객체 의심. 규칙 3.
2. **/claim 무한루프 + 오류 메시지 없음** → parseRow null 가능성. raw sheet row 의 typeof 확인. 규칙 1.
3. **"The caller does not have permission" on write** → SA writer 누락. 폴더 권한 상속 확인. 규칙 2.
4. **PR 머지했는데 fix 안 들어간 듯** → deploy job 로그 확인. BUILD_ID 검증 통과했나. 규칙 5.
5. **trainee 본문이 안 바뀜 (헤더만 바뀜)** → React Query cache 잔존. 규칙 4.
6. **시트 B3/C3 빈 채로 헤더 깨짐** → prep skip. 규칙 6.

---

## References

- 사고 commits: c1255d7, 42e9450, (impersonation merge), (deploy merge), (이 PR)
- 운영 ground truth (2026-05-13): handoff 메모.
- Hashimoto 원칙: `CLAUDE.md` §0.

**Supersedes**: None  
**Superseded by**: None
