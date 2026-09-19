import { useRef } from 'react';
import { api } from '../../shared/api';

/** Save queue and dirty tracking. App supplies UI callbacks. */
export function useDocumentSession({ setStatus, setPdf, showError }) {
  const engine = useRef();
  const state = useRef();
  const timer = useRef();
  const saving = useRef(Promise.resolve());
  const dirty = useRef(false);
  const loadedHTML = useRef('');
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
  function changed(immediate = false) {
    dirty.current = true;
    setPdf(null);
    setStatus('수정 중');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush().catch(showError), immediate ? 0 : 1200);
  }

  return { engine, state, timer, dirty, loadedHTML, flush, changed };
}
