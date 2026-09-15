import { useDocumentSession } from '../features/documents/useDocumentSession';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import DocumentSidebar from './DocumentSidebar';
import EditorToolbar from './EditorToolbar';
import Inspector from './Inspector';
import { DocumentEditor, prepare } from '../features/editor/document.js';
import '../styles/workspace.css';
import '../features/ai/ai.css';
import ChartEditor from '../features/charts/ChartEditor.jsx';
import { chartTarget, readChart } from '../features/charts/charts.js';
import CompanyLibrary from '../features/companies/CompanyLibrary.jsx';
import BlockTools from '../features/editor/BlockTools.jsx';
import { SelectionTools, DeleteDialog } from '../features/editor/SelectionTools.jsx';
import '../features/companies/organization.css';
const Diagram = lazy(() => import('../features/diagrams/Diagram.jsx'));

import { api } from '../shared/api';
import Icon from '../shared/Icon';

export default function App() {
  const [rightTab, setRightTab] = useState('settings');
  const [companies, setCompanies] = useState([]);
  const [companyForm, setCompanyForm] = useState(null);
  const [boxMode, setBoxMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  useEffect(() => {
    engine.current?.setBoxMode(boxMode);
  }, [boxMode]);
  async function refreshCompanies() {
    setCompanies(await api('/api/companies'));
  }
  async function createCompany(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/companies', companyForm);
      await refreshCompanies();
      setCompanyForm(null);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function moveCompany(companyId) {
    setBusy(true);
    try {
      await flush();
      const id = state.current.doc.id;
      const doc = await api(endpoint() + '/company', {
        companyId: companyId || null,
        expectedCompanyId: state.current.doc.companyId || null,
      });
      setDocs(await api('/api/documents'));
      if (state.current.doc.id === id) {
        state.current.doc = doc;
        setCurrent(doc);
        currentRef.current = doc;
      }
      notify('회사 폴더를 변경했습니다. 문서 내용과 이력은 유지됩니다.');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  function deleteSelected() {
    const editor = engine.current;
    if (!editor) return;
    const reason = editor.deletionError();
    if (reason) {
      showError(Error(reason));
      return;
    }
    setDeleteTarget({ element: editor.selected, label: editor.label(editor.selected) });
  }
  function confirmDelete() {
    const editor = engine.current;
    const target = deleteTarget?.element;
    setDeleteTarget(null);
    try {
      if (
        !target?.isConnected ||
        target.ownerDocument !== editor?.doc ||
        editor.selected !== target
      )
        throw Error('선택한 블록이 바뀌었습니다. 다시 선택해 주세요.');
      editor.removeSelected();
      notify('삭제했습니다. 실행 취소로 되돌릴 수 있어요.');
    } catch (e) {
      showError(e);
    }
  }

  const [editMode, setEditMode] = useState(() =>
    localStorage.getItem('career-studio-mode') === 'blocks' ? 'blocks' : 'layout',
  );
  const [blockMenu, setBlockMenu] = useState(false);
  const [slashConvert, setSlashConvert] = useState(false);
  const modeRef = useRef(editMode);
  modeRef.current = editMode;
  useEffect(() => {
    engine.current?.setMode(editMode);
    setBoxMode(false);
    localStorage.setItem('career-studio-mode', editMode);
    setBlockMenu(false);
  }, [editMode]);
  const [library, setLibrary] = useState(false);
  const [reviewRequest, setReviewRequest] = useState(null);
  async function aiContext(scope) {
    const docId = state.current?.doc.id;
    if (!docId) throw Error('문서를 먼저 열어 주세요.');
    const selectedId = engine.current?.selected?.dataset.studioId;
    if (!['document', 'materials'].includes(scope) && !selectedId)
      throw Error('문서에서 블록을 먼저 선택해 주세요.');
    dirty.current = true;
    await flush();
    if (state.current.doc.id !== docId) throw Error('문서가 바뀌었습니다. 다시 요청해 주세요.');
    return { docId, revision: state.current.revision, scope, selectedId };
  }
  async function applyAI(messageId) {
    setBusy(true);
    try {
      const docId = state.current.doc.id;
      await flush();
      const localHTML = engine.current.serialize();
      const result = await api('/api/ai/decide', {
        docId,
        messageId,
        revision: state.current.revision,
        action: 'apply',
      });
      if (state.current.doc.id !== docId) return;
      state.current = result;
      if (engine.current.serialize() !== localHTML) {
        dirty.current = true;
        await flush();
        throw Error(
          '적용 처리 중 직접 수정한 내용이 있어 그 내용을 유지했습니다. 최신 문서로 다시 요청해 주세요.',
        );
      }
      engine.current.checkpoint();
      engine.current.restore(result.html);
      setPdf(null);
      await flush();
      notify('Codex 수정안을 적용했습니다. 실행 취소로 되돌릴 수 있어요.');
    } finally {
      setBusy(false);
    }
  }
  const [chart, setChart] = useState(null);
  function editChart(create = false) {
    const target = create ? null : chartTarget(engine.current?.selected);
    setChart({
      target,
      model: target
        ? readChart(target)
        : {
            type: 'bar',
            title: '그래프 제목',
            unit: '',
            maximum: '',
            rows: [{ label: '항목 1', value: '0', color: '#367fc8', include: true }],
          },
    });
  }
  const [docs, setDocs] = useState([]);
  const [current, setCurrent] = useState(null);
  const [frameHtml, setFrameHtml] = useState('');
  const [selection, setSelection] = useState(null);
  const [outline, setOutline] = useState([]);
  const [metrics, setMetrics] = useState({ height: 1200, pages: 1, warnings: [] });
  const [zoom, setZoom] = useState(85);
  const [status, setStatus] = useState('준비');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [diagram, setDiagram] = useState(null);
  const [history, setHistory] = useState(null);
  const [newDoc, setNewDoc] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('documents');
  const [toast, setToast] = useState('');
  const [pdf, setPdf] = useState(null);
  const iframe = useRef();
  const currentRef = useRef();
  const { engine, state, timer, dirty, loadedHTML, flush, changed } = useDocumentSession({
    setStatus,
    setPdf,
    showError,
  });
  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };
  const endpoint = () => '/api/documents/' + state.current.doc.id;
  function showError(e) {
    setError(e.message || String(e));
  }
  async function open(doc) {
    setBusy(true);
    setError('');
    try {
      await flush();
      const data = await api('/api/documents/' + doc.id);
      engine.current?.destroy();
      engine.current = null;
      state.current = data;
      currentRef.current = doc;
      loadedHTML.current = data.html;
      dirty.current = false;
      setSelection(null);
      setOutline([]);
      setPdf(null);
      setCurrent(doc);
      setFrameHtml(prepare(data.html, data.base));
      setStatus(data.updatedAt ? '저장된 초안' : '원본에서 시작');
      setPreview(false);
      localStorage.setItem('career-studio-last', doc.id);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  function onFrameLoad() {
    if (!iframe.current?.contentDocument?.body || !state.current) return;
    engine.current?.destroy();
    engine.current = new DocumentEditor(iframe.current, {
      onChange: changed,
      onSelect: setSelection,
      onOutline: setOutline,
      onMetrics: setMetrics,
      onSlash: () => {
        setSlashConvert(true);
        setBlockMenu(true);
      },
    });
    engine.current.setMode(modeRef.current);
    engine.current.setBoxMode(boxMode);
    // Selection markers are UI-only; merely opening a file does not save a draft.
  }
  useEffect(() => {
    refreshCompanies().catch(showError);
    api('/api/documents')
      .then((list) => {
        setDocs(list);
        const last = localStorage.getItem('career-studio-last');
        open(list.find((d) => d.id === last) || list[0]);
      })
      .catch(showError);
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flush()
          .then(() => notify('로컬에 저장했습니다.'))
          .catch(showError);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  async function exportPDF() {
    setBusy(true);
    setError('');
    try {
      await flush();
      if (!state.current.revision) {
        dirty.current = true;
        await flush();
      }
      const result = await api(endpoint() + '/export', { revision: state.current.revision });
      setPdf(result);
      notify('PDF를 저장했습니다. 다운로드 버튼으로 받을 수 있습니다.');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (
      !window.confirm(
        '현재 편집 내용을 문서 원본에 반영할까요? 변경 전후 내용은 로컬 이력에 기록됩니다.',
      )
    )
      return;
    setBusy(true);
    try {
      await flush();
      if (!state.current.revision) {
        dirty.current = true;
        await flush();
      }
      const result = await api(endpoint() + '/apply', {
        revision: state.current.revision,
        sourceHash: state.current.sourceHash,
      });
      state.current.sourceHash = result.sourceHash;
      notify('원본에 반영했습니다.');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function restore(rev) {
    setBusy(true);
    try {
      await flush();
      const result = await api(endpoint() + '/restore', {
        target: rev,
        revision: state.current.revision,
      });
      state.current = result;
      dirty.current = false;
      setFrameHtml(prepare(result.html, result.base));
      setStatus('이전 내용 복원됨');
      setHistory(null);
      notify('이전 저장 내용을 복원했습니다.');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await flush();
      const doc = await api('/api/documents', {
        name: newDoc.name,
        copyId: newDoc.copyId,
        companyId: newDoc.companyId || null,
        documentFormat: newDoc.documentFormat || 'blank',
      });
      setDocs(await api('/api/documents'));
      setNewDoc(null);
      await open(doc);
      if (doc.documentFormat === 'blocks') setEditMode('blocks');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }
  function togglePreview() {
    setPreview(!preview);
    iframe.current?.contentDocument.documentElement.toggleAttribute(
      'data-studio-preview',
      !preview,
    );
    engine.current?.measure();
  }
  function draw() {
    const el = engine.current?.selected;
    if (el?.dataset.scene) {
      try {
        setDiagram({ target: el, scene: JSON.parse(el.dataset.scene) });
      } catch (e) {
        showError(e);
      }
    } else setDiagram({ target: null, scene: null });
  }
  const selectedAction = (method, ...args) => engine.current?.[method](...args);
  return (
    <div
      className={
        'studio ' +
        (rightTab === 'ai' ? 'ai-open ' : '') +
        (editMode === 'blocks' ? 'block-mode ' : '') +
        (settingsOpen ? 'settings-open' : '')
      }
    >
      <DocumentSidebar
        setNewDoc={setNewDoc}
        setLibrary={setLibrary}
        tab={tab}
        setTab={setTab}
        query={query}
        setQuery={setQuery}
        companies={companies}
        docs={docs}
        current={current}
        busy={busy}
        open={open}
        setCompanyForm={setCompanyForm}
        outline={outline}
        selectedAction={selectedAction}
        selection={selection}
      />
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            작업실 <span>/</span> {current?.name || '문서 불러오는 중'}
          </div>
          <div className="top-actions">
            <span className="save-status">
              <span className={status === '저장 실패' ? 'bad-dot' : 'status-dot'} />
              {status}
            </span>
            <button
              className="quiet"
              onClick={() =>
                flush()
                  .then(() => {
                    setHistory(state.current.history);
                  })
                  .catch(showError)
              }
              title="저장 이력"
            >
              <Icon name="clock" />
            </button>
            <button className="export-button" disabled={busy || !current} onClick={exportPDF}>
              <Icon name="download" /> {busy ? '처리 중…' : 'PDF 내보내기'}
            </button>
          </div>
        </header>
        <div className="document-heading">
          <div>
            <p className="eyebrow">YOUR WORDS, YOUR WAY</p>
            <h1>{current?.name || '나의 이야기를 다듬는 곳'}</h1>
            <p className="heading-note">글을 클릭해서 수정하고, 필요한 내용만 골라 담으세요.</p>
          </div>
          <button className={'preview-button ' + (preview ? 'on' : '')} onClick={togglePreview}>
            <Icon name="eye" />
            {preview ? '편집으로 돌아가기' : '제외 항목 숨기기'}
          </button>
        </div>
        <div className="editor-modes">
          <div role="group" aria-label="편집 모드">
            <button
              aria-pressed={editMode === 'blocks'}
              disabled={busy || !current}
              onClick={() => setEditMode('blocks')}
            >
              블록 모드
            </button>
            <button
              aria-pressed={editMode === 'layout'}
              disabled={busy || !current}
              onClick={() => setEditMode('layout')}
            >
              레이아웃 모드
            </button>
          </div>
          <p>
            {editMode === 'blocks'
              ? '글과 순서에 집중 · PDF는 원래 지면으로 출력'
              : 'A4 지면에서 크기·여백·색·배치 조절'}
          </p>
        </div>
        {editMode === 'blocks' && (
          <BlockTools
            selection={selection}
            action={selectedAction}
            menu={blockMenu}
            setMenu={(value) => {
              setSlashConvert(false);
              setBlockMenu(value);
            }}
            convert={slashConvert}
            disabled={busy || !current}
          />
        )}
        <EditorToolbar
          selectedAction={selectedAction}
          editChart={editChart}
          draw={draw}
          setZoom={setZoom}
          zoom={zoom}
        />
        <SelectionTools
          selection={selection}
          boxMode={boxMode}
          setBoxMode={setBoxMode}
          action={selectedAction}
          onSettings={() => {
            setRightTab('settings');
            setSettingsOpen(true);
          }}
          onDelete={deleteSelected}
          disabled={busy || !current}
          layout={editMode === 'layout'}
        />
        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button onClick={() => setError('')}>닫기</button>
          </div>
        )}
        {pdf && (
          <div className="success-banner">
            <Icon name="check" />
            <span>PDF 저장 완료 · {pdf.path}</span>
            <a href={pdf.url} download>
              다운로드 ↗
            </a>
          </div>
        )}
        <div className="canvas-scroll">
          <div className="canvas-title">
            <span>
              {editMode === 'blocks'
                ? '블록 보기 · 지면 배치는 레이아웃 모드에서 확인'
                : 'A4 · 210 × 297 mm'}
            </span>
            <span>{metrics.pages} 페이지</span>
          </div>
          {metrics.warnings.length > 0 && (
            <div className="overflow-note">
              페이지 {metrics.warnings.join(', ')}의 내용이 A4 영역을 넘을 수 있어요. 여백을
              줄이거나 새 페이지로 나눠 주세요.
            </div>
          )}
          <div
            className="paper-position"
            style={{ width: (816 * zoom) / 100, height: (metrics.height * zoom) / 100 }}
          >
            <iframe
              key={current?.id}
              ref={iframe}
              title="문서 편집 영역"
              sandbox="allow-same-origin"
              srcDoc={frameHtml}
              onLoad={onFrameLoad}
              style={{
                width: 816,
                height: metrics.height,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                pointerEvents: busy ? 'none' : 'auto',
              }}
            />
          </div>
          <button className="add-page" onClick={() => selectedAction('insert', 'page')}>
            <Icon name="plus" /> 페이지 추가
          </button>
          <div className="canvas-foot">문서와 변경 이력은 로컬에 저장됩니다.</div>
        </div>
      </main>
      <Inspector
        setSettingsOpen={setSettingsOpen}
        setRightTab={setRightTab}
        rightTab={rightTab}
        selection={selection}
        selectedAction={selectedAction}
        editChart={editChart}
        draw={draw}
        current={current}
        busy={busy}
        moveCompany={moveCompany}
        companies={companies}
        setNewDoc={setNewDoc}
        apply={apply}
        aiContext={aiContext}
        applyAI={applyAI}
        reviewRequest={reviewRequest}
      />
      {library && (
        <CompanyLibrary
          api={api}
          doc={current}
          prepareRequest={aiContext}
          onClose={() => {
            setLibrary(false);
            refreshCompanies().catch(showError);
          }}
          onReview={(request) => {
            setReviewRequest(request);
            setRightTab('ai');
          }}
        />
      )}
      {chart && (
        <ChartEditor
          initial={chart.model}
          onClose={() => setChart(null)}
          onApply={(model) => {
            engine.current.chart(model, chart.target);
            setChart(null);
            notify('그래프를 HTML에 반영했습니다.');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
      {newDoc && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={create}>
            <span className="eyebrow">A FRESH START</span>
            <h2>{newDoc.copyId ? '사본 만들기' : '새 문서 만들기'}</h2>
            <p>원하는 이름으로 나만의 문서를 시작하세요.</p>
            <label>
              문서 이름
              <input
                autoFocus
                required
                value={newDoc.name}
                onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
              />
            </label>
            <label>
              회사 폴더
              <select
                value={newDoc.companyId || ''}
                onChange={(e) => setNewDoc({ ...newDoc, companyId: e.target.value })}
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
            <label>
              시작할 문서
              <select
                value={newDoc.copyId || ''}
                onChange={(e) => setNewDoc({ ...newDoc, copyId: e.target.value || null })}
              >
                <option value="">새로 작성</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {newDoc.copyId && <p>현재 저장된 내용을 복사합니다. 원래 문서는 변경되지 않습니다.</p>}
            {!newDoc.copyId && (
              <label className="format-choice">
                문서 형식
                <select
                  aria-label="새 문서 형식"
                  value={newDoc.documentFormat || 'blank'}
                  onChange={(e) => setNewDoc({ ...newDoc, documentFormat: e.target.value })}
                >
                  <option value="blank">빈 A4 문서</option>
                  <option value="blocks">블록형 문서 · 소개 / 프로젝트 / 활동</option>
                  <option value="two-column">2열 문서 · 소개와 프로젝트 분리</option>
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setNewDoc(null)}>
                취소
              </button>
              <button className="primary" disabled={busy}>
                만들기
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <DeleteDialog
          label={deleteTarget.label}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {companyForm && (
        <div className="modal-backdrop">
          <form className="small-modal" onSubmit={createCompany}>
            <h2>회사 추가</h2>
            <p>회사별 자료와 지원 문서를 같은 회사로 관리합니다.</p>
            <label>
              회사 이름
              <input
                autoFocus
                required
                maxLength={100}
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              />
            </label>
            <label>
              지원 직무
              <input
                maxLength={150}
                value={companyForm.role}
                onChange={(e) => setCompanyForm({ ...companyForm, role: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setCompanyForm(null)}>
                취소
              </button>
              <button className="primary" disabled={busy}>
                추가
              </button>
            </div>
          </form>
        </div>
      )}
      {history && (
        <div className="modal-backdrop">
          <div className="small-modal">
            <span className="eyebrow">LOCAL HISTORY</span>
            <h2>저장 이력</h2>
            <p>추가·삭제·수정 차이를 기록해 이전 내용으로 돌아갈 수 있습니다.</p>
            <div className="history-list">
              <button onClick={() => restore(0)}>
                최초 원본으로 복원 <Icon name="undo" />
              </button>
              {[...history].reverse().map((h) => (
                <button key={h.revision} onClick={() => restore(h.revision)}>
                  <span>
                    #{h.revision} · {h.reason}
                    <small>{new Date(h.at).toLocaleString('ko-KR')}</small>
                  </span>
                  <Icon name="undo" />
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setHistory(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
      {diagram && (
        <div className="diagram-modal">
          <Suspense fallback={<div className="loading">다이어그램 편집기를 여는 중…</div>}>
            <Diagram
              initial={diagram.scene}
              onClose={() => setDiagram(null)}
              onInsert={(svg, scene) => {
                engine.current.diagram(svg, scene, diagram.target);
                setDiagram(null);
                notify('다이어그램을 문서에 넣었습니다.');
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
