/**
 * Layer: service — 유스케이스. Repo 조합 + 도메인 규칙.
 * UI/Runtime(API Route) 에서 호출하는 유일한 진입점이 되어야 한다.
 */
import { findUserByEmail } from "@/repo/users";

export async function resolveUser(email: string) {
  return findUserByEmail(email);
}

export { summarize, type Stats } from "./gamification";

// 컨택탭 유스케이스 (PR 2a)
export {
  loadDay,
  saveContactMetrics,
  appendNewMeeting,
  patchMeeting,
  removeMeeting,
  getMeetingById,
  type ContactDayView,
  type ChannelDailyRowMetrics,
} from "./contact";

// 일정·계약 탭 유스케이스 (PR 03)
export {
  loadWeekMeetings,
  type ScheduleWeekView,
} from "./contact";
