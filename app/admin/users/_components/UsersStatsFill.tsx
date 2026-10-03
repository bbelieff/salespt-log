/**
 * /admin/users Tier 2 — 느릴 수 있는 구간 (BBE-249, A 설계서 §① Tier 2).
 *
 * `enrichUsersWithDates`+`enrichUsersWithStats` 는 registry 캐시컬럼이 비어있는
 * 학생마다 개인 시트 `readBundle`(SWR, 콜드일 수 있음)로 폴백한다 — 이 체인이
 * admin 콜드버스트(10초대)의 실제 원인(설계서 §0). Tier 1(UsersRoster)의 Suspense
 * 경계 밑에 두면, 이 구간이 느려도 이름·기수·상태는 이미 화면에 떠 있다.
 *
 * 완주 후에는 기존과 동일한 완전 상호작용 AdminUserPicker 를 그대로 렌더 —
 * 여기서 새 UI 를 만들지 않는다(중복·회귀 위험 최소화).
 */
import { enrichUsersWithDates, enrichUsersWithStats } from "@/service";
import AdminUserPicker from "@/components/auth/AdminUserPicker";
import { type Trainee, type Trainer } from "@/components/auth/AdminUserPickerTypes";

export default async function UsersStatsFill({
  regularTrainees,
  reservedTrainees,
  pendingUsers,
  activeTrainers,
  archivedLabels,
  sessionEmail,
  viewOnly,
}: {
  regularTrainees: Trainee[];
  reservedTrainees: Trainee[];
  pendingUsers: Trainee[];
  activeTrainers: Trainer[];
  archivedLabels: string[];
  sessionEmail: string;
  viewOnly: boolean;
}) {
  const enriched = await enrichUsersWithDates(regularTrainees);
  // readBundle(profile-bundle-cache.ts) 공유 SWR 캐시(FRESH 10분/GRACE 30분, BBE-249)라
  // enrichUsersWithDates 가 이미 fetch 한 경우 캐시 히트(별도 호출 0회).
  const withStats = await enrichUsersWithStats(enriched);

  return (
    <AdminUserPicker
      users={withStats}
      reservedUsers={reservedTrainees}
      pendingUsers={pendingUsers}
      activeTrainers={activeTrainers}
      sessionEmail={sessionEmail}
      archivedCohorts={archivedLabels}
      viewOnly={viewOnly}
    />
  );
}
