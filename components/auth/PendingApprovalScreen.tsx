/**
 * PendingApprovalScreen — 승인 대기 안내 화면 (트레이너·수강생 공용).
 *
 * 사용처:
 *   - app/trainer/page.tsx : trainer + status=pending
 *   - app/page.tsx         : trainee + status=pending
 *
 * 사용자 액션: 로그아웃만 가능 (다른 진입 차단).
 */
import LogoutButton from "./LogoutButton";

export default function PendingApprovalScreen({
  subtitle = "관리자 승인 후 이용할 수 있습니다.",
}: {
  /** 역할별 추가 안내 한 줄 (수강생/트레이너 등). */
  subtitle?: string;
}) {
  return (
    <main className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mb-4 text-4xl">⏳</div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">승인 대기 중</h1>
        <p className="text-sm text-gray-500">{subtitle}</p>
        <div className="mt-6">
          <LogoutButton
            className="text-sm text-gray-700 underline-offset-2 hover:underline"
            label="로그아웃"
          />
        </div>
      </div>
    </main>
  );
}
