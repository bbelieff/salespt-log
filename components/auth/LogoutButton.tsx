/**
 * LogoutButton — 클라이언트 컴포넌트.
 * NextAuth 5 의 signOut() 직접 호출 (form POST → confirmation page 우회).
 * 서버 컴포넌트 페이지에서 import 해서 사용.
 */
"use client";

import { signOut } from "next-auth/react";
import { forgetPushOnThisDevice } from "@/query/push-hooks";

export default function LogoutButton({
  className,
  label = "로그아웃",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={async () => { await forgetPushOnThisDevice(); signOut({ callbackUrl: "/" }); }}
      className={
        className ??
        "text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
      }
    >
      {label}
    </button>
  );
}
