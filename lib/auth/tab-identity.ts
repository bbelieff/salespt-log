/**
 * 탭 신원 도장 — 저장 요청이 **이 탭이 처음 본 사람**으로 가는지 서버가 확인한다 (2026-11-10 UI 점검).
 *
 * IdentityGuard 는 30초마다·창 포커스 때만 신원 바뀜을 확인한다. 두 창을 나란히 쓰면 그 사이(최대 30초)
 * 저장이 다른 수강생 기록에 들어갈 수 있었다. 그래서 탭이 처음 받은 지문을 쓰기 요청 머리말에 싣고,
 * 서버(getWritableUserEmail)가 지금 지문과 다르면 거부한다. 머리말이 없으면(옛 탭·서버 호출) 검사하지 않는다.
 *
 * 이 파일은 클라이언트도 읽는다 — 머리말 이름만 둔다. 지문 계산(node:crypto)은 서버 전용 파일에.
 */
export const TAB_IDENTITY_HEADER = "x-salespt-tab-identity";

export const TAB_IDENTITY_MISMATCH =
  "[identity] 다른 탭에서 다른 분 화면으로 바뀌어 저장을 막았어요. 이 탭을 새로고침해 주세요.";
