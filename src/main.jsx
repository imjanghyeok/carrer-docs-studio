import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentEditor, prepare } from './document';
import './style.css';
import './ai.css';
import ChartEditor from './ChartEditor';
import { chartTarget, readChart } from './charts';
import AIChat from './AIChat';
import CompanyLibrary from './CompanyLibrary';
import BlockTools from './BlockTools';
import CompanyFolders from './CompanyFolders';
import { SelectionTools, DeleteDialog } from './SelectionTools';
import './organization.css';
const Diagram = lazy(() => import('./Diagram'));

let token;
async function api(url, body, retried = false) {
  if (!token) token = (await (await fetch('/api/config')).json()).token;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Studio-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // A local server restart rotates the token; preserve the open editor and retry once.
  if (res.status === 403 && !retried) {
    token = null;
    return api(url, body, true);
  }
  const data = await res.json();
  if (!res.ok) throw Error(data.error || '요청에 실패했습니다.');
  return data;
}
const categories = {
  resume: '이력서',
  portfolio: '포트폴리오',
  'cover-letter': '자기소개서',
  'personal-statement': '통합 소개서',
  custom: '내 문서',
};
const formatLabels = {
  document: '문서형',
  visual: '그래프형',
  'pr-focused': 'PR 중심형',
  detailed: '상세형',
  narrative: '내러티브형',
  general: '범용형',
  integrated: '통합형',
  custom: '자유형',
};
function Icon({ name, size = 18 }) {
  const paths = {
    file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    plus: 'M12 5v14 M5 12h14',
    undo: 'M9 5L4 10l5 5 M4 10h9a7 7 0 0 1 7 7',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    draw: 'M4 17l12-12 3 3-12 12-4 1z M14 7l3 3',
    check: 'M4 12l5 5L20 6',
    box: 'M4 4h16v16H4z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
function App() {
  const [rightTab, setRightTab] = useState('settings');
  const [companies, setCompanies] = useState([]),
    [companyForm, setCompanyForm] = useState(null),
    [boxMode, setBoxMode] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [deleteTarget, setDeleteTarget] = useState(null);
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
    const editor = engine.current,
      target = deleteTarget?.element;
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
    ),
    [blockMenu, setBlockMenu] = useState(false),
    [slashConvert, setSlashConvert] = useState(false);
  const modeRef = useRef(editMode);
  modeRef.current = editMode;
  useEffect(() => {
    engine.current?.setMode(editMode);
    setBoxMode(false);
    localStorage.setItem('career-studio-mode', editMode);
    setBlockMenu(false);
  }, [editMode]);
  const [library, setLibrary] = useState(false),
    [reviewRequest, setReviewRequest] = useState(null);
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
  const [docs, setDocs] = useState([]),
    [current, setCurrent] = useState(null),
    [frameHtml, setFrameHtml] = useState(''),
    [selection, setSelection] = useState(null),
    [outline, setOutline] = useState([]),
    [metrics, setMetrics] = useState({ height: 1200, pages: 1, warnings: [] }),
    [zoom, setZoom] = useState(85),
    [status, setStatus] = useState('준비'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [diagram, setDiagram] = useState(null),
    [history, setHistory] = useState(null),
    [newDoc, setNewDoc] = useState(null),
    [query, setQuery] = useState(''),
    [tab, setTab] = useState('documents'),
    [toast, setToast] = useState(''),
    [pdf, setPdf] = useState(null);
  const iframe = useRef(),
    engine = useRef(),
    state = useRef(),
    timer = useRef(),
    saving = useRef(Promise.resolve()),
    dirty = useRef(false),
    currentRef = useRef(),
    loadedHTML = useRef('');
  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };
  const endpoint = () => '/api/documents/' + state.current.doc.id;
  async function flush() {
    clearTimeout(timer.current);
    saving.current = saving.current
      .catch(() => {})
      .then(async () => {
        if (!engine.current || !state.current || !dirty.current) return;
        const html = engine.current.serialize();
        const id = state.current.doc.id;
        setStatus('저장 중…');
        try {
          const result = await api('/api/documents/' + id + '/save', {
            html,
            revision: state.current.revision,
          });
          if (state.current.doc.id !== id) return;
          state.current = { ...state.current, ...result };
          loadedHTML.current = html;
          dirty.current = engine.current.serialize() !== html;
          setStatus(dirty.current ? '수정 중' : '자동 저장됨');
          if (dirty.current) timer.current = setTimeout(() => flush().catch(showError), 1000);
        } catch (e) {
          dirty.current = true;
          setStatus('저장 실패');
          throw e;
        }
      });
    return saving.current;
  }
  function showError(e) {
    setError(e.message || String(e));
  }
  function changed(immediate = false) {
    dirty.current = true;
    setPdf(null);
    setStatus('수정 중');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush().catch(showError), immediate ? 0 : 1200);
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
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol">문</span>
          <div>
            문서 작업실<small>CAREER STUDIO</small>
          </div>
        </div>
        <button
          className="new-document"
          onClick={() => setNewDoc({ name: '새 문서', copyId: null })}
        >
          <Icon name="plus" /> 새 문서
        </button>
        <button className="new-document" onClick={() => setLibrary(true)}>
          <Icon name="file" /> 회사별 자료
        </button>
        <div className="tabs">
          <button
            className={tab === 'documents' ? 'active' : ''}
            onClick={() => setTab('documents')}
          >
            내 문서
          </button>
          <button className={tab === 'outline' ? 'active' : ''} onClick={() => setTab('outline')}>
            구성 · 포함
          </button>
        </div>
        {tab === 'documents' ? (
          <div className="document-list">
            <input
              className="search"
              aria-label="문서 검색"
              placeholder="문서 찾기…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <CompanyFolders
              companies={companies}
              docs={docs}
              current={current}
              query={query}
              busy={busy}
              onOpen={open}
              onAdd={() => setCompanyForm({ name: '', role: '' })}
              onNew={(c) =>
                setNewDoc({ name: c.name + ' · 지원 문서', copyId: null, companyId: c.id })
              }
            />
            {Object.entries(categories).map(([kind, title]) => {
              const items = docs.filter(
                (d) =>
                  !d.companyId &&
                  d.kind === kind &&
                  d.name.toLowerCase().includes(query.toLowerCase()),
              );
              return items.length ? (
                <section className="doc-group" key={kind}>
                  <h3>
                    {title}
                    <span>{items.length.toString().padStart(2, '0')}</span>
                  </h3>
                  {items.map((doc) => (
                    <button
                      key={doc.id}
                      disabled={busy}
                      className={'doc-button ' + (current?.id === doc.id ? 'selected' : '')}
                      onClick={() => open(doc)}
                    >
                      <Icon name={doc.format === 'visual' ? 'grid' : 'file'} />
                      <span>{doc.custom ? doc.name : doc.label || formatLabels[doc.format]}</span>
                      {current?.id === doc.id && <i />}
                    </button>
                  ))}
                </section>
              ) : null;
            })}
          </div>
        ) : (
          <div className="outline-list">
            <p className="side-help">
              체크를 끄면 PDF에서 제외됩니다.
              <br />
              다시 체크하면 내용을 복원합니다.
            </p>
            {outline.map((page) => (
              <section key={page.id || page.index} className="page-outline">
                <div className="page-label">
                  {page.id && (
                    <input
                      type="checkbox"
                      aria-label={`페이지 ${page.index} 포함`}
                      checked={!page.excluded}
                      onChange={(e) => selectedAction('toggle', page.id, e.target.checked)}
                    />
                  )}
                  <button onClick={() => page.id && selectedAction('selectId', page.id)}>
                    PAGE {String(page.index).padStart(2, '0')}
                  </button>
                </div>
                {page.items.map((item) => (
                  <div
                    key={item.id}
                    style={{ '--depth': item.depth }}
                    className={
                      'outline-item ' +
                      (item.depth ? 'nested ' : '') +
                      (selection?.id === item.id ? 'chosen' : '')
                    }
                  >
                    <input
                      type="checkbox"
                      aria-label={item.label + ' 포함'}
                      checked={!item.excluded}
                      onChange={(e) => selectedAction('toggle', item.id, e.target.checked)}
                    />
                    <button onClick={() => selectedAction('selectId', item.id)}>
                      {item.label || '빈 블록'}
                    </button>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
        <div className="local-note">
          <span className="local-dot" /> 편집본은 이 컴퓨터에 저장
          <small>AI 요청할 때만 문서 내용 전송</small>
        </div>
      </aside>
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
                  <button onClick={() => selectedAction('style', 'width', 'auto')}>
                    자동 너비
                  </button>
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
function NumberField({ label, value, unit, onChange, ...props }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          aria-label={label}
          key={label + '-' + value}
          defaultValue={value}
          {...props}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (
              Number.isFinite(n) &&
              n !== value &&
              n >= Number(props.min ?? 0) &&
              n <= Number(props.max ?? 999)
            )
              onChange(n);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}
function colorHex(color, fallback = '#202832') {
  if (!color || color === 'rgba(0, 0, 0, 0)') return fallback;
  const rgb = color.match(/\d+/g);
  return rgb?.length >= 3
    ? '#' +
        rgb
          .slice(0, 3)
          .map((x) => Number(x).toString(16).padStart(2, '0'))
          .join('')
    : fallback;
}
createRoot(document.getElementById('root')).render(<App />);
