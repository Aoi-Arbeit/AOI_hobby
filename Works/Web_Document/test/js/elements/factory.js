/** factory.js — 要素ファクトリー */
import { TextElement } from './TextElement.js';
import { ImageElement } from './ImageElement.js';
import { TableElement } from './TableElement.js';

let _idCounter = Date.now();
export function genId() { return 'el_' + (++_idCounter).toString(36); }

const DEFAULTS = {
  text: {
    type: 'text', x: 20, y: 20, width: 100, height: 20,
    content: 'テキスト', fontFamily: 'sans', fontSize: 10,
    fontWeight: 'normal', fontStyle: 'normal',
    color: '#1e1e1e', backgroundColor: 'transparent',
    textAlign: 'left', lineHeight: 1.6, locked: false, zIndex: 1,
  },
  image: {
    type: 'image', x: 20, y: 20, width: 60, height: 40,
    src: '', originalFileName: '', objectFit: 'contain', opacity: 1,
    locked: false, zIndex: 1,
  },
  table: {
    type: 'table', x: 20, y: 20, width: 170, height: 40,
    rows: 3, cols: 3, headerRow: true,
    borderColor: '#888', borderWidth: 0.5, headerBg: '#1a3a5c',
    cells: [], locked: false, zIndex: 1,
  },
};

export class ElementFactory {
  create(type, overrides = {}) {
    const base = DEFAULTS[type];
    if (!base) throw new Error(`Unknown element type: ${type}`);
    const data = { ...base, ...overrides, id: overrides.id || genId() };
    switch (type) {
      case 'text':  return new TextElement(data);
      case 'image': return new ImageElement(data);
      case 'table': return new TableElement(data);
      default: throw new Error(`Unknown element type: ${type}`);
    }
  }
}
