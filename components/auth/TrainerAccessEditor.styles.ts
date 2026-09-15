/** docs/design/tokens.md: rem density, 4px spacing scale, inherited app font.
 * Container queries follow the actual panel width, not the browser width.
 */
export const editorStyles = `
.trainer-access{--red:#d71617;--ink:#1f2937;--muted:#64748b;--line:#e5e7eb;container:trainer-access/inline-size;color:var(--ink);font-family:inherit;font-size:.875rem;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}
.trainer-access *{box-sizing:border-box}
.trainer-access button,.trainer-access select{font:inherit;color:inherit}
.trainer-access button{cursor:pointer;min-height:44px;padding:.5rem .75rem;border:1px solid var(--line);border-radius:.5rem;background:#fff;white-space:nowrap;flex-shrink:0}
.trainer-access button:hover{background:#f3f4f6}
.trainer-access button:disabled{cursor:not-allowed;opacity:.5}
.trainer-access :is(button,select,input):focus-visible{outline:3px solid #d7161780;outline-offset:3px}
.trainer-access .primary{background:var(--red);color:#fff;border-color:var(--red);font-weight:700}
.trainer-access .primary:hover{background:#b91213}
.trainer-access .account-email{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:max(.75rem,11px)}
.trainer-access .permission-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin:0 0 .75rem}
.trainer-access .permission-head>*{min-width:0}
.trainer-access .permission-head h1{margin:0;font-size:1.25rem;line-height:1.4;font-weight:700}
.trainer-access .permission-head p{margin:.25rem 0 0;color:var(--muted);font-size:.875rem}
.trainer-access .permission-layout{display:grid;grid-template-columns:minmax(13rem,1fr) minmax(0,2fr);gap:1rem;align-items:start;min-width:0}
.trainer-access .permission-list,.trainer-access .permission-editor{border:1px solid var(--line);border-radius:.75rem;background:#fff;min-width:0}
.trainer-access .permission-list{overflow:hidden}
.trainer-access .permission-list h2{font-size:.875rem;font-weight:700;margin:0;padding:.75rem;border-bottom:1px solid var(--line)}
.trainer-access .trainer-pick{display:flex;align-items:center;gap:.5rem;text-align:left;width:100%;min-width:0;border:0;border-radius:0;border-bottom:1px solid #f1f3f5;padding:.5rem .75rem;min-height:44px;white-space:normal}
.trainer-access .trainer-pick>span:first-child{min-width:0;flex:1}
.trainer-access .trainer-pick:last-child{border-bottom:0}
.trainer-access .trainer-pick[aria-pressed=true]{background:#fef2f2;box-shadow:inset 3px 0 var(--red)}
.trainer-access .trainer-pick strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.875rem;font-weight:700}
.trainer-access .trainer-pick small{display:block;font-size:max(.75rem,11px);color:var(--muted)}
.trainer-access .grade-tag{flex-shrink:0;margin-left:auto;white-space:nowrap;font-size:max(.75rem,11px);border:1px solid var(--line);padding:.125rem .375rem;border-radius:.375rem;background:#fff}
.trainer-access .permission-editor{padding:1rem}
.trainer-access .permission-editor h2{margin:0;font-size:1.125rem;line-height:1.4;font-weight:700}
.trainer-access .permission-eyebrow{font-size:max(.75rem,11px);color:var(--muted);margin-bottom:.25rem}
.trainer-access .permission-section{margin-top:1rem}
.trainer-access .grade-label{display:block;font-weight:700;margin-bottom:.375rem}
.trainer-access .permission-section select{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:.5rem;background:#fff;padding:.5rem .75rem}
.trainer-access .permission-note{font-size:max(.75rem,11px);color:var(--muted);margin:.5rem 0 0;line-height:1.5}
.trainer-access .permission-table{width:100%;border-collapse:collapse;margin-top:.5rem;table-layout:fixed}
.trainer-access .permission-table thead th{font-size:max(.75rem,11px);color:var(--muted);font-weight:500;text-align:center;background:#f8fafc}
.trainer-access .permission-table th:first-child{text-align:left;width:56%;padding-left:.5rem}
.trainer-access .permission-table th,.trainer-access .permission-table td{padding:.25rem .5rem;border-bottom:1px solid var(--line)}
.trainer-access .permission-table td,.trainer-access .permission-table tbody th{text-align:center;font-size:.875rem;font-weight:400}
.trainer-access .permission-table small{display:block;color:var(--muted);font-size:max(.75rem,11px)}
.trainer-access .permission-table input{width:18px;height:18px;accent-color:var(--red);cursor:pointer}
.trainer-access .permission-table label{display:flex;justify-content:center;align-items:center;min-width:44px;min-height:44px}
.trainer-access .permission-section-title{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
.trainer-access .permission-section-title h3{font-size:.875rem;font-weight:700;margin:0}
.trainer-access .permission-section-title button{font-size:max(.75rem,11px);padding:.375rem .5rem}
.trainer-access .permission-savebar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem;border-top:1px solid var(--line);padding-top:.75rem;margin-top:.75rem}
.trainer-access .permission-savebar>span{flex:1 1 12rem;font-size:max(.75rem,11px);color:var(--muted)}
.trainer-access .permission-savebar>div{display:flex;flex:0 0 auto;gap:.5rem;margin-left:auto}
.trainer-access .permission-scope{padding:.5rem .75rem;margin-top:.75rem;background:#f8fafc;border-radius:.5rem;font-size:max(.75rem,11px);line-height:1.5}
.trainer-access .permission-summary{padding:.75rem;background:#f8fafc;border-radius:.5rem;font-size:.875rem;white-space:pre-line;overflow-wrap:anywhere;margin:1rem 0}
.trainer-access .permission-admin-badge{border:1px solid var(--line);border-radius:.375rem;background:#fff;padding:.25rem .5rem;font-size:max(.75rem,11px);white-space:nowrap}
.trainer-access dialog{border:0;border-radius:.75rem;padding:1rem;width:28rem;max-width:calc(100% - 2rem);box-shadow:0 20px 80px #11182730}
.trainer-access dialog::backdrop{background:#11182760}
.trainer-access dialog h2{font-size:1.125rem;margin:0}
.trainer-access .dialog-actions{display:flex;gap:.5rem;justify-content:flex-end}
@container trainer-access (max-width:40rem){
 .trainer-access .permission-layout{grid-template-columns:1fr;gap:.75rem}
 .trainer-access .permission-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
 .trainer-access .permission-list h2{grid-column:1/-1}
 .trainer-access .trainer-pick{padding:.5rem;gap:.25rem}
 .trainer-access .permission-savebar>span{flex-basis:100%}
 .trainer-access .permission-savebar>div{width:100%}
 .trainer-access .permission-savebar button{flex:1}
}
@container trainer-access (max-width:20rem){
 .trainer-access .permission-list{grid-template-columns:minmax(0,1fr)}
 .trainer-access .permission-editor{padding:.75rem}
}
`;
