const destinations = {
  "/dashboard": "대시보드",
  "/db": "DB생산",
  "/contact": "컨택관리",
  "/schedule": "일정·계약",
  "/trainer/weekly-goals": "담당 수강생",
} as const;

export function goalReturnTarget(value?: string | null, trainer = false) {
  const href = value && Object.hasOwn(destinations, value)
    ? value as keyof typeof destinations
    : trainer ? "/trainer/weekly-goals" : "/dashboard";
  return { href, label: destinations[href] };
}
