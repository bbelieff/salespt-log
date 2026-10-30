/** 트레이닝일지 본문 블록 그리기 — 서버가 줄인 노션 블록(LogBlock)만 다룬다. */
import type { ReactNode } from "react";
import type { LogBlock, LogText } from "@/types/training-log";

export function Rich({ text }: { text: LogText[] }): ReactNode {
  return text.map((t, i) => {
    let node: ReactNode = t.text;
    if (t.code) node = <code>{node}</code>;
    if (t.bold) node = <strong>{node}</strong>;
    if (t.italic) node = <em>{node}</em>;
    if (t.strike) node = <s>{node}</s>;
    if (t.underline) node = <u>{node}</u>;
    if (t.highlight) node = <mark>{node}</mark>;
    if (t.href) node = <a href={t.href} target="_blank" rel="noopener noreferrer">{node}</a>;
    return <span key={i}>{node}</span>;
  });
}

function Children({ blocks }: { blocks?: LogBlock[] }) {
  return blocks?.length ? <LogBlocks blocks={blocks} /> : null;
}

const plain = (text: LogText[]) => text.map((t) => t.text).join("");

function One({ b }: { b: LogBlock }) {
  const kids = <Children blocks={b.children} />;
  switch (b.type) {
    case "h1": return <><h3 className="tlog-h1"><Rich text={b.text} /></h3>{kids}</>;
    case "h2": return <><h4 className="tlog-h2"><Rich text={b.text} /></h4>{kids}</>;
    case "h3": return <><h5 className="tlog-h3"><Rich text={b.text} /></h5>{kids}</>;
    case "todo": return <div className="tlog-todo"><input type="checkbox" checked={!!b.checked} readOnly disabled aria-label={b.checked ? "완료" : "미완료"} /><div><Rich text={b.text} />{kids}</div></div>;
    case "toggle": return <details className="tlog-toggle"><summary><Rich text={b.text} /></summary>{kids}</details>;
    case "quote": return <blockquote><Rich text={b.text} />{kids}</blockquote>;
    case "callout": return <div className="tlog-callout"><Rich text={b.text} />{kids}</div>;
    case "divider": return <hr />;
    case "code": return <pre><code>{plain(b.text)}</code></pre>;
    case "image": return <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- 노션 서명 주소(1시간 만료)라 next/image 최적화 대상이 아니다 */}
      <img src={b.url} alt={plain(b.text) || "일지 이미지"} loading="lazy" />
      {b.text.length > 0 && <figcaption><Rich text={b.text} /></figcaption>}
    </figure>;
    case "file": return <p><a href={b.url} target="_blank" rel="noopener noreferrer">📎 {b.text.length ? <Rich text={b.text} /> : "첨부 파일"}</a></p>;
    case "link": return <p><a href={b.url} target="_blank" rel="noopener noreferrer">{b.text.length ? <Rich text={b.text} /> : b.url}</a></p>;
    case "table": return <div className="tlog-table"><table><tbody>{(b.rows ?? []).map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><Rich text={cell} /></td>)}</tr>)}</tbody></table></div>;
    default: return b.text.length ? <><p><Rich text={b.text} /></p>{kids}</> : kids;
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
    const lis = blocks.slice(start, i + 1).map((it, k) => <li key={k}><Rich text={it.text} /><Children blocks={it.children} /></li>);
    out.push(b.type === "ul" ? <ul key={start}>{lis}</ul> : <ol key={start}>{lis}</ol>);
  }
  return <>{out}</>;
}
