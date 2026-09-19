import React from 'react';
import AIChat from '../features/ai/AIChat.jsx';
import { api } from '../shared/api';
import Icon from '../shared/Icon';
import NumberField from '../shared/NumberField';
import { colorHex } from '../shared/color';
export default function Inspector({
  setSettingsOpen,
  setRightTab,
  rightTab,
  selection,
  selectedAction,
  editChart,
  draw,
  current,
  busy,
  moveCompany,
  companies,
  setNewDoc,
  apply,
  aiContext,
  applyAI,
  reviewRequest,
}) {
  return (
    <aside className="inspector">
      <button
        className="close-settings"
        onClick={() => {
          setSettingsOpen(false);
          setRightTab('settings');
        }}
      >
        설정창 닫기
      </button>
      <div className="right-tabs">
        <button
          className={rightTab === 'settings' ? 'active' : ''}
          onClick={() => {
            setRightTab('settings');
            setSettingsOpen(true);
          }}
        >
          블록 설정
        </button>
        <button className={rightTab === 'ai' ? 'active' : ''} onClick={() => setRightTab('ai')}>
          ✦ Codex 채팅
        </button>
      </div>
      <div className="settings-content" hidden={rightTab !== 'settings'}>
        {selection ? (
          <>
            <div className="selected-block">
              <span className="tag">{selection.tag.toUpperCase()}</span>
              <h3>{selection.label || '선택한 블록'}</h3>
              <button
                className="text-link"
                disabled={!selection.parent}
                onClick={() => selectedAction('parent')}
              >
                ↖ 상위 블록 선택
              </button>
            </div>
            <label className="include-card">
              <input
                type="checkbox"
                checked={!selection.excluded}
                onChange={(e) => selectedAction('toggle', selection.id, e.target.checked)}
              />
              <div>
                PDF에 포함
                <small>
                  {selection.excluded ? '내보낼 때 제외됩니다' : '현재 블록을 출력합니다'}
                </small>
              </div>
            </label>
            <section className="settings-section">
              <h4>글자</h4>
              <div className="field-row">
                <NumberField
                  label="크기"
                  value={selection.fontSize}
                  min="6"
                  max="80"
                  unit="px"
                  onChange={(n) => selectedAction('style', 'fontSize', n + 'px')}
                />
                <NumberField
                  label="줄 간격"
                  value={Number(selection.lineHeight.toFixed(2)) || 1.5}
                  min="0.8"
                  max="4"
                  step="0.1"
                  onChange={(n) => selectedAction('style', 'lineHeight', n)}
                />
              </div>
              <div className="alignment">
                <button onClick={() => selectedAction('style', 'textAlign', 'left')}>왼쪽</button>
                <button onClick={() => selectedAction('style', 'textAlign', 'center')}>
                  가운데
                </button>
                <button onClick={() => selectedAction('style', 'textAlign', 'right')}>
                  오른쪽
                </button>
              </div>
              <label className="color-field">
                글자 색
                <input
                  type="color"
                  aria-label="글자 색"
                  value={colorHex(selection.color)}
                  onChange={(e) => selectedAction('style', 'color', e.target.value)}
                />
              </label>
            </section>
            <section className="settings-section">
              <h4>박스 · 레이아웃</h4>
              <label className="select-field">
                열 구성
                <select value="" onChange={(e) => selectedAction('layout', e.target.value)}>
                  <option value="" disabled>
                    현재 설정 유지
                  </option>
                  <option value="1">1열</option>
                  <option value="2">2열</option>
                  <option value="3">3열</option>
                  <option value="4">4열</option>
                </select>
              </label>
              <div className="field-row">
                <NumberField
                  label="안쪽 여백"
                  value={selection.padding}
                  min="0"
                  max="100"
                  unit="px"
                  onChange={(n) => selectedAction('style', 'padding', n + 'px')}
                />
                <NumberField
                  label="칸 간격"
                  value={selection.gap}
                  min="0"
                  max="80"
                  unit="px"
                  onChange={(n) => selectedAction('style', 'gap', n + 'px')}
                />
              </div>
              <div className="field-row">
                <NumberField
                  label="너비"
                  value={selection.width}
                  min="20"
                  max="794"
                  unit="px"
                  onChange={(n) => selectedAction('style', 'width', n + 'px')}
                />
                <NumberField
                  label="둥글기"
                  value={selection.radius}
                  min="0"
                  max="80"
                  unit="px"
                  onChange={(n) => selectedAction('style', 'borderRadius', n + 'px')}
                />
              </div>
              <label className="color-field">
                배경 색
                <input
                  type="color"
                  aria-label="배경 색"
                  value={colorHex(selection.background, '#ffffff')}
                  onChange={(e) => selectedAction('style', 'backgroundColor', e.target.value)}
                />
              </label>
              <div className="alignment">
                <button onClick={() => selectedAction('style', 'border', '1px solid #d7e0e8')}>
                  테두리
                </button>
                <button onClick={() => selectedAction('style', 'width', 'auto')}>자동 너비</button>
                <button onClick={() => selectedAction('style', 'backgroundColor', 'transparent')}>
                  투명
                </button>
              </div>
            </section>
            {selection.chart && (
              <button className="wide-button" onClick={() => editChart()}>
                ▥ 그래프 데이터 편집
              </button>
            )}
            {selection.scene && (
              <button className="wide-button" onClick={draw}>
                <Icon name="draw" /> 다이어그램 다시 편집
              </button>
            )}
            {selection.svg && !selection.scene && (
              <section className="settings-section">
                <h4>기존 다이어그램 글자</h4>
                <p className="side-help">
                  원래 도형을 유지하면서 문구를 바꿉니다. 새 도형은 상단 다이어그램에서 그릴 수
                  있어요.
                </p>
                {selection.labels.map((l) => (
                  <label key={l.index} className="svg-label">
                    <span>{l.index + 1}</span>
                    <input
                      aria-label={`다이어그램 문구 ${l.index + 1}`}
                      defaultValue={l.text}
                      key={selection.id + '-' + l.index + '-' + l.text}
                      onBlur={(e) => {
                        if (e.target.value !== l.text)
                          selectedAction('svgLabel', l.index, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                    />
                  </label>
                ))}
              </section>
            )}
            <section className="settings-section">
              <h4>블록 순서</h4>
              <div className="alignment">
                <button onClick={() => selectedAction('move', -1)}>↑ 위로</button>
                <button onClick={() => selectedAction('move', 1)}>↓ 아래로</button>
                <button onClick={() => selectedAction('duplicate')}>복제</button>
              </div>
            </section>
          </>
        ) : (
          <div className="empty-inspector">
            <div className="selection-illustration">
              <span />
              <span />
              <i />
            </div>
            <h3>다듬고 싶은 곳을 선택하세요</h3>
            <p>
              문서의 글자나 박스를 클릭하면
              <br />
              크기, 간격, 색을 바꿀 수 있어요.
            </p>
            <div className="tip">
              <b>작은 팁</b>
              <p>
                Enter로 새 줄, Shift + Enter로 줄바꿈.
                <br />
                박스 전체는 ‘바깥 박스 선택’을 눌러요.
              </p>
            </div>
          </div>
        )}
        <div className="document-actions">
          {current?.custom && (
            <label className="document-company">
              회사 폴더
              <select
                aria-label="회사 폴더"
                disabled={busy}
                value={current.companyId || ''}
                onChange={(e) => moveCompany(e.target.value)}
              >
                <option value="">분류하지 않음</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? ' · ' + c.role : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={() =>
              setNewDoc({
                name: (current?.name || '문서') + ' 사본',
                copyId: current?.id,
                companyId: current?.companyId,
              })
            }
          >
            사본 만들기
          </button>
          <button onClick={apply} disabled={busy || !current}>
            원본에 반영
          </button>
        </div>
      </div>
      <div className="chat-content" hidden={rightTab !== 'ai'}>
        <AIChat
          doc={current}
          selection={selection}
          api={api}
          prepareRequest={aiContext}
          applyProposal={applyAI}
          reviewRequest={reviewRequest}
        />
      </div>
    </aside>
  );
}
