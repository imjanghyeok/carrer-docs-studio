import {parse} from 'parse5';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {CodexBridge} from './codex-bridge.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function walk(node,visit){visit(node);for(const child of node.childNodes||[])walk(child,visit);if(node.content)walk(node.content,visit);}
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
function bad(message,status=400){const e=Error(message);e.status=status;throw e;}
export function scopeOf(html,scope,selectedId){
 if(scope==='document')return {start:0,end:html.length,html,label:'문서 전체'};
 if(!['block','page'].includes(scope)||!selectedId)bad('먼저 문서에서 블록을 선택해 주세요.');
 const dom=parse(html,{sourceCodeLocationInfo:true});let selected;walk(dom,n=>{if(attr(n,'data-studio-id')===selectedId)selected=n;});
 if(scope==='page')while(selected&&!attr(selected,'class')?.split(/\s+/).includes('page'))selected=selected.parentNode;
 const loc=selected?.sourceCodeLocation;if(!loc)bad('선택한 범위를 찾을 수 없습니다. 블록이나 페이지를 다시 선택해 주세요.');
 return {start:loc.startOffset,end:loc.endOffset,html:html.slice(loc.startOffset,loc.endOffset),label:scope==='page'?'선택 페이지':'선택 블록'};
}
function unsafeInventory(html){const findings=[];walk(parse(html),node=>{
 if(['script','iframe','object','embed','base','meta','link','form','input','button','textarea','select'].includes(node.tagName))findings.push(JSON.stringify({tag:node.tagName,attrs:node.attrs,text:node.childNodes?.map(n=>n.value||'').join('')}));
 for(const a of node.attrs||[]){if(/^on/i.test(a.name)||['src','srcset','href','xlink:href','action','formaction'].includes(a.name))findings.push(a.name+'='+a.value);if(a.name==='style'&&/url\s*\(|@import|expression\s*\(|\\/i.test(a.value))findings.push('css='+a.value);}
 if(node.tagName==='style'){const css=node.childNodes.map(n=>n.value||'').join('');if(/url\s*\(|@import|expression\s*\(|\\/i.test(css))findings.push('style='+css);}
 });return findings;}
export function replaceSafely(html,scope,edits){
 if(!Array.isArray(edits)||edits.length>30)bad('수정안이 너무 많거나 형식이 올바르지 않습니다.');
 const fragment=scope.html,spans=[];
 for(const e of edits){if(typeof e.before!=='string'||!e.before||typeof e.after!=='string'||e.after.length>160000)bad('수정안의 원문과 변경문이 올바르지 않습니다.');const at=fragment.indexOf(e.before);if(at<0||fragment.indexOf(e.before,at+1)!==-1)bad('수정 위치가 없거나 중복되어 자동 적용할 수 없습니다. 범위를 좁혀 다시 요청해 주세요.');spans.push({start:at,end:at+e.before.length,after:e.after});}
 spans.sort((a,b)=>a.start-b.start);for(let i=1;i<spans.length;i++)if(spans[i].start<spans[i-1].end)bad('서로 겹치는 수정안입니다. 다시 요청해 주세요.');
 let result=fragment;for(const span of [...spans].reverse())result=result.slice(0,span.start)+span.after+result.slice(span.end);
 const full=html.slice(0,scope.start)+result+html.slice(scope.end);
 const before=unsafeInventory(html);for(const value of unsafeInventory(full)){const at=before.indexOf(value);if(at<0)bad('스크립트·외부 리소스·링크 변경이 포함되어 적용을 차단했습니다. 문구와 로컬 스타일만 수정해 주세요.');before.splice(at,1);}
 const oldIds=[],newIds=[];walk(parse(html),n=>{if(attr(n,'data-studio-id'))oldIds.push(attr(n,'data-studio-id'));});walk(parse(full),n=>{if(attr(n,'data-studio-id'))newIds.push(attr(n,'data-studio-id'));});
 if(new Set(newIds).size!==newIds.length)bad('블록 식별자가 중복된 수정안입니다.');
 if(!/<body[\s>]/i.test(full)||Buffer.byteLength(full)>12000000)bad('문서 구조가 올바르지 않습니다.');
 return full;
}

export class AIService {
 constructor({data,getDoc,load,save,locked,atomic,materials,bridge=new CodexBridge()}){Object.assign(this,{data,getDoc,load,save,locked,atomic,materials,bridge});this.active=new Map();this.jobs=new Map();this.connection=null;}
 file(id){return path.join(this.data,'ai','chats',id+'.json');}
 async history(id){await this.getDoc(id);let items=[];try{items=JSON.parse(await fs.readFile(this.file(id),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 return {items,active:this.active.get(id)?.id||null};}
 async append(id,record){return this.locked('ai-history-'+id,async()=>{const {items}=await this.history(id);items.push(record);await this.atomic(this.file(id),JSON.stringify(items));});}
 async connect(){this.connection=await this.bridge.status();return this.connection;}
 async request(input){
   if(input.consent!==true)bad('AI에 선택 범위와 요청문을 전송한다는 안내를 확인해 주세요.');
   const doc=await this.getDoc(input.docId);if(this.active.has(doc.id))bad('이 문서의 요청이 진행 중입니다.',409);
   if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>6000)bad('요청은 1~6,000자로 입력해 주세요.');
   if(!this.connection?.loggedIn)bad('먼저 Codex에 연결해 주세요.');
   const model=this.connection.models.find(m=>m.id===input.model);if(!model||!model.efforts.includes(input.effort))bad('사용 가능한 모델과 추론 강도를 선택해 주세요.');
   const state=await this.load(doc);if(state.revision!==input.revision)bad('문서가 변경됐습니다. 최신 내용을 저장한 뒤 다시 요청해 주세요.',409);
   const materialOnly=input.scope==='materials';
   if(input.references&&!materialOnly)bad('회사 자료는 선택 자료만 범위에서 질문할 수 있습니다.');
   if(materialOnly&&(!input.references||!this.materials||input.mode!=='ask'))bad('회사 자료를 선택하고 질문만으로 요청해 주세요.');
   const references=materialOnly?await this.materials.context(input.references):null;
   const contextKey=references?sha(JSON.stringify([references.companyId,references.materials.map(m=>[m.id,m.hash]).sort()])):null;
   const scope=materialOnly?{start:0,end:0,html:'',label:`${references.companyName} · 선택 자료 ${references.materials.length}개`}:scopeOf(state.html,input.scope,input.selectedId);if(scope.html.length>250000)bad('선택 범위가 너무 큽니다. 페이지나 블록으로 나누어 요청해 주세요.');
   const id=randomUUID(),job={id,docId:doc.id,status:'running',characters:0,controller:new AbortController()};this.active.set(doc.id,job);this.jobs.set(id,job);
   try {
     const prior=(await this.history(doc.id)).items.filter(m=>['user','assistant'].includes(m.role)&&(m.contextKey||null)===contextKey).slice(-8).map(m=>({role:m.role,text:m.text.slice(0,6000)}));
     const referenceSummary=references?{companyId:references.companyId,companyName:references.companyName,materials:references.materials.map(({id,name,category,hash})=>({id,name,category,hash}))}:null;
     const user={id:randomUUID(),role:'user',text:input.prompt,at:new Date().toISOString(),model:model.id,effort:input.effort,scope:scope.label,contextKey,references:referenceSummary};await this.append(doc.id,user);
     const prompt=JSON.stringify({request:input.prompt,mode:input.mode==='ask'?'Answer only; return edits: [].':'Propose changes only when requested.',scope:scope.label,previousConversation:input.includeHistory===true?prior:[],editableHtml:scope.html,references});
     this.bridge.run({model:model.id,effort:input.effort,prompt,signal:job.controller.signal,onProgress:event=>{job.characters=event.characters;}}).then(async result=>{
       if(job.status!=='running')return;
       if(typeof result.message!=='string'||!Array.isArray(result.edits)||result.edits.length>30||result.edits.some(e=>!e||['before','after','reason'].some(k=>typeof e[k]!=='string')))bad('Codex 응답 형식이 올바르지 않습니다.');
       const edits=input.mode==='ask'?[]:result.edits;let warning=null;
       try{replaceSafely(state.html,scope,edits);}catch(e){warning=e.message;}
       const record={id:randomUUID(),role:'assistant',text:result.message.slice(0,24000),at:new Date().toISOString(),model:model.id,effort:input.effort,scope:scope.label,edits,warning,baseHash:sha(state.html),baseRevision:state.revision,scopeType:input.scope,selectedId:input.selectedId||null,decision:null};
       record.contextKey=contextKey;record.references=referenceSummary;
       await this.append(doc.id,record);job.status='completed';job.record=record;
     }).catch(async error=>{job.status=job.controller.signal.aborted?'cancelled':'failed';job.error=error.message;await this.append(doc.id,{id:randomUUID(),role:'error',text:job.error,at:new Date().toISOString()}).catch(()=>{});}).finally(()=>{this.active.delete(doc.id);setTimeout(()=>this.jobs.delete(id),3600000).unref();});
     return {id};
   }catch(e){this.active.delete(doc.id);this.jobs.delete(id);throw e;}
 }
 job(id){const j=this.jobs.get(id);if(!j)bad('요청을 찾을 수 없습니다. 대화 기록을 다시 열어 주세요.',404);return {id:j.id,docId:j.docId,status:j.status,characters:j.characters,error:j.error};}
 cancel(id){const job=this.jobs.get(id);if(!job)bad('요청을 찾을 수 없습니다.',404);if(job.status==='running'){job.controller.abort();job.status='cancelled';}return {ok:true};}
 async decide({docId,messageId,revision,action}){
   const doc=await this.getDoc(docId);
   return this.locked('ai-history-'+docId,()=>this.locked(docId,async()=>{
     const {items}=await this.history(docId),record=items.find(m=>m.id===messageId&&m.role==='assistant');
     if(!record||record.decision||!record.edits?.length)bad('적용할 수정안이 없습니다.');
     if(action==='reject'){record.decision='rejected';await this.atomic(this.file(docId),JSON.stringify(items));return {ok:true};}
     if(action!=='apply'||record.warning)bad('유효한 수정안만 적용할 수 있습니다.');
     const state=await this.load(doc);if(state.revision!==revision||sha(state.html)!==record.baseHash)bad('AI 요청 후 문서가 변경됐습니다. 기존 수정을 보호하기 위해 적용하지 않았습니다. 최신 문서로 다시 요청해 주세요.',409);
     const scope=scopeOf(state.html,record.scopeType,record.selectedId);
     const html=replaceSafely(state.html,scope,record.edits);
     const saved=await this.save(doc,{html,revision,reason:'Codex 수정안 적용'});
     record.decision='applied';await this.atomic(this.file(docId),JSON.stringify(items));return saved;
   }));
 }
 close(){for(const job of this.active.values())job.controller.abort();this.bridge.close();}
}
