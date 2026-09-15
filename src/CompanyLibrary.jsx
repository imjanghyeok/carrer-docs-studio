import React,{useEffect,useState} from 'react';
import {reviewPrompt} from './review-prompt';
import './companies.css';

const labels={posting:'채용 공고',resume:'이력서',portfolio:'포트폴리오',other:'기타 자료'};
function classify(file,fallback){const name=(file.webkitRelativePath||file.name).toLowerCase();if(/posting|공고|채용|job[-_ ]?description/.test(name))return 'posting';if(/portfolio|포폴|포트폴리오/.test(name))return 'portfolio';if(/resume|이력서/.test(name))return 'resume';return fallback;}
function encode(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});}

export default function CompanyLibrary({api,doc,prepareRequest,onReview,onClose}){
 const [companies,setCompanies]=useState([]),[company,setCompany]=useState(null),[name,setName]=useState(''),[role,setRole]=useState('');
 const [category,setCategory]=useState('resume'),[pending,setPending]=useState([]),[selected,setSelected]=useState([]),[preview,setPreview]=useState(null);
 const [posting,setPosting]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{api('/api/companies').then(setCompanies).catch(e=>setError(e.message));},[]);
 async function task(action){setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function refresh(c){setCompany(c);setCompanies(await api('/api/companies'));}
 async function choose(id){await task(async()=>{const c=await api('/api/companies/'+id);setCompany(c);setSelected([]);setPreview(null);setPending([]);setPosting('');setUrl('');});}
 async function create(e){e.preventDefault();await task(async()=>{const c=await api('/api/companies',{name,role});await refresh(c);setSelected([]);setPreview(null);setPending([]);setPosting('');setUrl('');setName('');setRole('');});}
 function pick(files){const list=Array.from(files);if(list.length>50){setError('한 번에 최대 50개 파일을 선택해 주세요.');return;}setPending(list.map(file=>({file,category:classify(file,category),error:! /\.(txt|md|html?|pdf)$/i.test(file.name)?'지원하지 않는 형식':file.size>8_000_000?'8MB 초과':file.size===0?'빈 파일':''})));setError('');}
 async function upload(){await task(async()=>{let c=company;const remaining=[],added=[],failures=[];for(const entry of pending){if(entry.error){remaining.push(entry);continue;}try{const result=await api(`/api/companies/${company.id}/materials`,{name:entry.file.name,category:entry.category,base64:await encode(entry.file)});c=result.company;if(!result.material.warning)added.push(result.material.id);}catch(e){remaining.push({...entry,error:e.message});failures.push(entry.file.name);}}await refresh(c);setSelected(s=>[...new Set([...s,...added])]);setPending(remaining);setNotice(`${pending.length-remaining.length}개 파일을 보관했습니다.${remaining.length?' 남은 파일의 오류를 확인해 주세요.':''}`);if(failures.length)setError('일부 파일을 가져오지 못했습니다: '+failures.join(', '));});}
 async function addPosting(){await task(async()=>{const file=new File([posting],'채용 공고.md',{type:'text/markdown'});const result=await api(`/api/companies/${company.id}/materials`,{name:file.name,category:'posting',base64:await encode(file),sourceUrl:url});await refresh(result.company);if(!result.material.warning)setSelected(s=>[...new Set([...s,result.material.id])]);setPosting('');setUrl('');setNotice('공고를 보관했습니다. 출처 URL에는 접속하지 않았습니다.');});}
 async function snapshot(){await task(async()=>{const context=await prepareRequest('document');const result=await api(`/api/companies/${company.id}/snapshot`,{docId:context.docId,revision:context.revision,category});await refresh(result.company);if(!result.material.warning)setSelected(s=>[...new Set([...s,result.material.id])]);setNotice('현재 문서를 HTML 사본으로 보관했습니다. 이후 편집은 사본에 자동 반영되지 않습니다.');});}
 const chosen=company?.materials.filter(m=>selected.includes(m.id))||[];
 const total=chosen.reduce((sum,m)=>sum+m.textLength,0);
 function review(){onReview({key:crypto.randomUUID(),companyId:company.id,companyName:company.name,materials:chosen,prompt:reviewPrompt});onClose();}
 return <div className="modal-backdrop"><section className="company-modal" role="dialog" aria-label="회사별 자료">
  <header><div><h2>회사별 자료</h2><p>공고와 지원 문서를 내 컴퓨터에 보관하고, 선택한 자료로 피드백을 받으세요.</p></div><button disabled={busy} onClick={onClose}>닫기</button></header>
  <div className="company-body"><aside className="company-list">
   <form onSubmit={create}><label>회사명<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>지원 직무<input maxLength={150} value={role} onChange={e=>setRole(e.target.value)}/></label><button disabled={busy||!name.trim()}>회사 추가</button></form>
   {companies.map(c=><button className={company?.id===c.id?'active':''} key={c.id} disabled={busy} onClick={()=>choose(c.id)}><b>{c.name}</b><small>{c.role||'직무 미입력'} · 자료 {c.count}개</small></button>)}
  </aside><main className="company-detail">
   {!company?<div className="company-empty">회사를 추가하거나 왼쪽 목록에서 선택하세요.<br/>원래 파일은 옮기지 않고 복사해 보관합니다.</div>:<>
   <h3>{company.name}{company.role&&<small> · {company.role}</small>}</h3>
   <p className="company-path">개인 데이터 폴더 / applications / {company.id}<br/>posting · resume · portfolio · other 폴더로 구분합니다.</p>
   <section className="company-import"><h4>자료 가져오기</h4>
    <div className="company-upload"><label>기본 자료 종류<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(labels).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select></label><label className="company-file">파일 선택<input type="file" aria-label="회사 자료 파일" multiple accept=".txt,.md,.html,.htm,.pdf" disabled={busy} onChange={e=>{pick(e.target.files);e.target.value='';}}/></label><label className="company-file">폴더 선택<input type="file" aria-label="회사 자료 폴더" multiple webkitdirectory="" disabled={busy} onChange={e=>{pick(e.target.files);e.target.value='';}}/></label></div>
    <p>TXT · Markdown · HTML · PDF, 파일당 8MB. 회사 하나의 폴더를 선택한 뒤 종류를 확인하세요. 이미지·첨부 리소스는 가져오지 않습니다.</p>
    {pending.length>0&&<div className="company-pending">{pending.map((entry,i)=><div key={i}><span title={entry.file.webkitRelativePath||entry.file.name}>{entry.file.webkitRelativePath||entry.file.name}{entry.error&&<small className="company-warning">{entry.error}</small>}</span><select aria-label={`${entry.file.name} 자료 종류`} value={entry.category} onChange={e=>setPending(list=>list.map((item,j)=>j===i?{...item,category:e.target.value}:item))}>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></div>)}<button disabled={busy||!pending.some(e=>!e.error)} onClick={upload}>선택 파일 보관</button><button disabled={busy} onClick={()=>setPending([])}>선택 비우기</button></div>}
    <button disabled={busy||!doc} onClick={snapshot}>현재 문서 보관</button><small> {doc?.name} · {labels[category]} HTML 사본</small>
   </section>
   <details className="company-posting"><summary>채용 공고 붙여넣기</summary><label>공고 본문<textarea aria-label="공고 본문" value={posting} maxLength={180000} onChange={e=>setPosting(e.target.value)}/></label><label>출처 URL (선택 · 자동으로 읽지 않음)<input type="url" value={url} maxLength={2000} onChange={e=>setUrl(e.target.value)}/></label><button disabled={busy||!posting.trim()} onClick={addPosting}>공고 보관</button></details>
   <section className="company-materials"><h4>피드백에 사용할 자료</h4><p>체크한 자료의 추출 텍스트만 전송합니다. 보내기 전 채팅에서 다시 확인할 수 있습니다.</p>
    {!company.materials.length&&<p>아직 보관한 자료가 없습니다.</p>}
    {company.materials.map(m=><div className="company-material" key={m.id}><label><input type="checkbox" aria-label={`${m.name} 피드백에 포함`} disabled={busy||!!m.warning||!m.textLength} checked={selected.includes(m.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,m.id]:s.filter(id=>id!==m.id))}/><span><b>{m.name}</b><small>{labels[m.category]} · {m.textLength.toLocaleString()}자 · {new Date(m.createdAt).toLocaleString()}{m.warning&&<span className="company-warning">{m.warning}</span>}</small></span></label><button disabled={busy} onClick={()=>task(async()=>setPreview(await api(`/api/companies/${company.id}/materials/${m.id}`)))}>내용 확인</button></div>)}
   </section>
   {preview&&<section className="company-preview"><header><b>{preview.material.name} · 추출 텍스트</b><button onClick={()=>setPreview(null)}>접기</button></header>{preview.material.warning&&<p className="company-warning">{preview.material.warning}</p>}<pre>{preview.text||'읽을 수 있는 텍스트가 없습니다.'}</pre></section>}
   </>}
  </main></div>
  <footer>{error&&<p role="alert" className="company-warning">{error}</p>}{notice&&<p role="status">{notice}</p>}<div><p>{chosen.length}개 선택 · {total.toLocaleString()}자{chosen.length>12||total>240000?' — 12개·240,000자 이내로 줄여 주세요.':''}<small>검토 프롬프트를 채팅에 준비합니다. 자동 전송하거나 원문을 수정하지 않습니다.</small></p><button className="primary" disabled={busy||!doc||!chosen.length||chosen.length>12||total>240000} onClick={review}>냉정한 피드백</button></div></footer>
 </section></div>;
}
