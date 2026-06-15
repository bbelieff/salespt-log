/**
 * RichContentView — 소독된 공지 HTML 렌더 (notice-rich-editor / ADR-0017).
 *
 * sanitizeNoticeHtml 로 화이트리스트 소독 후 dangerouslySetInnerHTML. 서버가 저장 시
 * 한 번 소독하지만 렌더 시 한 번 더(심층 방어 — 옛 데이터·우회 대비). .notice-rich 로
 * 목록/제목/하이라이트 스타일(Tailwind preflight 가 지운 list-style 등) 복원.
 */
import { sanitizeNoticeHtml } from "@/lib/notice-html";

export default function RichContentView({ html }: { html: string }) {
  const clean = sanitizeNoticeHtml(html);
  return (
    <div
      className="notice-rich text-sm text-gray-800"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
