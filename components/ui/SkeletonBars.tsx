/**
 * SkeletonBars — 불러오는 동안 글자 대신 회색 줄로 자리를 먼저 잡는다(효과 ① 스켈레톤, belie 2026-10-28).
 * 화면 읽기 프로그램에는 label 을 읽어 준다. 동작 줄이기면 반짝임 없이 회색 줄만(.fx-skeleton).
 */
export default function SkeletonBars({ label, rows = 2, className = "" }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={`space-y-2 ${className}`}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className={`fx-skeleton h-3 rounded-md ${i % 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
