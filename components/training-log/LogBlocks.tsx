/** 트레이닝일지 본문 블록 그리기 — 서버가 줄인 노션 블록(LogBlock)만 다룬다. */
import type { ReactNode } from "react";
import { Paperclip } from "lucide-react";
import type { LogBlock, LogText } from "@/types/training-log";

/** 노션 색 → 클래스. 글자색 `tlog-c-*`, 배경색 `tlog-bg-*`(색 값은 training-log.css 의 토큰). */
const tone = (t: { color?: string; bg?: string }, base = "") =>
  [base, t.color && `tlog-c-${t.color}`, t.bg && `tlog-bg-${t.bg}`].filter(Boolean).join(" ") || undefined;

export function Rich({ text }: { text: LogText[] }): ReactNode {
  return text.map((t, i) => {
    let node: ReactNode = t.text;
    if (t.code) node = <code>{node}</code>;
    if (t.bold) node = <strong>{node}</strong>;
    if (t.italic) node = <em>{node}</em>;
    if (t.strike) node = <s>{node}</s>;
    if (t.underline) node = <u>{node}</u>;
    if (t.bg) node = <mark className={`tlog-bg-${t.bg}`}>{node}</mark>;
    if (t.href) node = <a href={t.href} target="_blank" rel="noopener noreferrer">{node}</a>;
    return <span key={i} className={tone({ color: t.color }, t.mention ? "tlog-mention" : "")}>{node}</span>;
  });
}

function Children({ blocks }: { blocks?: LogBlock[] }) {
  return blocks?.length ? <LogBlocks blocks={blocks} /> : null;
}

const plain = (text: LogText[]) => text.map((t) => t.text).join("");

function Table({ b }: { b: LogBlock }) {
  return <div className="tlog-table"><table><tbody>{(b.rows ?? []).map((row, r) => <tr key={r}>{row.map((cell, c) => {
    const head = (b.headRow && r === 0) || (b.headCol && c === 0);
    return head ? <th key={c} scope={b.headRow && r === 0 ? "col" : "row"}><Rich text={cell} /></th> : <td key={c}><Rich text={cell} /></td>;
  })}</tr>)}</tbody></table></div>;
}

function CalloutIcon({ b }: { b: LogBlock }) {
  // eslint-disable-next-line @next/next/no-img-element -- 노션 아이콘 주소(만료될 수 있음)라 next/image 대상이 아니다
  if (b.iconUrl) return <img className="tlog-callout-icon" src={b.iconUrl} alt="" />;
  return b.icon ? <span className="tlog-callout-icon" aria-hidden>{b.icon}</span> : null;
}

function One({ b }: { b: LogBlock }) {
  const kids = <Children blocks={b.children} />;
  switch (b.type) {
    case "h1": return <><h3 className={tone(b, "tlog-h1")}><Rich text={b.text} /></h3>{kids}</>;
    case "h2": return <><h4 className={tone(b, "tlog-h2")}><Rich text={b.text} /></h4>{kids}</>;
    case "h3": return <><h5 className={tone(b, "tlog-h3")}><Rich text={b.text} /></h5>{kids}</>;
    case "h4": return <><h6 className={tone(b, "tlog-h4")}><Rich text={b.text} /></h6>{kids}</>;
    case "todo": return <div className={tone(b, b.checked ? "tlog-todo tlog-done" : "tlog-todo")}><input type="checkbox" checked={!!b.checked} readOnly disabled aria-label={b.checked ? "완료" : "미완료"} /><div><span className="tlog-todo-text"><Rich text={b.text} /></span>{kids}</div></div>;
    case "toggle": return <details className={tone(b, "tlog-toggle")}><summary className={b.level ? `tlog-h${b.level}` : undefined}><Rich text={b.text} /></summary>{kids}</details>;
    case "quote": return <blockquote className={tone(b)}><Rich text={b.text} />{kids}</blockquote>;
    case "callout": return <div className={tone(b, "tlog-callout")}><CalloutIcon b={b} /><div className="tlog-callout-body"><Rich text={b.text} />{kids}</div></div>;
    case "divider": return <hr />;
    case "code": return <figure className="tlog-code">{b.lang && <figcaption>{b.lang}</figcaption>}<pre><code>{plain(b.text)}</code></pre></figure>;
    case "image": return <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- 노션 서명 주소(1시간 만료)라 next/image 최적화 대상이 아니다 */}
      <img src={b.url} alt={plain(b.text) || "일지 이미지"} loading="lazy" />
      {b.text.length > 0 && <figcaption><Rich text={b.text} /></figcaption>}
    </figure>;
    case "file": return <p><a className="tlog-attach" href={b.url} target="_blank" rel="noopener noreferrer"><Paperclip size={14} aria-hidden />{b.text.length ? <Rich text={b.text} /> : "첨부 파일"}</a></p>;
    case "link": return <a className="tlog-bookmark" href={b.url} target="_blank" rel="noopener noreferrer">
      {b.text.length > 0 && <span className="tlog-bookmark-title"><Rich text={b.text} /></span>}
      <span className="tlog-bookmark-url">{b.url}</span>
    </a>;
    case "table": return <Table b={b} />;
    case "columns": return <div className="tlog-columns">{(b.children ?? []).map((col, i) => col.type === "column"
      ? <div key={i} className="tlog-column" style={col.ratio ? { flexGrow: col.ratio } : undefined}><Children blocks={col.children} /></div>
      : <One key={i} b={col} />)}</div>;
    case "column": return kids;
    default: return b.text.length ? <><p className={tone(b)}><Rich text={b.text} /></p>{kids}</> : kids;
  }
}

/** 이어진 목록 항목은 한 목록으로 묶는다. */
export default function LogBlocks({ blocks }: { blocks: LogBlock[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type !== "ul" && b.type !== "ol") { out.push(<One key={i} b={b} />); continue; }
    const start = i;
    while (i + 1 < blocks.length && blocks[i + 1]!.type === b.type) i++;
    const lis = blocks.slice(start, i + 1).map((it, k) => <li key={k} className={tone(it)}><Rich text={it.text} /><Children blocks={it.children} /></li>);
    out.push(b.type === "ul" ? <ul key={start}>{lis}</ul> : <ol key={start}>{lis}</ol>);
  }
  return <>{out}</>;
}
