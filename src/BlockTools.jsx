import React from 'react';
import {blockKinds} from './blocks';
import './blocks.css';

export default function BlockTools({selection,action,menu,setMenu,convert,disabled}){
 return <section className="block-tools" aria-label="블록 편집 도구"><div className="block-actions">
  <button disabled={disabled} onClick={()=>setMenu(!menu)}>＋ 블록 추가</button>
  <label>선택 블록 형식<select aria-label="선택 블록 형식" disabled={disabled||!selection?.blockKind} value={selection?.blockKind||''} onChange={e=>action('convertBlock',e.target.value)}><option value="" disabled>텍스트 블록 선택</option>{Object.entries(blockKinds).filter(([key])=>key!=='divider').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <button disabled={disabled||!selection?.blockKind} onClick={()=>action('move',-1)}>↑ 블록 위로</button><button disabled={disabled||!selection?.blockKind} onClick={()=>action('move',1)}>↓ 블록 아래로</button>
  <button disabled={disabled||!selection?.blockKind} onClick={()=>action('duplicate')}>블록 복제</button><button disabled={disabled||(!selection?.blockKind&&selection?.tag!=='hr')} onClick={()=>action('removeBlock')}>블록 삭제</button>
 </div><p>내용을 클릭해 입력 · 빈 블록에서 / 로 형식 선택 · Shift + Enter는 줄바꿈 · 삭제는 실행 취소로 복구</p>
 {menu&&<div className="block-menu" role="dialog" aria-label="블록 형식 선택"><header><b>{convert?'현재 빈 블록을 바꿀 형식':'추가할 블록 형식'}</b><button onClick={()=>setMenu(false)}>닫기</button></header><div>{Object.entries(blockKinds).filter(([key])=>!convert||key!=='divider').map(([key,label])=><button key={key} disabled={disabled} onClick={()=>{action(convert?'convertBlock':'insertBlock',key);setMenu(false);}}>{label}</button>)}</div></div>}
 </section>;
}
