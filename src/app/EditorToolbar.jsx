import React from 'react';
import Icon from '../shared/Icon';
export default function EditorToolbar({ selectedAction, editChart, draw, setZoom, zoom }) {
  return (
    <div className="toolbar">
      <div className="tool-group">
        <button
          title="실행 취소 (⌘Z)"
          aria-label="실행 취소"
          onClick={() => selectedAction('undo')}
        >
          <Icon name="undo" />
        </button>
        <button
          title="다시 실행 (⌘⇧Z)"
          aria-label="다시 실행"
          onClick={() => selectedAction('undo', true)}
          style={{ transform: 'scaleX(-1)' }}
        >
          <Icon name="undo" />
        </button>
      </div>
      <div className="tool-group">
        <button
          title="선택한 글자 굵게"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectedAction('textStyle', 'bold')}
        >
          <b>B</b>
        </button>
        <button
          title="기울임"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectedAction('textStyle', 'italic')}
        >
          <i>I</i>
        </button>
        <button
          title="밑줄"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectedAction('textStyle', 'underline')}
        >
          <u>U</u>
        </button>
      </div>
      <div className="tool-group">
        <button onClick={() => selectedAction('insert', 'text')}>
          T <span>텍스트</span>
        </button>
        <button onClick={() => selectedAction('insert', 'heading')}>
          H <span>제목</span>
        </button>
        <button onClick={() => selectedAction('insert', 'box')}>
          <Icon name="box" />
          <span>박스</span>
        </button>
        <button onClick={() => selectedAction('insert', 'columns')}>
          <Icon name="grid" />
          <span>2열</span>
        </button>
        <button onClick={() => editChart(true)}>
          ▥ <span>그래프 추가</span>
        </button>
        <button className="draw-button" onClick={draw}>
          <Icon name="draw" />
          <span>다이어그램</span>
        </button>
      </div>
      <div className="zoom-tools">
        <button onClick={() => setZoom((z) => Math.max(40, z - 10))} aria-label="축소">
          −
        </button>
        <span>{zoom}%</span>
        <button onClick={() => setZoom((z) => Math.min(150, z + 10))} aria-label="확대">
          +
        </button>
      </div>
    </div>
  );
}
