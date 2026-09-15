import React,{useState,useRef} from 'react';
import {Excalidraw,exportToSvg,MainMenu} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

export default function Diagram({initial,onClose,onInsert}){
 const api=useRef(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function insert(){
   setBusy(true);setError('');
   try {
     const elements=api.current.getSceneElements();
     if(!elements.length)throw Error('도형이나 글자를 먼저 그려 주세요.');
     const appState=api.current.getAppState();
     const files=api.current.getFiles();
     const svg=await exportToSvg({elements,appState:{...appState,exportWithDarkMode:false,exportBackground:false},files,exportPadding:20});
     svg.style.width='100%';svg.style.height='auto';
     const scene={elements,files,appState:{viewBackgroundColor:appState.viewBackgroundColor,currentItemFontFamily:appState.currentItemFontFamily}};
     onInsert(svg.outerHTML,scene);
   }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <><header className="diagram-header"><div><b>다이어그램 작업실</b><span>도형 · 화살표 · 텍스트 · 자유 그리기</span></div><div><button onClick={()=>{if(api.current?.getSceneElements().length && !window.confirm('문서에 반영하지 않고 닫을까요?'))return;onClose();}}>취소</button><button className="primary" disabled={busy} onClick={insert}>{busy?'변환 중…':'문서에 넣기'}</button></div></header>{error&&<div className="error-banner">{error}</div>}<div className="excalidraw-container"><Excalidraw excalidrawAPI={value=>{api.current=value;}} initialData={initial||{appState:{viewBackgroundColor:'#ffffff',currentItemFontFamily:2}}} langCode="ko-KR" theme="light" UIOptions={{canvasActions:{loadScene:true,saveToActiveFile:false,export:false,saveAsImage:false,toggleTheme:false}}}><MainMenu><MainMenu.DefaultItems.LoadScene/><MainMenu.DefaultItems.ClearCanvas/><MainMenu.DefaultItems.ChangeCanvasBackground/></MainMenu></Excalidraw></div><footer className="diagram-footer">Excalidraw · 도형 데이터도 함께 저장되어 나중에 다시 편집할 수 있습니다.</footer></>;
}
