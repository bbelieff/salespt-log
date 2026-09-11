# Trainer recruitment — 2026-09-11

User request: direct applications and trainer-page invitation links for both former/current students and people without a student account. Preserve recruitment intent through login and retain existing student access.

Owner: OG, Slack thread 1789104258.500019. Base: 9c5a7b8a9cef641825a1424cfa2dc8e1347a2cdb. Dedicated branch feat/trainer-recruitment-entry. Apply canonical checkout's 2026-09-09 AGENTS.md/CLAUDE.md instructions; do not restore old role/absolute-path ceremony from origin.

## Findings

- lib/service/auth.ts claimAccount returns existing non-archived users before its trainer branch.
- middleware.ts discards the protected destination; LoginScene always requests callback `/`; app/page.tsx applies role landing unconditionally.
- user-priority.ts prefers even pending trainer rows over student rows. App layout then blocks pending identities. Merely appending a pending trainer row can suspend existing student access.
- Existing trainer/student rows and arena-self toggles are reusable foundations, but current own-view lookup is arena-only. Ordinary current/archived student records must also remain usable.
- Admin approval and deletion currently use email-selected user rows. New recruitment persistence must not accidentally approve, reject, delete, or rekey the student's row.

## Work

- [x] Preserve validated internal login destinations without granting permissions or changing default landing. Common patch only: 39 focused checks, full check.sh, Next build PASS.
- [ ] Dedicated direct application UI, including existing students; retain existing admin approval policy.
- [ ] Invitation creation/acceptance UI and persistence after issuer/activation policy is resolved by the pending DH question.
- [ ] Separate application status from student access; explicitly select trainer membership and own student context for mutations.
- [ ] Verify current/archived/arena/nonstudent, pending/active, account switching, duplicate requests and expired/revoked/reused invitations.
- [ ] Full check.sh, Next build, PC/mobile browser, CI; distinguish mocks from authenticated production verification.

## Pending product decision

DH asked who may issue invitations and whether acceptance grants immediate active trainer access. No answer observed yet. Do not infer approval from elapsed time. Invitation grant mutations await that decision; destination-preservation work is independent.

DB application, environment changes and deployment are not authorized by this local preparation. Prepare reviewable changes before requesting any necessary final execution approval; do not reuse unrelated weekly-goals authorization.
