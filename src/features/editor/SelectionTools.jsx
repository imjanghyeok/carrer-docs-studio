import React, { useEffect, useRef } from 'react';
export function SelectionTools({
  selection,
  boxMode,
  setBoxMode,
  action,
  onSettings,
  onDelete,
  disabled,
  layout,
}) {
  return (
    <div className="selection-tools">
      {layout && (
        <div role="group" aria-label="선택 방식">
          <button disabled={disabled} aria-pressed={!boxMode} onClick={() => setBoxMode(false)}>
            글자 편집
          </button>
          <button disabled={disabled} aria-pressed={boxMode} onClick={() => setBoxMode(true)}>
            박스 선택
          </button>
        </div>
      )}
      <span className="selection-name">
        {selection ? selection.label || '빈 블록' : '문서에서 수정할 곳을 선택하세요'}
      </span>
      <button disabled={disabled || !selection?.parent} onClick={() => action('parent')}>
        바깥 박스 선택
      </button>
      <button disabled={disabled || !selection} onClick={onSettings}>
        선택 항목 설정
      </button>
      <button className="delete-block" disabled={disabled || !selection} onClick={onDelete}>
        선택한 블록 삭제
      </button>
      {!!selection?.innerTextBlocks?.length && (
        <label className="inner-text-picker">
          박스 안 텍스트 선택
          <select
            value=""
            onChange={(e) => {
              setBoxMode(false);
              action('selectId', e.target.value);
            }}
          >
            <option value="" disabled>
              제목이나 본문을 선택하세요
            </option>
            {selection.innerTextBlocks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
export function DeleteDialog({ label, onCancel, onConfirm }) {
  const panel = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    panel.current.querySelector('button').focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="small-modal"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
          if (e.key === 'Tab') {
            const buttons = [...panel.current.querySelectorAll('button')],
              first = buttons[0],
              last = buttons.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2 id="delete-title">선택한 블록을 삭제할까요?</h2>
        <p className="delete-label">{label || '빈 블록'}</p>
        <p>
          박스를 지우면 안쪽 내용도 함께 삭제됩니다. 삭제한 내용은 실행 취소로 되돌릴 수 있습니다.
        </p>
        <div className="modal-actions">
          <button onClick={onCancel}>취소</button>
          <button className="delete-block" onClick={onConfirm}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
