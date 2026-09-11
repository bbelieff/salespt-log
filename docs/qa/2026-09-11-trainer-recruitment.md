# Trainer recruitment — investigation and partial verification

Status: PARTIAL. No application/invitation feature release. Base 9c5a7b8a9cef641825a1424cfa2dc8e1347a2cdb.

## Product flow to implement

1. Direct entry: login page and a logged-in student's account area expose `트레이너 신청`. Existing students do not need a second Google account. The authenticated applicant sees their application state and can keep using their existing student workspace while pending.
2. Invitation entry: permitted issuer uses `초대 링크 만들기` on the trainer page; recipient authenticates and explicitly accepts on the invitation screen. Login and account-switching preserve the invitation destination. Opening a link alone must never grant membership.
3. Approved dual-role account: explicit `트레이너 관리` / `내 수강 일지` transition. Resolve the user's own current/archived/arena registration by authenticated identity; do not infer ownership from name alone or repurpose an impersonation target.
4. Neither application rejection nor trainer removal may delete or suspend a student's existing registration/history. Trainer access remains limited to assigned students; membership does not grant administration or management-department privileges.

## Storage/authorization integration requirements

Existing generic registration must not be used unchanged:

- `claimAccount`: existing user short-circuit prevents a student's trainer application.
- `pickPreferredUser`: even pending trainer rows win over active student rows; this would block student access in `(app)/layout.tsx`.
- `approveTrainer` and email-based mutation selection: explicitly select the trainer application/membership. Never mutate a student's status as an indirect result of its preferred row.
- `users-delete`: inspect rejection/removal before connecting new membership. Email-wide deletion is not an acceptable trainer-only revoke.
- `loadMe` / arena self view: current switch only resolves arena records. Ordinary course history needs an explicit own-registration resolver throughout read and write paths, not just a different button label.
- Registry writes currently use Sheets then async DB mirroring; registry reads may use DB with Sheets fallback. A DB-only active membership insert would not by itself establish a safe durable source of truth. The final implementation must choose and verify one explicit membership authority, without introducing new synchronous Sheets request writes or changing rollout flags.

Preferred direction to review: an application record separate from the student registration; approved trainer membership independent of the student's cohort/sheet record. Reuse legacy trainer approval state through an explicit compatibility path. Exact persistence migration and activation policy are not implemented by this partial change.

Invitation integrity requirements (regardless of issuer policy): server-generated unguessable invite, store only its digest, expiry/revocation, atomic single-use redemption bound to the authenticated acceptor, idempotent same-user retry and conflict for another acceptor. Generate/share from UI only; never auto-send email/Slack invitations. Do not put real invitation values into logs or artifacts.

## Implemented common login path

- Middleware keeps a validated internal return destination.
- Home page honors that destination before ordinary role landing, but does not grant roles.
- LoginScene passes it to Google sign-in. Missing/unsafe values retain `/` default.
- Destination utility rejects external/protocol-relative URLs, traversal, backslashes, malformed/control escapes, duplicate values and loop/API endpoints.
- Unit/integration regression: 39 PASS, including actual middleware response and server home-page routing with mocked identities; this is not a live OAuth test.
- Final full check.sh: PASS (structural40 PASS/1 skip; unit1749 PASS/33 skip). Final focused regression: 39 PASS.
- Next build: PASS. Initial typed-route error was corrected using a validated Route cast; an overlapping tsc run observed transient missing generated files and was not counted as passing evidence. Final sequential full check passed after build.
- PC1440x900/mobile390x844: existing login screen renders with the requested application destination in URL; Google button visible, mobile horizontal overflow false. Screenshots inspected. No recruitment form exists yet.
- Real browser protected-entry/OAuth: NOT_RUN/BLOCKED_AUTH. Local NextAuth reports UntrustedHost; direct `/trainer/apply` reaches 404 (the application page is not implemented). Middleware destination behavior is verified only by mocked-auth integration tests, not this browser observation. No trust configuration, credentials, session cookies or production data were changed.

## Pending user decision

DH's question in Slack thread1789104258.500019: who may create invitations, and whether acceptance immediately activates trainer access or awaits admin approval. No answer observed as of implementation preparation. Existing direct applications retain admin approval. No policy decision was inferred from waiting.

## Release evidence

No production database/environment mutation, live account write, real invitation, merge or deployment performed. Full direct-apply/invitation/member-switch acceptance remains NOT_RUN. Do not close the feature based on this login patch.

Framework references used for the common login implementation: [Next.js async page searchParams](https://nextjs.org/docs/app/api-reference/file-conventions/page), [Auth.js client signIn implementation](https://github.com/nextauthjs/next-auth/blob/main/packages/next-auth/src/react.tsx). Installed package versions, not latest-site examples, determine API compatibility.
