/**
 * /admin/users — 수강생 관리 (Admin 전용).
 *
 * 한 화면에서:
 *   - **승인 대기 수강생** — status=pending. [승인]/[거절] 버튼.
 *   - 등록된 수강생 (기수별 그룹) — 활성 + 보관 + **유보**
 *   - 각자: 이름·이메일·기수·담당 트레이너(이름들)·시작일·종강일
 *   - "시트 열기" 버튼 → impersonation 진입.
 *   - "유보" 버튼 → registry B="유보" 설정 → 별도 섹션으로 이동.
 *   - 유보 섹션에서: "복귀" (B="") 또는 "퇴출" (row 물리 삭제).
 *
 * 유보(reserved) 도입 배경:
 *   마스터 본인 계정처럼 명단에서 안 보이게 하고 싶지만 row 자체는 살려두고 싶은
 *   trainee 가 있음 (테스트 계정, 임시 인원 등). "관리" 와 동일한 sentinel 패턴.
 *
 * **3단 Suspense 스트리밍 (BBE-249, A 설계서 §① — belie "즉각즉각" 요구 반영,
 * 2026-08-27)**: 이 파일은 권한 게이트만 담당하는 얇은 셸이다. 실제 데이터 fetch
 * 는 `_components/UsersRoster.tsx`(Tier 1, <1초 목표 — DB fast path 만)와
 * `_components/UsersStatsFill.tsx`(Tier 2, 느릴 수 있음 — 개인 시트 readBundle
 * 폴백 경유)로 나뉜다. Tier 1 이 resolve 되는 순간 이름·기수·상태 카드 뼈대가
 * 뜨고, Tier 2 가 늦게 끝나도 그 화면은 이미 떠 있다(스트리밍이 GRACE-밖 동기
 * 블로킹을 흡수 — profile-bundle-cache.ts 자체는 무변경).
 */
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionEmail, canViewAdminPages, isAdminEmail } from "@/auth/identity";
import UsersRoster from "./_components/UsersRoster";
import UsersSkeleton from "./_components/UsersSkeleton";

// **force-dynamic** — 매 요청마다 fresh registry 데이터.
// 이전엔 revalidate=30 이라 self-claim 직후 admin 이 새로고침해도 옛 데이터가
// 30초간 stuck — "수강생 요청관리 섹션이 안 보인다" 사고 (2026-05-12).
// 비용: Sheets API 호출이 매 진입마다 발생하지만 admin N명 한정이라 무부담.
// 데이터 layer 캐시(unstable_cache 60s)는 그대로 유지 — invalidateRegistry 가 처리.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) {
    redirect("/");
  }
  // 관리부서 멤버는 read-only.
  const viewOnly = !isAdminEmail(sessionEmail);
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersRoster sessionEmail={sessionEmail} viewOnly={viewOnly} />
    </Suspense>
  );
}
