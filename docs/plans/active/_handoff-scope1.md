# 🤝 핸드오프 — Scope 1 (Drive 바로가기 + UI 정리) 착수 프롬프트

> ⚠️ **업데이트 (PR #251 머지 후, 2026-06)**
> - **기획 문서 7개 + 이 handoff 는 이미 master 에 배치 완료** (PR #251). → **§2 (문서 배치) 전부 SKIP.** 레포 `docs/` 에서 직접 읽으면 됨.
> - **기준 커밋 = 최신 `origin/master`** (PR #251 머지본, `2314ac6` 아님). worktree 는 `origin/master` 에서 딴다.
> - 정정 반영됨: 02 웹 쓰기 = **F~AH** (옛 F~AA 아님) · 5탭에 대시보드 없음(캘린더가 5번째, 대시보드는 헤더 버튼) · `findSheetByNamePrefix` 는 spreadsheet 전용 → **폴더용 신규 함수 필요**.
> - 시작: 아래 §0 self-check → §1 worktree(`origin/master` 기준) → **§3 구현부터**.

> **이 파일을 새 Claude Code 세션 첫 메시지로 붙여넣으세요.**
> 대상 레포: `dev-harness`(=github.com/bbelieff/salespt-log) · OS: Windows / Git Bash(MINGW64)
> 기준 커밋: **최신 `origin/master`** (PR #251 머지본). 새 스콥은 이 위에 worktree로 쌓는다. *(원래 `2314ac6` 였으나 #251 머지로 갱신됨.)*

---

## 0) 시작 전 — 환경 self-check (첫 명령)
```bash
cd "/c/Users/belie/Desktop/Belief/클로드/dev-harness" && \
git fetch origin && git log origin/master --oneline -1 && \
gh auth status && \
([ -f .env.local ] && echo ".env.local OK" || echo "MISSING .env.local")
```
기대: 최신 커밋에 `2314ac6`가 보이고, gh 로그인(account: bbelieff)·`.env.local OK`. 하나라도 어긋나면 멈추고 사용자에게 보고.

## 0.5) 먼저 읽을 것 (정본)
- `CLAUDE.md` (개발 하네스 규약 — 자동 로드되지만 §3-4 worktree, PR 게이트, SSOT 4문서, 문서요약카드 규칙을 숙지).
- 기획 정본(아직 레포에 없으면 1단계에서 배치): `practice-and-drive.md`(Plan v6), `adr-001/002/003`, `design-practice-and-drive.md`.
- 시각 정본(목업): `practice-payment-mockup.html`, `calendar-todo-mockup.html`.

## 1) 워크트리 + 브랜치
> CLAUDE.md §3-4: 로컬 main 직접수정 금지, `wt/<slug>/` 워크트리 필수. (레포에 워크트리 헬퍼 스크립트가 있으면 그것 우선.)
```bash
git fetch origin
git worktree add -b feat/practice-drive-shortcut wt/practice-drive-shortcut origin/master
cd wt/practice-drive-shortcut
```

## 2) 기획 문서를 레포에 배치 (코드 변경 전 필수)
> pre-commit 훅이 **plan 없는 lib/app 변경을 차단**한다. 그러니 문서부터 넣고 docs-only 커밋.
1. **Plan** → `docs/plans/active/practice-and-drive.md` (레포의 `docs/plans/active/_TEMPLATE.md` 형식에 맞춰 다듬기).
2. **ADR 3종** → `docs/decisions/`에 **새 번호로**(기존 0001/0002/0003/0005 사용 중, **0004 결번**):
   - `0006-practice-data-model.md` (= adr-001, ToDo는 신규 `05 실무투두` 탭)
   - `0007-drive-link-permission.md` (= adr-002)
   - `0008-tab-label.md` (= adr-003)
3. **Design** → `docs/plans/active/` 또는 `docs/design/`에 배치.
4. **모든 .md 상단에 "문서 요약 카드" 추가** (없으면 PR 반려). 형식(기존 `docs/decisions/0005-*.md` 그대로):
   ```
   > **📄 이 문서는 무엇인가요?**
   > - **한 줄 요약**: …
   > - **누가 읽나요**: …
   > - **어떤 기능·작업과 연결?**: …
   > - **읽고 나면 알 수 있는 것**: …
   > - **관련 문서**: …

   - **Status**: accepted
   - **Date**: 2026-06
   - **Supersedes**: 없음
   ```
5. 플러그 임시버튼은 `docs/future/extensions.md`에 "Scope 3에서 제거" 한 줄 추가(YAGNI 추적).
6. docs만 먼저 커밋: `git add docs && git commit -m "docs(practice): scope1 plan + ADR 0006-0008"`.

## 3) Scope 1 구현 (정본 = Plan §8 Scope 1, §6, §4b, 부록 A/D/G)
**a. 레지스트리 drive 칸** — 마스터 `SHEETS_REGISTRY_ID`의 `users` 탭에 `drive_parent_path`, `feedback_folder_id` (+선택 `drive_link_status`, `drive_linked_at`). → `lib/repo/users.ts` + `SHEET_RANGES`(lib/config) + `docs/domains/sheet-structure.md` 등재. Zod 타입 + `docs/domains/data-model.md` 등재.

**b. 온보딩 입력** — `app/api/setup/route.ts`(+온보딩 UI)에 **Drive 부모 폴더 경로/URL** 입력받아 registry 저장.

**c. 폴더 탐색 (주의)** — `01 피드백업체`는 **폴더**다. 기존 `lib/repo/drive-client.ts`의 `findSheetByNamePrefix`/`findSheetByExactName`은 **`mimeType=spreadsheet` 전용**이라 폴더엔 못 쓴다. → 같은 패턴으로 **폴더용 신규 함수**(`mimeType='application/vnd.google-apps.folder'`, 부모 폴더 하위 `name contains` prefix) 추가 → `01` prefix 매칭 → `feedback_folder_id` 저장.

**d. 요약카드 버튼** — 실무/수납 페이지 요약카드: 누적 수납/승인 **중앙** + **[Drive 바로가기]**(`https://drive.google.com/drive/folders/{feedback_folder_id}`) + **[플러그 바로가기]**(`https://www.pluuug.com/`, **임시**). 둘 다 `target="_blank" rel="noopener"`. 새 컴포넌트는 `docs/design/components.md` 먼저 등재. (목업 `practice-payment-mockup.html` 참고.)

**e. 명칭 변경 (§4b)** — 탭 라벨 `수납`→`실무/수납`(**아이콘 코인+$ 유지**; `components/TabBar.tsx` + `docs/design/prototypes/`·`preview.html` 동기화 → ADR-0008). 배너 제목 `계약수납`→`실무/수납`. 슬롯 섹션 `💰 수납 현황`→`📈 실무 진행`, 칩 `수납 N`→`진행 N`(`수납 추가`→`진행 추가`), 체크박스 섹션 `📋 실무 진행`→`📋 계약 후 프로세스`, 슬롯 필드 라벨 `진행내용`→`현황`(데이터 키는 그대로 `현황`).

**f. 배너 시트참조 제거 (부록 D)** — 공용 헤더의 `pageSubtitle`(예: "02 계약수납관리") 5탭에서 제거(또는 미렌더).

**g. 실패 UX** — 폴더 탐색 실패/권한오류 시 **[다시 연결]** + 안내. (근본 원인은 6번 선결사항.)

> 색/토큰: Scope 1엔 새 색 거의 없음. 실무 진회색 `#334155`는 **Scope 2(캘린더)** 용 → 이번엔 추가 불필요. 새 컴포넌트만 components.md 등재.

## 4) 게이트 + PR
```bash
npm run check    # typecheck · lint · test:structural · test · ≤500줄 · doc-drift — 전부 초록이어야 함
gh pr create --fill --base master
```
하나라도 빨가면 PR 금지. 디자인 변경했으면 `preview.html` 동기화 확인.

## 5) ⚠️ 코드 밖 선결사항 (belie 직접, 코드로 해결 불가)
- **SA(`GOOGLE_SERVICE_ACCOUNT_EMAIL`)를 각 수강생 Drive 부모 폴더에 최소 `viewer`로 공유**해야 폴더 탐색이 동작. 현재 코드는 Sheets만 SA로 접근. Drive 폴더 권한은 시트 밖이라 레포에서 확인 불가. → 공유 안 돼 있으면 (c)/(d)는 권한오류 → (g) [다시 연결]로 graceful 처리하되, 정상화는 공유 설정이 전제.

## 6) 범위 밖 (이번 스콥에서 건드리지 말 것)
- `02 계약수납관리`·`04 업체관리` 구조/수식 (불변; 슬롯 값 쓰기는 기존 **`F~AH`**만 — 옛 표기 `F~AA` 아님, 정본 `lib/repo/contract-payment.ts`).
- `05 실무투두` 탭 신설 + 슬롯 ToDo + Pluuug 팝업 = **Scope 2**.
- 캘린더 표시(미팅+투두) = **Scope 2**.
- 기관진행 통합 뷰 + 플러그 버튼 제거 = **Scope 3**.

## DoD
등록 수강생이 요약카드 **[Drive 바로가기] 1클릭으로 `01 피드백업체` 폴더가 새 탭에 열림**; §4b 명칭·부록 D 배너 정리 반영; `npm run check` 초록; PR 생성됨.
