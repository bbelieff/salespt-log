/**
 * RichNoticeEditor — 공지 리치 텍스트 에디터 (notice-rich-editor / ADR-0017).
 *
 * tiptap v3 headless(@tiptap/react useEditor) + 자작 툴바. 출력 = HTML 문자열을
 * onChange 로 부모(form.bodyMd)에 연결. 굵게·기울임·밑줄·삭선·글씨색·형광펜·
 * 목록·링크·이미지·서식지우기·undo/redo. 이미지는 기존 /api/admin/notice-image 재사용.
 * SSR 회피: 부모가 next/dynamic { ssr:false } 로 로드 + immediatelyRender:false.
 */
"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Heading from "@tiptap/extension-heading";
import { ListKit } from "@tiptap/extension-list";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { UndoRedo } from "@tiptap/extensions";

const EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  HardBreak,
  Bold,
  Italic,
  Underline,
  Strike,
  Heading.configure({ levels: [1, 2, 3] }),
  ListKit,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Link.configure({ openOnClick: false, autolink: true }),
  Image,
  UndoRedo,
];

const HILITES = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8"]; // 형광펜 4색

function Btn({
  on,
  active,
  label,
  title,
  disabled,
}: {
  on: () => void;
  active?: boolean;
  label: string;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={`h-8 min-w-8 rounded-md px-2 text-sm font-bold transition-colors disabled:opacity-40 ${
        active
          ? "bg-brand-red text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

export default function RichNoticeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value || "",
    immediatelyRender: false, // SSR hydration mismatch 방지
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "notice-rich min-h-32 rounded-b-lg border border-t-0 border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  async function uploadImage(file: File, ed: Editor) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/notice-image", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      ed.chain().focus().setImage({ src: data.url, alt: "이미지" }).run();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-gray-200 bg-gray-50 p-1.5">
        <Btn label="B" title="굵게" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()} />
        <Btn label="I" title="기울임" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()} />
        <Btn label="U" title="밑줄" active={editor.isActive("underline")} on={() => editor.chain().focus().toggleUnderline().run()} />
        <Btn label="S" title="취소선" active={editor.isActive("strike")} on={() => editor.chain().focus().toggleStrike().run()} />

        <span className="mx-0.5 h-5 w-px bg-gray-200" />

        {/* 글씨색 */}
        <label
          title="글씨색"
          className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-gray-100 px-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
          onMouseDown={(e) => e.preventDefault()}
        >
          A
          <input
            type="color"
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <Btn label="색해제" title="글씨색 해제" on={() => editor.chain().focus().unsetColor().run()} />

        {/* 형광펜 */}
        {HILITES.map((c) => (
          <button
            key={c}
            type="button"
            title="형광펜"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
            className="h-8 w-8 rounded-md border border-gray-200"
            style={{ backgroundColor: c }}
            aria-label={`형광펜 ${c}`}
          />
        ))}
        <Btn label="형광해제" title="형광펜 해제" on={() => editor.chain().focus().unsetHighlight().run()} />

        <span className="mx-0.5 h-5 w-px bg-gray-200" />

        <Btn label="• 목록" title="글머리 목록" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn label="1. 목록" title="번호 목록" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()} />
        <Btn label="제목" title="제목(H2)" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />

        <span className="mx-0.5 h-5 w-px bg-gray-200" />

        <Btn
          label="링크"
          title="링크"
          active={editor.isActive("link")}
          on={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("링크 URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href: url }).run();
          }}
        />
        <label
          title="이미지"
          className="flex h-8 cursor-pointer items-center rounded-md bg-gray-100 px-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
          onMouseDown={(e) => e.preventDefault()}
        >
          🖼
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f, editor);
              e.target.value = "";
            }}
          />
        </label>

        <span className="mx-0.5 h-5 w-px bg-gray-200" />

        <Btn label="지움" title="서식 지우기" on={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} />
        <Btn label="↶" title="실행 취소" disabled={!editor.can().undo()} on={() => editor.chain().focus().undo().run()} />
        <Btn label="↷" title="다시 실행" disabled={!editor.can().redo()} on={() => editor.chain().focus().redo().run()} />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
