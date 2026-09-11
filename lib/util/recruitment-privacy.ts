/** Invitation secrets must never reach analytics/referrer collection. */
export function isSensitiveRecruitmentUrl(value: string): boolean {
  try {
    const url=new URL(value,"https://local.invalid");
    if(url.pathname === "/trainer/invite") return true;
    const returnTo=url.searchParams.get("returnTo");
    return !!returnTo && new URL(returnTo,"https://local.invalid").pathname === "/trainer/invite";
  } catch {return false;}
}
