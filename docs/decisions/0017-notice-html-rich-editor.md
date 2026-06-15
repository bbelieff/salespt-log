# ADR-0017 — 공지 본문: 마크다운 → 리치 HTML + 소독

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 공지 본문 저장형식을 마크다운에서 리치 HTML(tiptap)로 바꾸고, XSS는 DOMPurify 화이트리스트 소독으로 막는다.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: 공지(announcement-popup), NoticeManager/RichNoticeEditor, lib/notice-html.ts
> - **읽고 나면 알 수 있는 것**: 왜 HTML로 격상했나, 보안 방어선은 무엇인가
> - **관련 문서**: docs/domains/announcement-popup.md, docs/design/components.md

- **상태**: accepted (2026-06-15)
- **맥락**: 공지를 굵게·밑줄·글씨색·형광펜·줄바꿈 등으로 꾸미고 싶다는 요구. 기존엔
  textarea 마크다운 + MarkdownView(react-markdown, raw HTML 미렌더 = 구조상 XSS 없음).

## 결정
- 작성기를 tiptap v3 headless 리치 에디터(`RichNoticeEditor`)로 교체. 출력 = **HTML 문자열**.
  (라이브러리 reactjs-tiptap-editor 1.x 는 drop-in `RichTextEditor`/`BaseKit` API 를
  제거 → headless(@tiptap/react useEditor + 자작 툴바)로 조립. belie 결정 2026-06-15.)
- 렌더는 `NoticeContentView` 공용 진입점: 값이 HTML 이면 `RichContentView`(소독 HTML),
  아니면 기존 `MarkdownView`(레거시 마크다운 공지 하위호환).
- 저장형식이 마크다운에서 HTML 로 바뀌어도 **옛 공지는 그대로 마크다운으로 렌더**
  (isHtmlContent 분기) — 마이그레이션 불필요.

## 보안 (격상: 'MD+무raw' → 'HTML+sanitize')
- 이제 HTML 을 허용하므로 **DOMPurify 소독이 유일한 방어선**. `lib/notice-html.ts`:
  - ALLOWED_TAGS = p,br,strong,b,em,i,u,s,mark,span,a,ul,ol,li,h1,h2,h3,img.
  - ALLOWED_ATTR = href,target,rel,src,alt,style. **style 은 color/background-color 만**
    (정규식 화이트리스트 — position·url()·expression 등 CSS injection 제거).
  - a 는 target=_blank rel="noopener noreferrer nofollow" 강제. javascript:·on* 제거.
- **심층 방어**: 서버 저장 직전(`saveNoticeAdmin`)에 1회 + 렌더 시(`RichContentView`) 1회
  소독. 클라만 신뢰하지 않음.
- 단위테스트(`tests/service/notice-html.test.ts`): script·img onerror·onclick·
  javascript:·style expression 제거 + 허용 서식 보존 + isHtmlContent.

## 대안
- 0.4.2(구버전 drop-in API) 고정: 스펙 일치하나 동결·React19 미보장 → 기각.
- 마크다운 유지: 색/형광펜 표현 한계 → 요구 미충족.
