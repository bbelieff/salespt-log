/** 예정일시가 같은 다른 카드. 예약일·채널이 달라도 같은 일정이다. */
export interface TimedMeeting {
  id: string;
  미팅날짜: string;
  미팅시간: string;
  업체명: string;
}
export function meetingConflicts(pending: TimedMeeting[], saved: TimedMeeting[]): TimedMeeting[] {
  const pendingIds = new Set(pending.map((m) => m.id));
  const all = [...pending, ...saved.filter((m) => !pendingIds.has(m.id))];
  const matches = new Map<string, TimedMeeting>();
  for (const m of pending) {
    if (!m.미팅날짜 || !m.미팅시간) continue;
    for (const other of all) {
      if (other.id !== m.id && other.미팅날짜 === m.미팅날짜 && other.미팅시간 === m.미팅시간) {
        matches.set(m.id, m);
        matches.set(other.id, other);
      }
    }
  }
  return [...matches.values()];
}
