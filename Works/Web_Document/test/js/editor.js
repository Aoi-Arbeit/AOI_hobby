/** editor.js — EditorController */
import { pxToMm, mmToPx } from './utils/coords.js';
import { ElementFactory } from './elements/factory.js';
import { HistoryManager } from './utils/history.js';

export class EditorController {
  constructor(layout) {
    this._layout = layout;
    this._factory = new ElementFactory();
    this._history = new HistoryManager(50);
    this._elements = [];      // { instance, pageId }
    this._selected = null;
    this._currentPage = null; // 現在アクティブなA4ページDOM
    this._pages = {};         // pageId -> { el: DOMElement, elements: instances[] }
  }

  /** ページを登録する */
  registerPage(pageId, pageEl) {
    this._pages[pageId] = { el: pageEl, elements: [] };
  }

  /** アクティブページを切り替える */
  setCurrentPage(pageId) {
    this._currentPage = this._pages[pageId]?.el || null;
    document.querySelectorAll('.a4-page').forEach(p => p.classList.remove('current-page'));
    if (this._currentPage) this._currentPage.classList.add('current-page');
  }

  /** 要素を追加 */
  addElement(type, opts = {}, pageId = null) {
    const pid = pageId || Object.keys(this._pages)[0];
    const page = this._pages[pid];
    if (!page) return null;
    const inst = this._factory.create(type, opts);
    const dom = inst.render();
    this._makeDraggable(inst, page.el);
    this._makeResizable(inst, page.el);
    page.el.appendChild(dom);
    page.elements.push(inst);
    this._history.push(this._snapshot(pid));
    this.selectElement(inst);
    return inst;
  }

  /** 要素を選択 */
  selectElement(inst) {
    // 前の選択を解除
    if (this._selected) {
      this._selected.dom?.classList.remove('selected');
      this._selected.dom?.querySelectorAll('.resize-handle').forEach(h => h.remove());
    }
    this._selected = inst;
    if (!inst) {
      window.dispatchEvent(new CustomEvent('element:selected', { detail: { element: null } }));
      return;
    }
    inst.dom?.classList.add('selected');
    this._addResizeHandles(inst);
    window.dispatchEvent(new CustomEvent('element:selected', { detail: { element: inst } }));
  }

  /** 選択中要素を削除 */
  deleteSelected() {
    if (!this._selected) return;
    const pid = this._findPageId(this._selected);
    this._selected.destroy();
    if (pid) {
      this._pages[pid].elements = this._pages[pid].elements.filter(e => e !== this._selected);
      this._history.push(this._snapshot(pid));
    }
    this._selected = null;
    window.dispatchEvent(new CustomEvent('element:selected', { detail: { element: null } }));
  }

  /** ページの全要素をシリアライズ */
  serializePage(pageId) {
    return (this._pages[pageId]?.elements || []).map(e => e.serialize());
  }

  /** ページにJSONデータから要素を復元 */
  loadPage(pageId, elements) {
    const page = this._pages[pageId];
    if (!page) return;
    // クリア
    page.elements.forEach(e => e.destroy());
    page.elements = [];
    elements.forEach(data => {
      const inst = this._factory.create(data.type, data);
      const dom = inst.render();
      this._makeDraggable(inst, page.el);
      this._makeResizable(inst, page.el);
      page.el.appendChild(dom);
      page.elements.push(inst);
    });
  }

  // ── Undo/Redo ──
  undo() {
    const pid = Object.keys(this._pages)[0]; // TODO: アクティブページ
    const snap = this._history.undo(this._snapshot(pid));
    if (snap) this.loadPage(snap.pageId, snap.elements);
  }
  redo() {
    const pid = Object.keys(this._pages)[0];
    const snap = this._history.redo(this._snapshot(pid));
    if (snap) this.loadPage(snap.pageId, snap.elements);
  }
  canUndo() { return this._history.canUndo(); }
  canRedo() { return this._history.canRedo(); }

  // ── ドラッグ ──
  _makeDraggable(inst, pageEl) {
    let startMx, startMy, startX, startY;
    inst.dom.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('resize-handle')) return;
      if (inst.data.locked) return;
      if (inst._editing) return;
      e.preventDefault();
      this.selectElement(inst);
      startMx = e.clientX; startMy = e.clientY;
      startX = inst.data.x; startY = inst.data.y;
      inst.dom.setPointerCapture(e.pointerId);

      const onMove = e => {
        const rect = pageEl.getBoundingClientRect();
        const scale = this._layout.getCanvasScale();
        const dx = pxToMm((e.clientX - startMx) / scale);
        const dy = pxToMm((e.clientY - startMy) / scale);
        const clamped = this._layout.clamp(
          this._layout.snapToGrid(startX + dx),
          this._layout.snapToGrid(startY + dy),
          inst.data.width, inst.data.height
        );
        inst.updatePosition(clamped.x, clamped.y);
      };
      const onUp = () => {
        inst.dom.removeEventListener('pointermove', onMove);
        inst.dom.removeEventListener('pointerup', onUp);
        const pid = this._findPageId(inst);
        if (pid) this._history.push(this._snapshot(pid));
        window.dispatchEvent(new CustomEvent('element:changed', { detail: { id: inst.data.id, data: inst.data } }));
      };
      inst.dom.addEventListener('pointermove', onMove);
      inst.dom.addEventListener('pointerup', onUp);
    });
  }

  // ── リサイズハンドル ──
  _addResizeHandles(inst) {
    ['se', 'e', 's'].forEach(dir => {
      const h = document.createElement('div');
      h.className = `resize-handle ${dir}`;
      inst.dom.appendChild(h);
      let startMx, startMy, startW, startH;
      h.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        startMx = e.clientX; startMy = e.clientY;
        startW = inst.data.width; startH = inst.data.height;
        h.setPointerCapture(e.pointerId);
        const scale = this._layout.getCanvasScale();
        const onMove = e => {
          const dw = pxToMm((e.clientX - startMx) / scale);
          const dh = pxToMm((e.clientY - startMy) / scale);
          const nw = Math.max(10, (dir.includes('e') ? startW + dw : startW));
          const nh = Math.max(8,  (dir.includes('s') ? startH + dh : startH));
          inst.updateSize(nw, nh);
        };
        const onUp = () => {
          h.removeEventListener('pointermove', onMove);
          h.removeEventListener('pointerup', onUp);
          const pid = this._findPageId(inst);
          if (pid) this._history.push(this._snapshot(pid));
        };
        h.addEventListener('pointermove', onMove);
        h.addEventListener('pointerup', onUp);
      });
    });
  }

  _makeResizable(inst, pageEl) { /* リサイズはselect時にハンドル追加 */ }

  _findPageId(inst) {
    return Object.keys(this._pages).find(pid =>
      this._pages[pid].elements.includes(inst)
    ) || null;
  }

  _snapshot(pageId) {
    return {
      pageId,
      elements: (this._pages[pageId]?.elements || []).map(e => e.serialize()),
      timestamp: Date.now(),
    };
  }
}
