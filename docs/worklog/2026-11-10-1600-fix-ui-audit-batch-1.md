# 2026-11-10 16:00 fix/ui-audit-batch-1

- 목표: UI 점검 보고서 댓글 「바로 고칠 것」 6건 한 PR(검사 1회로 속도 개선, belie 「너 느려」).
- 담당 파일: 저장 문구 30곳(app·components), `components/ui/TimePicker15.tsx`·`TimeSelectPair.tsx`·`MoneyInput.tsx`(id), `components/auth/*`(용어·검색, 새 `trainee-search.ts`), `app/(app)/db-sheet/_components/feed-client.ts`·`ImportDialog.tsx`, `PaymentSlotForm.tsx`·`MeetingSlotForm.tsx`·`app/claim/page.tsx`(이름표), 시험.
- 검증: vitest 48건(새 9 + 관련), tsc. 실제 화면 NOT_RUN(로그인 필요).
- 계획: [ui-audit-batch-1](../plans/completed/ui-audit-batch-1.md)
- 위험/복구: 화면만, revert 1건.
