import React,{useState} from 'react';
export default function CompanyFolders({companies,docs,current,query,busy,onOpen,onNew,onAdd}){
 const [closed,setClosed]=useState({});
 return <section className="company-folders"><header><h3>회사별 지원 문서</h3><button onClick={onAdd}>＋ 회사 추가</button></header>
 {!companies.length&&<p className="side-help">회사를 추가하고 기본 양식이나 기존 문서를 복사해서 시작하세요.</p>}
 {companies.map(c=>{const all=docs.filter(d=>d.companyId===c.id),items=all.filter(d=>(c.name+' '+c.role+' '+d.name).toLowerCase().includes(query.toLowerCase()));if(query&&!items.length&&!(c.name+' '+c.role).toLowerCase().includes(query.toLowerCase()))return null;const expanded=!!query||!closed[c.id];return <section key={c.id}><button className="company-folder" aria-expanded={expanded} onClick={()=>setClosed({...closed,[c.id]:expanded})}><span>{expanded?'▾':'▸'} {c.name}{c.role&&<small>{c.role}</small>}</span><span>{all.length}</span></button>{expanded&&<div className="company-documents">{items.map(d=><button disabled={busy} key={d.id} className={'doc-button '+(d.id===current?.id?'selected':'')} onClick={()=>onOpen(d)}>{d.name}</button>)}<button disabled={busy} className="company-new" onClick={()=>onNew(c)}>＋ 이 회사 문서 만들기</button></div>}</section>;})}
 </section>;
}
