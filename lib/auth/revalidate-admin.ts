/**
 * Admin mutation 후 RSC 캐시 즉시 무효화 헬퍼.
 *
 * /admin/users 와 /admin/trainers 는 `revalidate = 30` 으로 30초 캐시.
 * mutation API endpoint 에서 이 함수를 호출하면 다음 navigation 부터 fresh
 * 데이터 — force-dynamic 없이도 즉시 반영.
 */
import { revalidatePath } from "next/cache";

export function revalidateAdminPages() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/trainers");
}
