#!/usr/bin/env node
// Test-only JSONL App Server. Never contacts OpenAI.
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
const send=m=>process.stdout.write(JSON.stringify(m)+'\n');
const timers=new Map();let seq=0;
createInterface({input:process.stdin}).on('line',line=>{
 const {id,method,params:p={}}=JSON.parse(line);if(id===undefined)return;
 const reply=result=>send({id,result});
 if(method==='initialize')return reply({userAgent:'test'});
 if(method==='config/read')return reply({config:{mcp_servers:{test_server:{}}}});
 if(method==='account/read')return reply({account:{type:'chatgpt'}});
 if(method==='model/list')return reply({data:[{model:'test-model',displayName:'Test Model',isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'medium'}]}],nextCursor:null});
 if(method==='thread/start'){
   assert.equal(p.permissions,'career_studio');assert.equal(p.approvalPolicy,'never');assert.equal(p.ephemeral,true);assert.equal(p.config['mcp_servers.test_server.enabled'],false);assert.equal(p.config['features.shell_tool'],false);
   return reply({thread:{id:'test-thread-'+(++seq)}});
 }
 if(method==='turn/start'){
   assert.equal(p.permissions,'career_studio');assert.ok(p.outputSchema);const input=JSON.parse(p.input[0].text);
   const turnId='turn-'+seq;reply({turn:{id:turnId}});
   const cancel=input.request==='slow';
   const result={message:input.mode.startsWith('Answer')?'샘플 문구에 대한 답변입니다.':'요청한 샘플 문구를 다듬었습니다.',edits:input.mode.startsWith('Answer')?[]:[{before:input.editableHtml,after:input.editableHtml.replace(/테스트 전|테스트 후/g,'테스트 후'),reason:'샘플 문구 변경'}]};
   if(input.request==='css')result.edits=[{before:'h1{font-size:32px}',after:'h1{font-size:32px;color:rgb(1,2,3)}',reason:'문서 스타일 변경'}];
   send({method:'item/agentMessage/delta',params:{threadId:p.threadId,delta:'처리 중'}});
   timers.set(p.threadId,setTimeout(()=>{send({method:'item/completed',params:{threadId:p.threadId,item:{type:'agentMessage',text:JSON.stringify(result)}}});send({method:'turn/completed',params:{threadId:p.threadId,turn:{id:turnId,status:'completed'}}});timers.delete(p.threadId);},cancel?30000:150));return;
 }
 if(method==='turn/interrupt'){clearTimeout(timers.get(p.threadId));timers.delete(p.threadId);reply({});return send({method:'turn/completed',params:{threadId:p.threadId,turn:{id:p.turnId,status:'interrupted'}}});}
 if(method==='thread/unsubscribe')return reply({});
 send({id,error:{code:-32601,message:'Unexpected test method '+method}});
});
