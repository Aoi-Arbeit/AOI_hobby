/** TableElement.js — 表要素 */
import { mmToPx } from '../utils/coords.js';

export class TableElement {
  constructor(data) {
    this.data = {
      rows: 3, cols: 3,
      headerRow: true,
      borderColor: '#888888',
      borderWidth: 0.5,
      headerBg: '#1a3a5c',
      cells: [],
      ...data
    };
    // cells が空なら初期化
    if (!this.data.cells.length) this._initCells();
    this.dom = null;
  }

  _initCells() {
    this.data.cells = Array.from({ length: this.data.rows }, (_, r) =>
      Array.from({ length: this.data.cols }, (_, c) => ({
        content: r === 0 && this.data.headerRow ? `見出し${c + 1}` : '',
        fontFamily: 'sans', fontSize: 9, fontWeight: 'normal',
        color: '#1e1e1e', backgroundColor: 'transparent', textAlign: 'left',
        colSpan: 1, rowSpan: 1,
      }))
    );
  }

  render() {
    const el = document.createElement('div');
    el.className = 'doc-element el-table';
    el.dataset.id = this.data.id;
    el.dataset.type = 'table';
    this.dom = el;
    this._applyStyle();
    this._buildTable();
    return el;
  }

  _applyStyle() {
    const d = this.data;
    this.dom.style.left   = mmToPx(d.x) + 'px';
    this.dom.style.top    = mmToPx(d.y) + 'px';
    this.dom.style.width  = mmToPx(d.width) + 'px';
    this.dom.style.height = mmToPx(d.height) + 'px';
    this.dom.style.zIndex = d.zIndex || 1;
  }

  _buildTable() {
    this.dom.innerHTML = '';
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    this.data.cells.forEach((row, r) => {
      const tr = document.createElement('tr');
      row.forEach((cell, c) => {
        const td = document.createElement('td');
        td.contentEditable = 'true';
        td.textContent = cell.content;
        td.style.fontSize = cell.fontSize + 'pt';
        td.style.fontWeight = cell.fontWeight;
        td.style.color = cell.color;
        td.style.textAlign = cell.textAlign;
        td.style.background = cell.backgroundColor || 'transparent';
        td.style.borderColor = this.data.borderColor;
        td.style.borderWidth = this.data.borderWidth + 'pt';
        if (r === 0 && this.data.headerRow) {
          td.classList.add('header-cell');
          td.style.background = this.data.headerBg;
          td.style.color = '#fff';
        }
        td.addEventListener('input', () => {
          this.data.cells[r][c].content = td.textContent;
          window.dispatchEvent(new CustomEvent('element:changed', { detail: { id: this.data.id } }));
        });
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    this.dom.appendChild(table);
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
