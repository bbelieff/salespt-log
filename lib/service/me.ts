/**
 * Layer: service — 사용자 프로필 (헤더 표시용).
 *
 * SSOT: 사용자 개인 시트의 01 영업관리!B3:C3 (기수/이름).
 * 마스터 레지스트리(users 탭)는 spreadsheetId 매핑용일 뿐, 표시값은 시트가 SSOT.
 *
 * 사용처: TopHeader 컴포넌트 — 모든 탭 상단에 "{기수} {이름}" 표시.
 */
import { findUserByEmail } from "@/repo/users";
import { readProfile } from "@/repo/sales";

export interface MeProfile {
  email: string;
  cohort: string; // 예: "7기" (시트 B3)
  name: string; // 예: "김믿음" (시트 C3)
}

export async function loadMe(email: string): Promise<MeProfile> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[me] 사용자(${email})를 찾을 수 없습니다.`);
  }
  const profile = await readProfile(user.spreadsheetId);
  return {
    email: user.email,
    cohort: profile.cohort || user.cohort, // 시트 비어있으면 레지스트리 fallback
    name: profile.name || user.name,
  };
}
