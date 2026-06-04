/** history.js — Undo/Redo スタック管理 */

export class HistoryManager {
  constructor(maxSize = 50) {
    this._undo = [];
    this._redo = [];
    this._max = maxSize;
  }

  /** 現在状態をスナップショットとして積む */
  push(snapshot) {
    this._undo.push(structuredClone(snapshot));
    if (this._undo.length > this._max) this._undo.shift();
    this._redo = [];
    this._emit();
  }

  /** @returns {Object|null} */
  undo(current) {
    if (!this.canUndo()) return null;
    this._redo.push(structuredClone(current));
    const snap = this._undo.pop();
    this._emit();
    return snap;
  }

  /** @returns {Object|null} */
  redo(current) {
    if (!this.canRedo()) return null;
    this._undo.push(structuredClone(current));
    const snap = this._redo.pop();
    this._emit();
    return snap;
  }

  canUndo() { return this._undo.length > 0; }
  canRedo() { return this._redo.length > 0; }
  clear() { this._undo = []; this._redo = []; this._emit(); }

  _emit() {
    window.dispatchEvent(new CustomEvent('history:changed', {
      detail: { canUndo: this.canUndo(), canRedo: this.canRedo() }
    }));
  }
}
