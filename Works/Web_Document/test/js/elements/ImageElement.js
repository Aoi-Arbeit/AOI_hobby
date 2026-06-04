/** ImageElement.js — 画像要素 */
import { mmToPx } from '../utils/coords.js';

export class ImageElement {
  constructor(data) {
    this.data = { ...data };
    this.dom = null;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'doc-element el-image';
    el.dataset.id = this.data.id;
    el.dataset.type = 'image';
    this.dom = el;
    this._applyStyle();
    this._buildContent();
    return el;
  }

  _applyStyle() {
    const d = this.data;
    this.dom.style.left   = mmToPx(d.x) + 'px';
    this.dom.style.top    = mmToPx(d.y) + 'px';
    this.dom.style.width  = mmToPx(d.width) + 'px';
    this.dom.style.height = mmToPx(d.height) + 'px';
    this.dom.style.zIndex = d.zIndex || 1;
    this.dom.style.opacity = d.opacity !== undefined ? d.opacity : 1;
  }

  _buildContent() {
    this.dom.innerHTML = '';
    if (this.data.src) {
      const img = document.createElement('img');
      img.src = this.data.src;
      img.alt = this.data.originalFileName || '';
      img.dataset.fit = this.data.objectFit || 'contain';
      this.dom.appendChild(img);
    } else {
      this.dom.innerHTML = `
        <div class="img-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="m3 16 5-5 4 4 3-3 6 6"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
          </svg>
          <span>画像をドロップ</span>
        </div>`;
      // ドロップゾーン
      this.dom.addEventListener('dragover', e => { e.preventDefault(); });
      this.dom.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) this._loadFile(file);
      });
      this.dom.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = () => { if (input.files[0]) this._loadFile(input.files[0]); };
        input.click();
      });
    }
  }

  _loadFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      this.data.src = e.target.result;
      this.data.originalFileName = file.name;
      this._buildContent();
      window.dispatchEvent(new CustomEvent('element:changed', { detail: { id: this.data.id, data: this.data } }));
    };
    reader.readAsDataURL(file);
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

  serialize() { return { ...this.data }; }
  destroy() { this.dom?.remove(); }
}
