import React from 'react';
import CompanyFolders from '../features/companies/CompanyFolders.jsx';
import Icon from '../shared/Icon';
import { categories, formatLabels } from '../features/documents/labels';
export default function DocumentSidebar({
  setNewDoc,
  setLibrary,
  tab,
  setTab,
  query,
  setQuery,
  companies,
  docs,
  current,
  busy,
  open,
  setCompanyForm,
  outline,
  selectedAction,
  selection,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-symbol">문</span>
        <div>
          문서 작업실<small>CAREER STUDIO</small>
        </div>
      </div>
      <button className="new-document" onClick={() => setNewDoc({ name: '새 문서', copyId: null })}>
        <Icon name="plus" /> 새 문서
      </button>
      <button className="new-document" onClick={() => setLibrary(true)}>
        <Icon name="file" /> 회사별 자료
      </button>
      <div className="tabs">
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>
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
  );
}
