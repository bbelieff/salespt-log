/**
 * Admin mutation 후 RSC 캐시 즉시 무효화 헬퍼.
 *
 * /admin/users 와 /admin/trainers 는 `revalidate = 30` 으로 30초 캐시.
 * mutation API endpoint 에서 이 함수를 호출하면 다음 navigation 부터 fresh
 * 데이터 — force-dynamic 없이도 즉시 반영.
 *
 * Render-safe — Server Component 의 render phase 에서 호출되면 Next.js 15+
 * 가 throw 한다 (production digest 크래시). 현재는 Route Handler 에서만
 * 호출되지만, 미래 server component 가 실수로 import 하면 사고 재현.
 * 비용 0 인 방어적 try/catch.
 * 참고: lib/repo/cohorts.ts invalidateCohorts() + lib/repo/users.ts
 * invalidateRegistry() 동일 패턴.
 */
import { revalidatePath } from "next/cache";

export function revalidateAdminPages() {
  // 각 path 를 개별 try/catch — 한 path 실패가 다른 path 무효화를 막지 않게.
  for (const path of ["/admin/users", "/admin/trainers", "/admin/cohorts"]) {
    try {
      revalidatePath(path);
    } catch {
      // Render context — 무시.
    }
  }
}
