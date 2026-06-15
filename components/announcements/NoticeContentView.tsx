/**
 * NoticeContentView — 공지 본문 렌더 공용 진입점 (notice-rich-editor / ADR-0017).
 *
 * 값이 HTML(태그 포함)이면 RichContentView(소독 HTML), 아니면 기존 MarkdownView.
 * → 리치 에디터 이전의 마크다운 공지도 그대로 보임(하위호환). 팝업·보관함·관리자
 * 미리보기가 모두 이 컴포넌트를 써서 동일 렌더 보장.
 */
import { isHtmlContent } from "@/lib/notice-html";
import MarkdownView from "./MarkdownView";
import RichContentView from "./RichContentView";

export default function NoticeContentView({ content }: { content: string }) {
  return isHtmlContent(content) ? (
    <RichContentView html={content} />
  ) : (
    <MarkdownView markdown={content} />
  );
}
