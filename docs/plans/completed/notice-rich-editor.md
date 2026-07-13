---
status: completed
slug: notice-rich-editor
created: 2026-06-15
owner: belie
related: announcement-popup, notices-in-archive
completed: 2026-06-15
archived: 2026-07-12
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 공지 작성기를 리치 텍스트(tiptap)로 교체하고 본문을 소독된 HTML로 저장·렌더.
> - **누가 읽나요**: 개발자, belie
> - **어떤 기능·작업과 연결?**: NoticeManager, RichNoticeEditor, lib/notice-html.ts, 공지 렌더 전반
> - **읽고 나면 알 수 있는 것**: 에디터 구성, 보안 소독, 하위호환
> - **관련 문서**: docs/decisions/0017-notice-html-rich-editor.md, announcement-popup.md

# 공지 리치 에디터 + HTML 소독

## 결정 (belie 2026-06-15)
- reactjs-tiptap-editor 최신(1.0.24)이 drop-in `RichTextEditor`/`BaseKit` API 제거 →
  **1.x headless 조립**(@tiptap/react useEditor + tiptap 확장 + 자작 툴바) 선택.

## 구현
- **lib/notice-html.ts**: `sanitizeNoticeHtml`(DOMPurify 화이트리스트, style=color/bg만,
  a target/rel 강제) + `isHtmlContent`. isomorphic(클라+서버+테스트).
- **RichNoticeEditor**(client, @tiptap/react): 굵게·기울임·밑줄·삭선·글씨색·형광펜(4색)·
  목록·제목·링크·이미지(기존 /api/admin/notice-image)·서식지움·undo/redo. immediatelyRender:false.
- **RichContentView**: 소독 HTML 렌더(.notice-rich). **NoticeContentView**: HTML 분기→Rich,
  아니면 MarkdownView(레거시 하위호환).
- **NoticeManager**: textarea/미리보기 토글/옛 이미지버튼 제거 → RichNoticeEditor(dynamic ssr:false).
- **saveNoticeAdmin**: 저장 직전 서버 소독(심층 방어).
- 팝업·/updates·관리자 모두 MarkdownView→NoticeContentView.
- globals.css `.notice-rich`(목록/제목/하이라이트/링크/이미지 — Tailwind preflight 복원).

## 검증
- 단위테스트(notice-html): XSS 제거(script·onerror·onclick·javascript:·style expression)
  + 허용 서식 보존 + isHtmlContent.
- typecheck/lint/test/build green. 라운드트립·하위호환·캡쳐 색상은 라이브 확인.

## 상태
- 2026-06-15 완료(feat/notice-rich-editor).
