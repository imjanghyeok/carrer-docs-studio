import React, { useEffect, useRef, useState } from 'react';

export default function AIChat({
  doc,
  selection,
  api,
  prepareRequest,
  applyProposal,
  reviewRequest,
}) {
  const [references, setReferences] = useState(null),
    [referencesOpen, setReferencesOpen] = useState(true);
  const [connection, setConnection] = useState(null),
    [connecting, setConnecting] = useState(false),
    [model, setModel] = useState(''),
    [effort, setEffort] = useState(''),
    [scope, setScope] = useState('block'),
    [mode, setMode] = useState('edit'),
    [prompt, setPrompt] = useState(''),
    [items, setItems] = useState([]),
    [error, setError] = useState(''),
    [job, setJob] = useState(null),
    [working, setWorking] = useState(false),
    [characters, setCharacters] = useState(0),
    [consent, setConsent] = useState(false),
    [includeHistory, setIncludeHistory] = useState(true),
    [preview, setPreview] = useState(null);
  const current = useRef(doc?.id),
    scroll = useRef();
  current.current = doc?.id;
  const selectedModel = connection?.models.find((m) => m.id === model);
  async function history() {
    if (!doc) return;
    const id = doc.id,
      data = await api('/api/ai/history?docId=' + encodeURIComponent(id));
    if (current.current !== id) return;
    setItems(data.items);
    setJob(data.active);
  }
  useEffect(() => {
    setItems([]);
    setError('');
    setJob(null);
    setPreview(null);
    setPrompt('');
    setScope('block');
    setReferences(null);
    setConsent(false);
    history().catch((e) => setError(e.message));
  }, [doc?.id]);
  useEffect(() => {
    if (!reviewRequest) return;
    setReferences(reviewRequest);
    setReferencesOpen(true);
    setScope('materials');
    setMode('ask');
    setPrompt(reviewRequest.prompt);
    setConsent(false);
    setIncludeHistory(false);
    setError('');
  }, [reviewRequest?.key]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
  }, [items.length, characters]);
  useEffect(() => {
    if (!job) return;
    let stopped = false;
    const poll = async () => {
      try {
        const state = await api('/api/ai/job?id=' + encodeURIComponent(job));
        if (stopped) return;
        setCharacters(state.characters || 0);
        if (state.status !== 'running') {
          setJob(null);
          if (state.error) setError(state.error);
          await history();
        }
      } catch (e) {
        if (!stopped) {
          setJob(null);
          setError(e.message);
        }
      }
    };
    const timer = setInterval(poll, 1000);
    poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [job, doc?.id]);
  async function connect() {
    setConnecting(true);
    setError('');
    try {
      const data = await api('/api/ai/connect', {});
      setConnection(data);
      const m =
        data.models.find((m) => m.id === model) ||
        data.models.find((m) => m.default) ||
        data.models[0];
      setModel(m?.id || '');
      setEffort(m?.defaultEffort || m?.efforts[0] || '');
      if (!data.loggedIn) setError('터미널에서 codex login 후 다시 연결해 주세요.');
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    if (!doc || job || working) return;
    setWorking(true);
    setError('');
    const id = doc.id;
    try {
      const context = await prepareRequest(scope);
      if (current.current !== id) throw Error('문서가 바뀌었습니다. 다시 요청해 주세요.');
      const result = await api('/api/ai/request', {
        ...context,
        prompt,
        model,
        effort,
        mode,
        consent,
        includeHistory,
        references:
          scope === 'materials' && references
            ? {
                companyId: references.companyId,
                materialIds: references.materials.map((m) => m.id),
              }
            : undefined,
      });
      if (current.current === id) {
        setPrompt('');
        setReferencesOpen(false);
        setCharacters(0);
        setJob(result.id);
        await history();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  async function decide(record, action) {
    setWorking(true);
    setError('');
    try {
      if (action === 'apply') await applyProposal(record.id);
      else await api('/api/ai/decide', { docId: doc.id, messageId: record.id, action });
      setPreview(null);
      await history();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="ai-chat">
      <div className="ai-connection">
        <div>
          <b>Codex</b>
          <small>
            {connection?.loggedIn
              ? `${connection.authType === 'chatgpt' ? 'ChatGPT 로그인' : 'CLI 로그인'} 연결됨`
              : '내 컴퓨터의 Codex CLI 사용'}
          </small>
        </div>
        <button disabled={connecting || !!job} onClick={connect}>
          {connecting ? '연결 중…' : connection ? '다시 연결' : 'Codex 연결'}
        </button>
      </div>
      {connection && (
        <div className="ai-models">
          <label>
            모델
            <select
              aria-label="Codex 모델"
              value={model}
              disabled={!!job}
              onChange={(e) => {
                setModel(e.target.value);
                const m = connection.models.find((m) => m.id === e.target.value);
                setEffort(m.defaultEffort || m.efforts[0]);
              }}
            >
              {connection.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            추론 강도
            <select
              aria-label="추론 강도"
              value={effort}
              disabled={!!job}
              onChange={(e) => setEffort(e.target.value)}
            >
              {selectedModel?.efforts.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="ai-messages" ref={scroll}>
        {!items.length && (
          <div className="ai-welcome">
            <span>✦</span>
            <h3>문서를 보면서 부탁하세요</h3>
            <p>
              “이 소개를 자연스럽게 다듬어줘”
              <br />
              “이 박스 간격을 줄여줘”
              <br />
              “이 프로젝트 설명에서 부족한 점은?”
            </p>
            <p>
              수정안은 확인 후 적용합니다.
              <br />
              HTML·CSS 원본은 유지합니다.
            </p>
          </div>
        )}
        {items.map((item) => (
          <article key={item.id} className={'ai-message ' + item.role}>
            <div className="ai-message-meta">
              {item.role === 'user' ? '나' : item.role === 'assistant' ? 'Codex' : '안내'}
              <span>{item.scope || ''}</span>
            </div>
            <p>{item.text}</p>
            {item.warning && <p className="ai-warning">{item.warning}</p>}
            {item.edits?.length > 0 && (
              <div className="ai-proposal-actions">
                <button onClick={() => setPreview(item)}>
                  변경 내용 {item.edits.length}개 보기
                </button>
                {item.decision ? (
                  <small>{item.decision === 'applied' ? '적용한 수정안' : '취소한 수정안'}</small>
                ) : (
                  <>
                    <button
                      className="primary"
                      disabled={working || !!job || !!item.warning}
                      onClick={() => setPreview(item)}
                    >
                      검토 후 적용
                    </button>
                    <button disabled={working || !!job} onClick={() => decide(item, 'reject')}>
                      수정안 취소
                    </button>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
        {job && (
          <div className="ai-running">
            <span className="status-dot" />
            Codex가 {characters ? '수정안을 작성' : '생각'}하고 있어요
            {characters > 0 && <small>{characters.toLocaleString()}자 수신</small>}
            <button
              onClick={() => api('/api/ai/cancel', { id: job }).catch((e) => setError(e.message))}
            >
              중단
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="ai-error" role="alert">
          {error}
          <button onClick={() => setError('')}>닫기</button>
        </div>
      )}
      <form className="ai-compose" onSubmit={send}>
        <div className="ai-scope">
          <label>
            요청 범위
            <select
              aria-label="AI 요청 범위"
              value={scope}
              disabled={!!job || working}
              onChange={(e) => {
                setScope(e.target.value);
                setConsent(false);
                if (e.target.value === 'materials') setMode('ask');
              }}
            >
              <option value="block">선택 블록</option>
              <option value="page">선택 페이지</option>
              <option value="document">문서 전체</option>
              {references && <option value="materials">선택 자료만</option>}
            </select>
          </label>
          <label>
            동작
            <select
              aria-label="AI 동작"
              value={mode}
              disabled={scope === 'materials' || !!job || working}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="edit">수정안 받기</option>
              <option value="ask">질문만</option>
            </select>
          </label>
        </div>
        <div className="ai-selection">
          {scope === 'materials'
            ? '현재 편집 문서 제외 · 원문 자동 수정 없음'
            : scope === 'document'
              ? doc?.name
              : selection
                ? selection.label
                : '문서에서 글자나 박스를 먼저 선택하세요.'}
        </div>
        {scope === 'materials' && references && (
          <div className="ai-references">
            <button
              type="button"
              className="ai-reference-toggle"
              aria-expanded={referencesOpen}
              onClick={() => setReferencesOpen((v) => !v)}
            >
              {referencesOpen ? '▾' : '▸'} {references.companyName} · 전송할 자료{' '}
              {references.materials.length}개
            </button>
            {referencesOpen && (
              <>
                <ul>
                  {references.materials.map((m) => (
                    <li key={m.id}>
                      {m.name} · {m.textLength.toLocaleString()}자
                    </li>
                  ))}
                </ul>
                <p>
                  위 자료의 추출 텍스트·회사명·직무·출처 URL을 보냅니다. PDF 이미지와 배치는
                  포함하지 않습니다.
                </p>
                <button
                  type="button"
                  disabled={!!job || working}
                  onClick={() => {
                    setReferences(null);
                    setScope('document');
                    setConsent(false);
                    setPrompt('');
                  }}
                >
                  자료 연결 해제
                </button>
              </>
            )}
          </div>
        )}
        <textarea
          aria-label="Codex 요청"
          placeholder="어떻게 다듬을까요?"
          value={prompt}
          maxLength={6000}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.form.requestSubmit();
            }
          }}
        />
        <label className="ai-consent">
          <input
            type="checkbox"
            checked={includeHistory}
            onChange={(e) => setIncludeHistory(e.target.checked)}
          />
          {scope === 'materials'
            ? '같은 자료 조합의 최근 대화도 함께 보내기'
            : '이 문서의 최근 대화도 함께 보내기'}
        </label>
        <label className="ai-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          요청문과 선택 범위를 OpenAI로 전송하는 데 동의
        </label>
        <div className="ai-send">
          <small>Codex 사용 한도 적용 · ⌘ Enter</small>
          <button
            className="primary"
            disabled={
              !connection?.loggedIn ||
              !consent ||
              !prompt.trim() ||
              !!job ||
              working ||
              (!selection && !['document', 'materials'].includes(scope))
            }
          >
            {working ? '처리 중…' : '보내기'}
          </button>
        </div>
      </form>
      {preview && (
        <div className="modal-backdrop">
          <div className="ai-diff-modal" role="dialog" aria-label="AI 수정안 검토">
            <header>
              <div>
                <h2>수정 전후 확인</h2>
                <p>선택한 범위의 HTML 변경입니다. 적용 전에는 문서가 바뀌지 않습니다.</p>
              </div>
              <button onClick={() => setPreview(null)}>닫기</button>
            </header>
            <div className="ai-diff-body">
              {preview.edits.map((edit, i) => (
                <section key={i}>
                  <h3>
                    {i + 1}. {edit.reason || '문서 수정'}
                  </h3>
                  <div className="ai-diff-columns">
                    <div>
                      <small>수정 전</small>
                      <pre>{edit.before}</pre>
                    </div>
                    <div>
                      <small>수정 후</small>
                      <pre>{edit.after}</pre>
                    </div>
                  </div>
                </section>
              ))}
            </div>
            <footer>
              {error ? (
                <p role="alert" className="ai-warning">
                  {error}
                </p>
              ) : preview.warning ? (
                <p>{preview.warning}</p>
              ) : (
                <p>요청 후 직접 수정한 내용이 있으면 덮어쓰지 않고 적용을 막습니다.</p>
              )}
              {!preview.decision && (
                <button
                  className="primary"
                  disabled={working || !!preview.warning || !!job}
                  onClick={() => decide(preview, 'apply')}
                >
                  확인하고 적용
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
