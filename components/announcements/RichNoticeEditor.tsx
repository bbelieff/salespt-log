/**
 * RichNoticeEditor — 공지 리치 텍스트 에디터 (notice-rich-editor / ADR-0017).
 *
 * tiptap v3 headless(@tiptap/react useEditor) + 자작 툴바. 출력 = HTML 문자열을
 * onChange 로 부모(form.bodyMd)에 연결. 굵게·기울임·밑줄·삭선·글씨색·형광펜·
 * 목록·링크·이미지·서식지우기·undo/redo. 이미지는 기존 /api/admin/notice-image 재사용.
 * SSR 회피: 부모가 next/dynamic { ssr:false } 로 로드 + immediatelyRender:false.
 */
"use client";

import { useEffect, useRef, useState } from "react";
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
  // 인스턴스 ref — handlePaste/handleDrop 가 최신 editor 로 삽입하도록.
  const editorRef = useRef<Editor | null>(null);

  // 인라인 토스트(업로드 진행/실패 사유) — alert 대신 비차단 안내.
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (msg) toastTimer.current = setTimeout(() => setToast(""), 3500);
  }
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  /** clipboard text/html 의 <img src> 삽입 — data:URL 은 업로드, http(s) 는 직삽입. */
  async function insertFromUrl(src: string, ed: Editor) {
    if (src.startsWith("data:")) {
      try {
        const blob = await (await fetch(src)).blob();
        await uploadImage(
          new File([blob], "pasted.png", { type: blob.type || "image/png" }),
          ed,
        );
      } catch {
        notify("이미지를 가져오지 못했어요");
      }
    } else {
      // 외부 http(s) 이미지 — 일단 삽입(후속: 서버 재업로드 엔드포인트).
      ed.chain().focus().setImage({ src, alt: "이미지" }).run();
      console.warn("[notice] 외부 이미지 URL 직삽입(서버 재업로드 미적용):", src);
      notify("웹 이미지를 넣었어요(외부 링크)");
    }
  }

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
      // 클립보드 붙여넣기 — 이미지면 우리 API 로 업로드 후 임베드, 아니면 기본(텍스트) 유지.
      handlePaste(_view, event) {
        const cd = event.clipboardData;
        if (!cd) return false;
        // 1) 파일 — items + files 둘 다 확인(앱·브라우저별 소스 차이 폴백).
        const fromItems = Array.from(cd.items ?? [])
          .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
          .map((i) => i.getAsFile())
          .filter((f): f is File => !!f);
        const fromFiles = Array.from(cd.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        const files = fromItems.length ? fromItems : fromFiles;
        if (files.length && editorRef.current) {
          event.preventDefault();
          const ed = editorRef.current;
          files.forEach((f) => void uploadImage(f, ed));
          return true;
        }
        // 2) 웹 이미지(HTML 복사) — text/html 의 <img src> 추출.
        const html = cd.getData("text/html");
        const src = html
          ? /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1]
          : undefined;
        if (src && editorRef.current) {
          event.preventDefault();
          void insertFromUrl(src, editorRef.current);
          return true;
        }
        return false; // 텍스트 등은 기본 붙여넣기
      },
      // 드래그&드롭 이미지도 동일 처리.
      handleDrop(_view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => {
          if (editorRef.current) void uploadImage(f, editorRef.current);
        });
        return true;
      },
    },
  });
  editorRef.current = editor;

  // 외부 value 동기화 — 부모가 다른 공지를 선택하거나 저장 후 폼을 교체하면 value 가 바뀐다.
  // tiptap useEditor 는 content 를 최초 1회만 읽으므로, value 변경 시 setContent 로 반영.
  // 입력 중에는 onUpdate 가 value=현재HTML 로 맞춰두어 value===getHTML() → no-op(커서 보존).
  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  async function uploadImage(file: File, ed: Editor) {
    notify("이미지 올리는 중…");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/notice-image", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        ed.chain().focus().setImage({ src: data.url, alt: "이미지" }).run();
        notify("");
      } else {
        notify(
          res.status === 403
            ? "이미지를 올릴 권한이 없어요(관리자만)"
            : res.status === 413
              ? "이미지가 너무 커요(5MB 이하만)"
              : `이미지 업로드 실패: ${data.error ?? res.status}`,
        );
      }
    } catch {
      notify("이미지 업로드 실패 — 네트워크를 확인해 주세요");
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
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mt-1 inline-block rounded-md bg-gray-900/90 px-3 py-1.5 text-xs font-bold text-white"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
