/** TextElement.js — テキスト要素 */
import { mmToPx, ptToPx } from '../utils/coords.js';

export class TextElement {
  constructor(data) {
    this.data = { ...data };
    this.dom = null;
    this._editing = false;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'doc-element el-text';
    el.dataset.id = this.data.id;
    el.dataset.type = 'text';
    this.dom = el;
    this._applyStyle();
    el.addEventListener('dblclick', () => this.startEdit());
    return el;
  }

  _applyStyle() {
    const d = this.data;
    const el = this.dom;
    el.style.left   = mmToPx(d.x) + 'px';
    el.style.top    = mmToPx(d.y) + 'px';
    el.style.width  = mmToPx(d.width) + 'px';
    el.style.height = d.height === 'auto' ? 'auto' : mmToPx(d.height) + 'px';
    el.style.fontFamily  = d.fontFamily === 'serif' ? "'Noto Serif JP', serif" : "'Noto Sans JP', sans-serif";
    el.style.fontSize    = ptToPx(d.fontSize || 10) + 'px';
    el.style.fontWeight  = d.fontWeight || 'normal';
    el.style.fontStyle   = d.fontStyle || 'normal';
    el.style.color       = d.color || '#1e1e1e';
    el.style.background  = d.backgroundColor || 'transparent';
    el.style.textAlign   = d.textAlign || 'left';
    el.style.lineHeight  = d.lineHeight || 1.6;
    el.style.zIndex      = d.zIndex || 1;
    el.textContent = d.content || '';
  }

  updatePosition(x, y) {
    this.data.x = x; this.data.y = y;
    this.dom.style.left = mmToPx(x) + 'px';
    this.dom.style.top  = mmToPx(y) + 'px';
  }

  updateSize(w, h) {
    this.data.width = w; this.data.height = h;
    this.dom.style.width  = mmToPx(w) + 'px';
    this.dom.style.height = mmToPx(h) + 'px';
  }

  updateData(patch) {
    Object.assign(this.data, patch);
    this._applyStyle();
  }

  startEdit() {
    if (this.data.locked || this._editing) return;
    this._editing = true;
    this.dom.contentEditable = 'true';
    this.dom.classList.add('editing');
    this.dom.focus();
    const onBlur = () => {
      this.stopEdit();
      this.dom.removeEventListener('blur', onBlur);
    };
    this.dom.addEventListener('blur', onBlur);
  }

  stopEdit() {
    this._editing = false;
    this.data.content = this.dom.textContent;
    this.dom.contentEditable = 'false';
    this.dom.classList.remove('editing');
    window.dispatchEvent(new CustomEvent('element:changed', { detail: { id: this.data.id, data: this.data } }));
  }

  serialize() {
    return { ...this.data, content: this.dom ? this.dom.textContent : this.data.content };
  }

  destroy() {
    this.dom?.remove();
  }
}
