/** Keep empty columns and quoted memo content; only remove empty surrounding lines. */
export function normalizeImportText(text:string):string {
 return text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n')
  .replace(/^(?:(?:[^\S\n]|[\u200B\u2060])*\n)+/,'')
  .replace(/(?:\n(?:[^\S\n]|[\u200B\u2060])*)+$/,'');
}
export const blankImportText=(value:string)=>/^[\s\u200B\u2060]*$/.test(value);

/** Read the first nonempty logical record, ignoring separators inside quoted cells. */
export function importTextFormat(text:string):{separator:string;firstRecord:string;offset:number;unterminated:boolean} {
 let quoted=false,start=true,content=false,from=0,end=text.length;
 const found=new Set<string>();
 for(let i=0;i<text.length;i++){
  const c=text[i]!;
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){content=true;i++;}else quoted=false;}
   else if(!blankImportText(c))content=true;
   continue;
  }
  if(c==='\n'||c==='\r'){
   if(content){end=i;break;}
   found.clear();from=i+1;start=true;continue;
  }
  if(c==='"'&&start){quoted=true;start=false;continue;}
  if(c==='\t'||c===','||c===';'){found.add(c);start=true;}
  else {if(!/\s/.test(c))start=false;if(!blankImportText(c))content=true;}
 }
 return {separator:['\t',',',';'].find(sep=>found.has(sep))||'',firstRecord:text.slice(from,end),offset:from,unterminated:quoted};
}
