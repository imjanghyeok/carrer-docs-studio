import React,{useState} from 'react';
import {validateChart} from './charts';

export default function ChartEditor({initial,onApply,onClose}){
 const [model,setModel]=useState(initial),[error,setError]=useState('');
 const patch=updates=>setModel(m=>({...m,...updates}));
 const rowPatch=(i,updates)=>patch({rows:model.rows.map((r,j)=>j===i?{...r,...updates}:r)});
 const barPatch=(i,k,updates)=>rowPatch(i,{bars:model.rows[i].bars.map((b,j)=>j===k?{...b,...updates}:b)});
 const timeline=model.type==='timeline';
 function submit(e){e.preventDefault();try{validateChart(model);onApply(model);}catch(e){setError(e.message);}}
 return <div className="modal-backdrop"><form className="chart-editor" onSubmit={submit} role="dialog" aria-label="그래프 편집"><header><div><h2>{timeline?'활동 기간 그래프':'수치형 막대 그래프'}</h2><p>HTML 구조를 유지한 채 항목과 표시 설정을 수정합니다.</p></div><button type="button" onClick={onClose}>취소</button></header>
 {error&&<div role="alert" className="error-banner">{error}</div>}
 <div className="chart-editor-body">
 {timeline?<div className="chart-fields"><label>표시 시작 월<input type="month" required value={model.start} onChange={e=>patch({start:e.target.value})}/></label><label>표시 종료 월<input type="month" required value={model.end} onChange={e=>patch({end:e.target.value})}/></label><p>활동의 시작·종료 월을 모두 포함합니다. 겹친 활동은 같은 행 안에서 위아래로 표시됩니다.</p></div>:<div className="chart-fields"><label>그래프 제목<input value={model.title} onChange={e=>patch({title:e.target.value})}/></label><label>단위<input value={model.unit} placeholder="예: ms, 건, %" onChange={e=>patch({unit:e.target.value})}/></label><label>축 최댓값<input type="number" min="0.000001" step="any" placeholder="자동" value={model.maximum} onChange={e=>patch({maximum:e.target.value})}/></label></div>}
 {model.rows.map((row,i)=><section className="chart-edit-row" key={i}>
 <div className="chart-row-heading"><label className="chart-check"><input type="checkbox" aria-label={`행 ${i+1} 포함`} checked={row.include} onChange={e=>rowPatch(i,{include:e.target.checked})}/>포함</label><input aria-label={`행 ${i+1} 이름`} value={row.label} onChange={e=>rowPatch(i,{label:e.target.value})}/><button type="button" aria-label={`행 ${i+1} 위로`} disabled={!i} onClick={()=>{const rows=[...model.rows];[rows[i-1],rows[i]]=[rows[i],rows[i-1]];patch({rows});}}>↑</button><button type="button" aria-label={`행 ${i+1} 삭제`} onClick={()=>patch({rows:model.rows.filter((_,j)=>j!==i)})}>삭제</button></div>
 {timeline?<>{row.bars.map((bar,k)=><div className="chart-activity" key={k}>
 <label className="chart-check"><input type="checkbox" aria-label={`활동 ${i+1}-${k+1} 포함`} checked={bar.include} onChange={e=>barPatch(i,k,{include:e.target.checked})}/></label>
 <label>활동명<input aria-label={`활동 ${i+1}-${k+1} 이름`} value={bar.label} onChange={e=>barPatch(i,k,{label:e.target.value})}/></label>
 <label>시작 월<input type="month" required aria-label={`활동 ${i+1}-${k+1} 시작 월`} value={bar.start} onChange={e=>barPatch(i,k,{start:e.target.value})}/></label>
 <label>종료 월<input type="month" required aria-label={`활동 ${i+1}-${k+1} 종료 월`} value={bar.end} onChange={e=>barPatch(i,k,{end:e.target.value})}/></label>
 <label>막대<input type="color" aria-label={`활동 ${i+1}-${k+1} 색상`} value={bar.color} onChange={e=>barPatch(i,k,{color:e.target.value})}/></label>
 <label>글자<input type="color" aria-label={`활동 ${i+1}-${k+1} 글자 색상`} value={bar.textColor} onChange={e=>barPatch(i,k,{textColor:e.target.value})}/></label>
 <button type="button" aria-label={`활동 ${i+1}-${k+1} 삭제`} onClick={()=>rowPatch(i,{bars:row.bars.filter((_,j)=>j!==k)})}>×</button>
 </div>)}<button type="button" className="text-link" onClick={()=>rowPatch(i,{bars:[...row.bars,{label:'새 활동',start:model.start,end:model.start,color:'#8ec1f5',textColor:'#103f70',include:true}]})}>+ 활동 추가</button></>:<div className="chart-fields"><label>값<input type="number" step="any" min="0" required aria-label={`행 ${i+1} 값`} value={row.value} onChange={e=>rowPatch(i,{value:e.target.value})}/></label><label>막대 색상<input type="color" aria-label={`행 ${i+1} 색상`} value={row.color} onChange={e=>rowPatch(i,{color:e.target.value})}/></label></div>}
 </section>)}
 <button type="button" onClick={()=>patch({rows:[...model.rows,timeline?{label:'새 분류',include:true,bars:[]}:{label:'새 항목',value:'0',color:'#367fc8',include:true}]})}>+ 행 추가</button>
 </div><footer><p>체크 해제는 PDF에서 제외합니다. 삭제는 적용 전 취소하거나 적용 후 실행 취소할 수 있습니다.</p><button className="primary" type="submit">그래프 적용</button></footer>
 </form></div>;
}
