import { chartTarget, writeChart, validateChart } from '../charts/charts.js';
import {
  BLOCK_CSS,
  blockKind,
  textBlock,
  insertBlock,
  convertBlock,
  removeBlock,
  splitBlock,
} from './blocks.js';
export const EDITOR_CSS = `
html{scroll-behavior:smooth} body{background:#e8ebe9!important;padding:22px 0!important;min-height:0!important}
.page{margin:0 auto 26px!important;box-shadow:0 3px 18px #24372c14!important}
body:not(:has(.page)){padding:40px!important;background:white!important;min-height:297mm;width:210mm;margin:22px auto!important;box-sizing:border-box}
[data-studio-id]:hover{outline:1px dashed #86aca2;outline-offset:3px}
[data-studio-selected]{outline:2px solid #237966!important;outline-offset:4px}
[contenteditable=true]{cursor:text;min-height:1em}
[contenteditable=true]:focus{outline:2px solid #237966!important;outline-offset:4px}
[data-excluded=true]{opacity:.28;outline:1px dashed #c47669!important;filter:grayscale(1)}
html[data-studio-preview] [data-excluded=true]{display:none!important}
html[data-studio-preview] [data-studio-id]{outline:none!important}
svg *:hover{outline:none!important}
.studio-diagram svg{width:100%;height:auto;display:block}
`;
const textTags = 'h1,h2,h3,h4,h5,h6,p,li,figcaption,dt,dd,td,th,blockquote';
const blockTags = `${textTags},section,article,header,footer,main,figure,div,ul,ol,nav,aside,hr,table`;
export function prepare(html, base) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv]').forEach((n) => n.remove());
  d.querySelectorAll('*').forEach((el) =>
    [...el.attributes].forEach((a) => {
      if (a.name.startsWith('on')) el.removeAttribute(a.name);
    }),
  );
  const b = d.createElement('base');
  b.href = base;
  b.dataset.studioTemporary = '';
  d.head.prepend(b);
  const csp = d.createElement('meta');
  csp.httpEquiv = 'Content-Security-Policy';
  csp.content =
    "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; script-src 'none'; connect-src 'none'; form-action 'none'";
  csp.dataset.studioTemporary = '';
  d.head.prepend(csp);
  const style = d.createElement('style');
  style.dataset.studioTemporary = '';
  style.textContent = EDITOR_CSS + BLOCK_CSS;
  d.head.append(style);
  return '<!doctype html>' + d.documentElement.outerHTML;
}
export class DocumentEditor {
  constructor(frame, { onChange, onSelect, onOutline, onMetrics, onSlash }) {
    this.frame = frame;
    this.doc = frame.contentDocument;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onOutline = onOutline;
    this.onMetrics = onMetrics;
    this.undoStack = [];
    this.redoStack = [];
    this.lastInput = 0;
    this.selected = null;
    this.mode = 'layout';
    this.onSlash = onSlash;
    this.bind();
  }
  bind() {
    this.instrument();
    this.doc.addEventListener('click', (e) => {
      if (e.target.closest('a')) e.preventDefault();
      const node = this.boxMode
        ? e.target.closest('figure,div,article,section,header,footer,aside,ul,ol,table')
        : e.target.closest('svg')?.closest('figure,.diagram') ||
          e.target.closest('[data-studio-id]');
      if (node) this.select(node);
    });
    this.doc.addEventListener('mousedown', (e) => {
      if (this.boxMode) e.preventDefault();
    });
    this.doc.addEventListener('beforeinput', (e) => {
      if (this.boxMode) {
        e.preventDefault();
        return;
      }
      if (Date.now() - this.lastInput > 700) this.checkpoint();
      this.lastInput = Date.now();
    });
    this.doc.addEventListener('input', () => {
      this.changed(false);
    });
    this.doc.addEventListener('focusout', () => this.instrument());
    this.doc.addEventListener('paste', (e) => {
      e.preventDefault();
      if (this.boxMode) return;
      this.checkpoint();
      this.doc.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      this.changed();
    });
    this.doc.addEventListener('keydown', (e) => {
      if (this.mode === 'blocks' && !e.isComposing && e.keyCode !== 229) {
        const block = textBlock(e.target);
        if (
          e.key === '/' &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey &&
          block &&
          !block.textContent.trim()
        ) {
          e.preventDefault();
          this.select(block);
          this.onSlash?.();
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && splitBlock(this, e))
          return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.onChange(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo(e.shiftKey);
      }
    });
    this.doc.addEventListener('selectionchange', () => {
      const s = this.doc.getSelection();
      if (s?.rangeCount && this.doc.body.contains(s.anchorNode))
        this.range = s.getRangeAt(0).cloneRange();
    });
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.doc.body);
    this.measure();
  }
  destroy() {
    this.resizeObserver?.disconnect();
  }
  instrument() {
    if (!this.doc.querySelector('#studio-output-rules')) {
      const rules = this.doc.createElement('style');
      rules.id = 'studio-output-rules';
      rules.textContent =
        '@media print{[data-excluded="true"]{display:none!important}} .studio-diagram svg{display:block;width:100%;height:auto}';
      this.doc.head.append(rules);
    }
    this.doc.querySelectorAll(blockTags).forEach((el) => {
      if (el.closest('svg')) return;
      el.dataset.studioId ||= crypto.randomUUID();
    });
    this.doc.querySelectorAll(textTags + ',span,b,strong,a,div').forEach((el) => {
      if (
        el.matches('.chart-track,.axis-years') ||
        (el.closest('.studio-value-chart') && !el.matches('figcaption'))
      ) {
        el.removeAttribute('contenteditable');
        return;
      }
      if (
        el.closest('svg') ||
        el.closest('[contenteditable=true]') ||
        el.querySelector('svg,img,section,article,div,p,ul,ol,h1,h2,h3,table')
      )
        return;
      if (el.matches('div,span,b,strong,a') && !el.textContent.trim()) return;
      el.dataset.studioId ||= crypto.randomUUID();
      el.contentEditable = 'true';
      el.spellcheck = false;
    });
    this.outline();
  }
  serialize() {
    const root = this.doc.documentElement.cloneNode(true);
    root.removeAttribute('data-studio-preview');
    root.removeAttribute('data-studio-mode');
    root.querySelectorAll('[data-studio-temporary]').forEach((n) => n.remove());
    root.querySelectorAll('*').forEach((el) => {
      ['contenteditable', 'spellcheck', 'data-studio-selected'].forEach((a) =>
        el.removeAttribute(a),
      );
    });
    return '<!doctype html>\n' + root.outerHTML;
  }
  checkpoint() {
    const s = this.serialize();
    if (this.undoStack.at(-1) !== s) this.undoStack.push(s);
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
  }
  restore(html) {
    const fresh = new DOMParser().parseFromString(html, 'text/html');
    const temporary = [...this.doc.head.querySelectorAll('[data-studio-temporary]')].map((n) =>
      n.cloneNode(true),
    );
    this.doc.head.replaceChildren(
      ...[...fresh.head.childNodes].map((n) => this.doc.importNode(n, true)),
      ...temporary,
    );
    this.doc.body.replaceWith(this.doc.importNode(fresh.body, true));
    this.resizeObserver.disconnect();
    this.resizeObserver.observe(this.doc.body);
    this.selected = null;
    this.onSelect(null);
    this.instrument();
    this.changed();
  }
  undo(redo = false) {
    const from = redo ? this.redoStack : this.undoStack,
      to = redo ? this.undoStack : this.redoStack;
    if (!from.length) return;
    to.push(this.serialize());
    this.restore(from.pop());
  }
  select(el, scroll = false) {
    this.doc
      .querySelectorAll('[data-studio-selected]')
      .forEach((n) => n.removeAttribute('data-studio-selected'));
    this.selected = el;
    el.dataset.studioSelected = '';
    this.onSelect(this.describe(el));
    if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  selectId(id) {
    const el = this.doc.querySelector(`[data-studio-id="${id}"]`);
    if (el) this.select(el, true);
  }
  describe(el) {
    const css = this.frame.contentWindow.getComputedStyle(el);
    return {
      innerTextBlocks: this.innerTextBlocks(el),
      blockKind: blockKind(el),
      chart: !!chartTarget(el),
      id: el.dataset.studioId,
      label: this.label(el),
      tag: el.tagName.toLowerCase(),
      excluded: el.dataset.excluded === 'true',
      fontSize: parseFloat(css.fontSize),
      lineHeight: parseFloat(css.lineHeight) / parseFloat(css.fontSize),
      padding: parseFloat(css.paddingTop),
      gap: parseFloat(css.gap) || 0,
      width: Math.round(el.getBoundingClientRect().width),
      radius: parseFloat(css.borderRadius) || 0,
      color: css.color,
      background: css.backgroundColor,
      display: css.display,
      svg: !!el.querySelector('svg'),
      scene: !!el.dataset.scene,
      labels: [...el.querySelectorAll('svg text')].map((n, i) => ({
        index: i,
        text: n.textContent,
      })),
      parent: el.parentElement?.dataset.studioId,
    };
  }
  setMode(mode) {
    this.mode = mode === 'blocks' ? 'blocks' : 'layout';
    this.doc.documentElement.dataset.studioMode = this.mode;
    if (this.selected?.isConnected) this.onSelect(this.describe(this.selected));
    this.measure();
  }
  insertBlock(kind) {
    return insertBlock(this, kind);
  }
  convertBlock(kind) {
    return convertBlock(this, kind);
  }
  removeBlock() {
    return removeBlock(this);
  }
  setBoxMode(enabled) {
    this.boxMode = !!enabled;
    this.range = null;
    this.doc.activeElement?.blur();
    this.doc.getSelection()?.removeAllRanges();
  }
  innerTextBlocks(el) {
    return [...el.querySelectorAll('[contenteditable=true]')]
      .filter((n) => n.dataset.studioId)
      .map((n, i) => ({
        id: n.dataset.studioId,
        label: `${/^H[1-6]$/.test(n.tagName) ? '제목' : '텍스트'} ${i + 1} · ${n.textContent.trim().slice(0, 40) || '(빈 텍스트 블록)'}`,
      }));
  }
  deletionError(el = this.selected) {
    if (!el?.isConnected || el.ownerDocument !== this.doc)
      return '삭제할 블록을 먼저 선택해 주세요.';
    if (el.matches('html,body,main')) return '문서 전체 영역은 삭제할 수 없습니다.';
    const pages = [...this.doc.querySelectorAll('.page')];
    if (pages.length && pages.every((p) => p === el || el.contains(p)))
      return '마지막 페이지는 삭제할 수 없습니다.';
    if (el.closest('.studio-value-chart') && !el.matches('.studio-value-chart'))
      return '그래프 내부 항목은 그래프 데이터 편집에서 수정해 주세요.';
    return null;
  }
  removeSelected() {
    const reason = this.deletionError();
    if (reason) throw Error(reason);
    this.mutate(() => {
      this.selected.remove();
      this.selected = null;
      this.range = null;
      this.doc.getSelection()?.removeAllRanges();
      this.onSelect(null);
    });
  }
  label(el) {
    return (
      el.dataset.section ||
      el.querySelector('h1,h2,h3,figcaption,b,strong')?.textContent ||
      el.textContent ||
      (el.querySelector('svg') ? '다이어그램' : el.tagName.toLowerCase())
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
  }
  outline() {
    const pages = [...this.doc.querySelectorAll('.page')];
    if (!pages.length) pages.push(this.doc.body);
    const result = pages.map((page, i) => {
      const candidates = [...page.querySelectorAll('[data-studio-id]')].filter(
        (n) =>
          n.closest('.page') === (page === this.doc.body ? null : page) &&
          (n.matches('figure,.studio-value-chart') || !n.closest('figure,.studio-value-chart')) &&
          (n.parentElement === page ||
            n.matches('[data-section],article,.card,.case-card') ||
            n.parentElement?.matches('article') ||
            n.matches('article li')),
      );
      const chosen = new Set(candidates);
      return {
        id: page.dataset.studioId,
        index: i + 1,
        label: this.label(page),
        excluded: page.dataset.excluded === 'true',
        items: candidates.map((n) => {
          let depth = 0;
          for (let p = n.parentElement; p && p !== page; p = p.parentElement)
            if (chosen.has(p)) depth++;
          return {
            id: n.dataset.studioId,
            label: this.label(n),
            excluded: n.dataset.excluded === 'true',
            depth: Math.min(depth, 3),
          };
        }),
      };
    });
    this.onOutline(result);
  }
  measure() {
    const pages = [...this.doc.querySelectorAll('.page')].filter(
      (p) => p.dataset.excluded !== 'true',
    );
    const warnings =
      this.mode === 'blocks'
        ? []
        : pages.flatMap((p, i) => {
            const rect = p.getBoundingClientRect();
            const outside = [...p.querySelectorAll('p,h1,h2,h3,article,figure,li')]
              .filter((n) => !n.closest('[data-excluded=true]'))
              .some(
                (n) =>
                  n.getBoundingClientRect().bottom > rect.bottom + 2 ||
                  n.getBoundingClientRect().right > rect.right + 2,
              );
            return rect.height > 1124 || outside ? [i + 1] : [];
          });
    this.onMetrics({
      height: Math.max(400, Math.ceil(this.doc.body.getBoundingClientRect().height + 44)),
      pages: pages.length || 1,
      warnings,
    });
  }
  changed(refresh = true) {
    if (refresh) {
      this.instrument();
      if (this.selected?.isConnected) this.onSelect(this.describe(this.selected));
    }
    this.measure();
    this.onChange();
  }
  mutate(fn) {
    this.checkpoint();
    fn();
    this.changed();
  }
  toggle(id, include) {
    const el = this.doc.querySelector(`[data-studio-id="${id}"]`);
    if (el)
      this.mutate(() => {
        if (include) delete el.dataset.excluded;
        else el.dataset.excluded = 'true';
      });
  }
  style(key, value) {
    if (!this.selected) return;
    this.mutate(() => {
      this.selected.style[key] = value;
    });
  }
  textStyle(command, value) {
    this.checkpoint();
    this.frame.contentWindow.focus();
    const s = this.doc.getSelection();
    if (this.range) {
      s.removeAllRanges();
      s.addRange(this.range);
    }
    this.doc.execCommand(command, false, value);
    this.changed();
  }
  layout(columns) {
    if (!this.selected) return;
    this.mutate(() => {
      Object.assign(this.selected.style, {
        display: columns === '1' ? 'block' : 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: '12px',
      });
    });
  }
  parent() {
    const p = this.selected?.parentElement;
    if (p && p !== this.doc.body && p.dataset.studioId) this.select(p);
  }
  move(direction) {
    const el = this.selected;
    if (!el) return;
    this.mutate(() => {
      if (direction < 0 && el.previousElementSibling) el.previousElementSibling.before(el);
      if (direction > 0 && el.nextElementSibling) el.nextElementSibling.after(el);
    });
  }
  duplicate() {
    if (!this.selected) return;
    this.mutate(() => {
      const copy = this.selected.cloneNode(true);
      [copy, ...copy.querySelectorAll('[data-studio-id]')].forEach((n) => {
        delete n.dataset.studioId;
        delete n.dataset.studioSelected;
      });
      this.selected.after(copy);
      this.instrument();
      this.select(copy);
    });
  }
  insert(kind, html) {
    this.mutate(() => {
      const el = this.doc.createElement(
        kind === 'page'
          ? 'section'
          : kind === 'text'
            ? 'p'
            : kind === 'heading'
              ? 'h2'
              : kind === 'diagram' || kind === 'chart'
                ? 'figure'
                : 'div',
      );
      if (kind === 'page') {
        el.className = 'page';
        el.innerHTML = '<h1>새 페이지</h1><p>내용을 입력하세요.</p>';
        const pages = this.doc.querySelectorAll('.page');
        if (pages.length) pages[pages.length - 1].after(el);
        else this.doc.body.append(el);
      } else {
        if (kind === 'text') el.textContent = '새로운 내용을 입력하세요.';
        if (kind === 'heading') el.textContent = '새 제목';
        if (kind === 'box') {
          el.innerHTML = '<h3>제목</h3><p>내용을 입력하세요.</p>';
          Object.assign(el.style, {
            padding: '16px',
            border: '1px solid #d7e0e8',
            borderRadius: '10px',
            margin: '12px 0',
            background: '#f7f9fb',
          });
        }
        if (kind === 'columns') {
          el.innerHTML =
            '<article style="padding:16px;border:1px solid #d7e0e8;border-radius:10px"><h3>첫 번째</h3><p>내용을 입력하세요.</p></article><article style="padding:16px;border:1px solid #d7e0e8;border-radius:10px"><h3>두 번째</h3><p>내용을 입력하세요.</p></article>';
          Object.assign(el.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            margin: '12px 0',
          });
        }
        if (kind === 'diagram') {
          el.className = 'studio-diagram';
          el.style.margin = '16px 0';
          el.innerHTML = html || '';
        }
        const target = this.selected?.matches('span,b,strong,a,em,i,u')
          ? this.selected.closest(blockTags)
          : this.selected;
        if (target?.matches('.page,main,body')) target.append(el);
        else if (target?.parentElement && target !== this.doc.body) target.after(el);
        else (this.doc.querySelector('.page') || this.doc.body).append(el);
      }
      this.instrument();
      this.select(el, true);
    });
    return this.selected;
  }
  diagram(svg, scene, target) {
    if (target) {
      this.mutate(() => {
        target.innerHTML = svg;
        target.dataset.scene = JSON.stringify(scene);
        target.classList.add('studio-diagram');
        this.select(target);
      });
    } else {
      const el = this.insert('diagram', svg);
      el.dataset.scene = JSON.stringify(scene);
      this.changed();
    }
  }
  svgLabel(index, value) {
    const node = this.selected?.querySelectorAll('svg text')[index];
    if (node)
      this.mutate(() => {
        node.textContent = value;
      });
  }
  chart(model, target) {
    validateChart(model);
    if (target)
      this.mutate(() => {
        writeChart(target, model);
        this.select(target);
      });
    else {
      const el = this.insert('chart');
      writeChart(el, model);
      this.changed();
    }
  }
}
