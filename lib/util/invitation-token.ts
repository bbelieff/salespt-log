export const INVITATION_STORAGE_KEY = "salespt-invitation-token";
export function readInvitationToken(value: unknown): string | null {
  if(typeof value!=="string")return null;
  const token=value.startsWith("#") ? new URLSearchParams(value.slice(1)).get("token") : value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
