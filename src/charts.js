// Chart data stays in ordinary HTML: timeline spans and numeric table rows.
const color=(value,fallback='#367fc8')=>{const parts=value?.match(/\d+/g);return parts?.length>=3?'#'+parts.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):fallback;};
export function monthNumber(value){const m=/^(\d{4})-(\d{2})$/.exec(value);if(!m||+m[2]<1||+m[2]>12)return NaN;return +m[1]*12+(+m[2]-1);}
export function monthString(n){return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;}
export function chartTarget(el){return el?.closest('.activity-chart,.studio-value-chart')||el?.querySelector('.activity-chart,.studio-value-chart');}
export function readChart(el){
 const view=el.ownerDocument.defaultView;
 if(el.matches('.studio-value-chart'))return {type:'bar',title:el.querySelector('figcaption')?.textContent||'',unit:el.dataset.unit||'',maximum:el.dataset.maximum||'',rows:[...el.querySelectorAll('tbody tr')].map(row=>({label:row.querySelector('th')?.textContent||'',value:row.dataset.value||'0',color:row.querySelector('.value-fill')?.style.backgroundColor?color(view.getComputedStyle(row.querySelector('.value-fill')).backgroundColor):'#367fc8',include:row.dataset.excluded!=='true'}))};
 const first=el.querySelector('.axis-year')?.textContent.match(/(\d{4})(?:\.(\d{2}))?/);
 const start=el.dataset.startMonth||`${first?.[1]||'2023'}-${first?.[2]||'01'}`;
 const origin=monthNumber(start);
 const ends=[...el.querySelectorAll('.axis-year,.chart-bar')].map(n=>parseInt(n.style.gridColumnEnd)||0);
 const months=Number(el.dataset.months)||Math.max(2,...ends)-1;
 return {type:'timeline',start,end:monthString(origin+months-1),rows:[...el.querySelectorAll('.chart-row')].map(row=>({label:row.querySelector('.chart-label')?.textContent||'',include:row.dataset.excluded!=='true',bars:[...row.querySelectorAll('.chart-bar')].map(bar=>({label:bar.textContent,start:monthString(origin+(parseInt(bar.style.gridColumnStart)||1)-1),end:monthString(origin+(parseInt(bar.style.gridColumnEnd)||2)-2),color:color(view.getComputedStyle(bar).backgroundColor),textColor:color(view.getComputedStyle(bar).color,'#185c9d'),include:bar.dataset.excluded!=='true'}))}))};
}
export function validateChart(model){
 if(model.type==='timeline'){
   const start=monthNumber(model.start),end=monthNumber(model.end);
   if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>119)throw Error('표시 기간은 시작 월 이후, 최대 120개월로 설정해 주세요.');
   for(const row of model.rows)for(const bar of row.bars){const a=monthNumber(bar.start),b=monthNumber(bar.end);if(!Number.isFinite(a)||!Number.isFinite(b)||a>b||a<start||b>end)throw Error(`“${bar.label||'활동'}”의 기간이 올바르지 않거나 표시 기간을 벗어났습니다.`);}
 }else{
   if(model.rows.some(row=>row.value===''||!Number.isFinite(Number(row.value))||Number(row.value)<0))throw Error('값은 0 이상의 숫자로 입력해 주세요.');
   const max=Math.max(0,...model.rows.map(row=>+row.value));
   if(model.maximum!==''&&(!Number.isFinite(+model.maximum)||+model.maximum<=0||+model.maximum<max))throw Error('축 최댓값은 모든 항목의 값 이상이어야 합니다. 비워 두면 자동 설정됩니다.');
 }
 if(!model.rows.length)throw Error('행을 하나 이상 추가해 주세요.');
}
const include=(node,value)=>{if(value)delete node.dataset.excluded;else node.dataset.excluded='true';};
export function writeChart(el,model){
 validateChart(model);
 const doc=el.ownerDocument;
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 if(model.type==='timeline'){
   const first=monthNumber(model.start),last=monthNumber(model.end),months=last-first+1;
   el.dataset.startMonth=model.start;el.dataset.months=String(months);
   const axis=el.querySelector('.axis-years');axis.replaceChildren();axis.style.gridTemplateColumns=`repeat(${months}, minmax(0, 1fr))`;
   for(let index=first;index<=last;){const year=Math.floor(index/12),end=Math.min(last,year*12+11),label=(index%12===0&&end%12===11)?String(year):`${year}.${String(index%12+1).padStart(2,'0')}–${String(end%12+1).padStart(2,'0')}`;const span=make('span','axis-year',label);span.style.gridColumn=`${index-first+1} / ${end-first+2}`;axis.append(span);index=end+1;}
   const oldRows=[...el.querySelectorAll('.chart-row')];
   model.rows.forEach((row,i)=>{
     const node=oldRows[i]||make('div','chart-row');include(node,row.include);
     let label=node.querySelector('.chart-label');if(!label){label=make('div','chart-label');node.append(label);}label.textContent=row.label;
     let track=node.querySelector('.chart-track');if(!track){track=make('div','chart-track');node.append(track);}
     track.removeAttribute('contenteditable');track.style.gridTemplateColumns=`repeat(${months}, minmax(0, 1fr))`;track.style.backgroundSize=`${100/months}% 100%`;track.style.backgroundImage='linear-gradient(to right,#f5f8fb calc(100% - 1px),#e9eef3 1px)';
     const oldBars=[...track.querySelectorAll('.chart-bar')];
     row.bars.forEach((bar,j)=>{const b=oldBars[j]||make('span','chart-bar');b.textContent=bar.label;Object.assign(b.style,{gridColumn:`${monthNumber(bar.start)-first+1} / ${monthNumber(bar.end)-first+2}`,backgroundColor:bar.color,color:bar.textColor,whiteSpace:'normal',overflowWrap:'anywhere',lineHeight:'1.25',minHeight:'18px'});include(b,bar.include);track.append(b);});
     oldBars.slice(row.bars.length).forEach(n=>n.remove());el.append(node);
   });oldRows.slice(model.rows.length).forEach(n=>n.remove());
 }else{
   el.classList.add('studio-value-chart');el.dataset.unit=model.unit;el.dataset.maximum=model.maximum;
   Object.assign(el.style,{margin:'16px 0',padding:'16px',border:'1px solid #d7e0e8',borderRadius:'10px',breakInside:'avoid'});
   const title=make('figcaption','',model.title);Object.assign(title.style,{fontWeight:'700',marginBottom:'12px'});
   const table=make('table');Object.assign(table.style,{width:'100%',borderCollapse:'separate',borderSpacing:'0 8px',tableLayout:'fixed',fontSize:'12px'});
   const caption=make('caption','',`단위: ${model.unit||'없음'} · 축: 0–${model.maximum||Math.max(1,...model.rows.map(row=>+row.value))}`);Object.assign(caption.style,{captionSide:'bottom',textAlign:'right',fontSize:'10px',color:'#64748b'});table.append(caption);
   const body=make('tbody'),max=Number(model.maximum)||Math.max(1,...model.rows.map(row=>+row.value));
   for(const row of model.rows){
     const tr=make('tr');tr.dataset.value=String(row.value);include(tr,row.include);
     const label=make('th','',row.label);label.scope='row';Object.assign(label.style,{width:'27%',textAlign:'left',fontWeight:'500',overflowWrap:'anywhere'});
     const meter=make('td');meter.setAttribute('aria-hidden','true');meter.style.padding='0 12px';
     const track=make('div');Object.assign(track.style,{height:'18px',background:'#eef2f6',borderRadius:'3px'});
     const fill=make('div','value-fill');Object.assign(fill.style,{width:`${+row.value/max*100}%`,height:'100%',backgroundColor:row.color,borderRadius:'3px'});track.append(fill);meter.append(track);
     const value=make('td','',`${row.value}${model.unit?' '+model.unit:''}`);Object.assign(value.style,{width:'22%',textAlign:'right',overflowWrap:'anywhere'});
     tr.append(label,meter,value);body.append(tr);
   }table.append(body);el.replaceChildren(title,table);
 }
}
