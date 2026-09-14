---
status: active
created: 2026-09-14
owner: OG (existing owner)
issue: 958
---

# ACTIVE Plan — #958 Student ACL Wiring (+ bounded #956 header)

## Current correction — assignment is not an access prerequisite

- Owner/session/branch remain OG / `feat/958-student-acl-wiring`; PR [#968](https://github.com/bbelieff/salespt-log/pull/968).
- Starting head: `89f1cdac03f244cc1f228c267664e5886e42077f`.
- Approved #958 contract: saved grade/grants govern managed enrollment read/write without an additional assignedTrainer restriction.
- Scope: remove assignment prerequisite in `assertGoalStudentAccess` (including its internal-right calculation) and `listGoalStudents`; preserve assignment display data, actual admin/self boundaries, own-alias private denial, exact server-resolved enrollment, current enrollment selection/dedupe, and fail-closed read/write grants.
- Tests: unassigned/other-assigned granted roster/detail/public/private writes; denied or missing grants yield empty roster and 403 detail/writes with zero data calls; read-only grant denies writes; grant revocation and lookup failure fail closed. Legacy tests now use real saved-grant revocation rather than assignment revocation.
- Reproduction: prior service, new regressions **3 failed / 9 passed**. Initial corrected service/identity suites **100 passed**; subsequently added read-only and lookup-failure cases await fixed-head gates.
- Required gates: normal check.sh, fixed-head focused service/ACL tests plus retained header/browser regressions, next build, pushed-head CI, then DH independent re-review. Results belong to their exact SHAs; no new build/CI result is claimed here before execution.
- No data/migration/new writer/worktree/merge/deploy. Serial release criteria below remain mandatory. Current runtime correction supersedes the historical DOC ONLY scope below; historical UI-only results are not proof of this new ACL change.

## Historical documentation-only plan addition (89f1cdac)

**Status:** ACTIVE — DOC ONLY
**Issues:** #958 (weekly-goals ACL wiring) + bounded #956 (shared header correction)
**Owner:** Existing OG owner
**Branch:** `feat/958-student-acl-wiring`
**PR:** [#968](https://github.com/bbelieff/salespt-log/pull/968)
**Sole file allowed:** `docs/plans/active/958-student-acl-wiring.md`
**Runtime head (verified):** `65fde69e3839fd9d1d2a829e08d00c30166fbc65`
**Task ID:** salespt-956-cron-43e2abaeb78a

## 1. Objective

Add the missing ACTIVE plan doc for #958 without touching product code, preserving existing #958 weekly-goals ACL wiring and the bounded #956 shared-header correction.

## 2. Scope / Non-scope

**In scope:**
- Create sole file `docs/plans/active/958-student-acl-wiring.md`
- Record existing #958 wiring intent and #956 header bound
- Distinguish UI evidence below from a complete #958 security audit (not claimed)

**Out of scope (product untouched):**
- No code, data, credentials, or migrations changes
- No new test execution inferred
- No approvals inferred
- Do not close issue

## 3. Verified baseline (observed only, no re-execution)

- Focused: 118 pass
- Actual-component synthetic browser: 63 cases, widths 360/390/767/768/1023/1024/1440; scroll 400 → `bannerBottom=consumerTop=144` at 360/390; long Korean name glyph/marker/DDay fit
- Native check exit 0: structural 41, unit 2118 pass / 43 skip
- `next build` exit 0: static 73/73
- [CI 34811232759](https://github.com/bbelieff/salespt-log/actions/runs/34811232759) success: structural 40 pass / 1 skip, unit 2125 pass / 38 skip

UI evidence ≠ complete #958 security audit.

## 4. DOC ONLY change

1. Add only `docs/plans/active/958-student-acl-wiring.md` on `feat/958-student-acl-wiring` / PR #968.
2. Keep content to plan/status/evidence summary; no product edits.

## 5. Release gates (required, in order)

1. DH revalidate new doc head
2. Independent review = PASS
3. Explicit release authorization
4. Serial merge queue with no competing merge; confirm the reviewed PR head and current base before merge, revalidate any changed runtime bytes
5. Separately authorized deploy of the recorded merged SHA; require deployment workflow success, deployed-SHA match, health endpoint HTTP 200, and header/sticky/role/ACL functional verification. Health 200 alone does not prove functional acceptance; BLOCKED_AUTH must not be counted as PASS

## 6. Current status

| Step | State |
|---|---|
| Doc add | Added by this documentation-only change |
| DH revalidation | PENDING |
| Independent review | PENDING |
| Explicit release | PENDING |
| Merge | NOT_RUN |
| Deploy (merged SHA) | NOT_RUN |
| Health 200 + functional | NOT_RUN |
| Issue close | DO NOT CLOSE |

`BLOCKED_AUTH` tracked separately.

## 7. Rollback

Doc-only commit only: revert the single plan-doc commit; no product/data rollback needed.


## Documentation-only validation

The current change must contain only this plan path. The normal commit hook/check.sh must pass; product-tree equality against the verified runtime head is required. No new build is claimed for this documentation-only change: runtime bytes are unchanged. DH will revalidate the new commit head before release.
