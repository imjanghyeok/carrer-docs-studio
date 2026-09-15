// Block operations mutate the existing DOM, never a separate document model.
export const blockKinds={paragraph:'본문',h1:'큰 제목',h2:'제목',h3:'작은 제목',bullet:'글머리 목록',numbered:'번호 목록',quote:'인용문',divider:'구분선'};
const textSelector='p,h1,h2,h3,h4,h5,h6,li,blockquote';
export function textBlock(node){
 const el=node?.closest(textSelector);
 if(!el||el.closest('figure,svg,table,.activity-chart')||el.querySelector('p,div,ul,ol,table,figure,svg,h1,h2,h3,blockquote'))return null;
 return el;
}
export function blockKind(node){const el=textBlock(node);if(!el)return '';return el.matches('li')?(el.parentElement.tagName==='OL'?'numbered':'bullet'):el.matches('p')?'paragraph':el.matches('blockquote')?'quote':el.tagName.toLowerCase();}
function resetIds(node){for(const el of [node,...node.querySelectorAll('*')]){el.removeAttribute('id');delete el.dataset.studioId;delete el.dataset.studioSelected;}}
function focus(editor,el){editor.instrument();editor.select(el,true);const target=el.matches('ul,ol')?el.firstElementChild:el;target?.focus();}
function make(doc,kind){
 const tag={paragraph:'p',bullet:'ul',numbered:'ol',quote:'blockquote',divider:'hr'}[kind]||kind;
 const node=doc.createElement(tag);
 if(kind==='bullet'||kind==='numbered')node.append(doc.createElement('li'));
 return node;
}
// Lift a converted list item while keeping the before/after items in order.
function replaceItem(item,replacement){
 const list=item.parentElement,after=list.cloneNode(false);resetIds(after);
 while(item.nextSibling)after.append(item.nextSibling);
 list.after(replacement);if(after.children.length)replacement.after(after);
 item.remove();if(!list.children.length)list.remove();
}
export function insertBlock(editor,kind){
 if(!blockKinds[kind])return false;
 editor.mutate(()=>{
  const node=make(editor.doc,kind),text=textBlock(editor.selected),target=text||editor.selected;
  if(target?.matches('li')){
   const list=target.parentElement;
   if((kind==='bullet'&&list.tagName==='UL')||(kind==='numbered'&&list.tagName==='OL')){const li=node.firstElementChild;target.after(li);focus(editor,li);return;}
   const marker=editor.doc.createElement('li');target.after(marker);replaceItem(marker,node);
  }else if(target?.matches('.page,main,section,article,div,header,footer,aside'))target.append(node);
  else if(target?.parentElement&&target!==editor.doc.body)target.after(node);
  else (editor.doc.querySelector('.page')||editor.doc.body).append(node);
  focus(editor,node.matches('ul,ol')?node.firstElementChild:node);
 });return true;
}
export function convertBlock(editor,kind){
 const old=textBlock(editor.selected);if(!old||!blockKinds[kind]||kind==='divider')return false;
 if(blockKind(old)===kind)return true;
 editor.mutate(()=>{
  const replacement=make(editor.doc,kind),target=replacement.matches('ul,ol')?replacement.firstElementChild:replacement;
  for(const attr of old.attributes)if(!['contenteditable','spellcheck','data-studio-selected'].includes(attr.name))target.setAttribute(attr.name,attr.value);
  while(old.firstChild)target.append(old.firstChild);
  if(old.matches('li'))replaceItem(old,replacement);else old.replaceWith(replacement);
  focus(editor,target);
 });return true;
}
export function removeBlock(editor){
 const el=textBlock(editor.selected)|| (editor.selected?.matches('hr')?editor.selected:null);if(!el)return false;
 editor.mutate(()=>{const next=el.nextElementSibling||el.previousElementSibling,parent=el.parentElement;el.remove();if(parent.matches('ul,ol')&&!parent.children.length)parent.remove();editor.selected=null;editor.onSelect(null);if(next?.isConnected)editor.select(next,true);});return true;
}
export function splitBlock(editor,event){
 const range=editor.doc.getSelection()?.rangeCount?editor.doc.getSelection().getRangeAt(0):null;
 const old=textBlock(event.target);if(!old||!range||!old.contains(range.startContainer)||!old.contains(range.endContainer))return false;
 event.preventDefault();editor.selected=old;
 if(old.matches('li')&&!old.textContent.trim()){convertBlock(editor,'paragraph');return true;}
 editor.mutate(()=>{
  range.deleteContents();const tail=editor.doc.createRange();tail.selectNodeContents(old);tail.setStart(range.startContainer,range.startOffset);
  const node=editor.doc.createElement(old.matches('li')?'li':'p');node.append(tail.extractContents());resetIds(node);
  old.after(node);focus(editor,node);
  const caret=editor.doc.createRange();caret.selectNodeContents(node);caret.collapse(true);const selection=editor.doc.getSelection();selection.removeAllRanges();selection.addRange(caret);
 });return true;
}
export const BLOCK_CSS=`
html[data-studio-mode=blocks] body{background:#f6f7f4!important;padding:24px 0!important}
html[data-studio-mode=blocks] .page{width:740px!important;height:auto!important;min-height:0!important;padding:36px 48px!important;margin:0 auto 20px!important;box-shadow:none!important;border:1px solid #e3e8e0!important;border-radius:10px!important;overflow:visible!important;break-after:auto!important}
html[data-studio-mode=blocks] .page :is(section,article,header,footer,main,aside,nav,div):not(figure *,svg *,.activity-chart,.activity-chart *){display:block!important;position:static!important;transform:none!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;margin:8px 0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important;columns:auto!important}
html[data-studio-mode=blocks] :is(p,h1,h2,h3,h4,h5,h6,li,blockquote):not(figure *,svg *,.activity-chart *){position:static!important;transform:none!important;float:none!important;width:auto!important;height:auto!important;max-height:none!important;min-height:1.7em!important;line-height:1.8!important;text-align:left!important;letter-spacing:normal!important;white-space:normal!important;color:#29392e!important;font-family:system-ui,sans-serif!important}
html[data-studio-mode=blocks] :is(p,li,blockquote):not(figure *,svg *){font-size:15px!important;margin-top:8px!important;margin-bottom:8px!important}
html[data-studio-mode=blocks] h1{font-size:28px!important}html[data-studio-mode=blocks] h2{font-size:22px!important}html[data-studio-mode=blocks] :is(h3,h4,h5,h6){font-size:18px!important}
html[data-studio-mode=blocks] blockquote{border-left:3px solid #aec5b6!important;padding-left:16px!important;margin-left:0!important}
html[data-studio-mode=blocks] [contenteditable=true]:empty:before{content:'내용을 입력하거나 / 로 블록 형식 선택';color:#a2aba2;pointer-events:none;font-size:13px}
html[data-studio-mode=blocks] [data-studio-id]:hover{outline:none}
html[data-studio-mode=blocks] [contenteditable=true]:hover{background:#eef4ed!important;border-radius:4px}
`;
