/** storage.js — localStorage ラッパー */

const INDEX_KEY = 'doceditor_index';
const DOC_PREFIX = 'doceditor_doc_';
const DRAFT_KEY = 'doceditor_draft';
const SETTINGS_KEY = 'doceditor_settings';

export class StorageManager {
  /** @returns {{ success: boolean, warning?: string }} */
  save(doc) {
    try {
      const json = JSON.stringify(doc);
      if (json.length > 4 * 1024 * 1024) {
        return { success: false, warning: 'ドキュメントサイズが4MBを超えています。画像を削減してください。' };
      }
      localStorage.setItem(DOC_PREFIX + doc.id, json);
      // インデックス更新
      const idx = this._getIndex();
      if (!idx.includes(doc.id)) idx.unshift(doc.id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
      return { success: true };
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        return { success: false, warning: 'ストレージ容量が不足しています。' };
      }
      throw e;
    }
  }

  /** @returns {Object|null} */
  load(id) {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  /** @returns {Array} */
  list() {
    return this._getIndex().map(id => {
      const doc = this.load(id);
      if (!doc) return null;
      return { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, templateType: doc.templateType };
    }).filter(Boolean);
  }

  remove(id) {
    localStorage.removeItem(DOC_PREFIX + id);
    const idx = this._getIndex().filter(i => i !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  }

  saveDraft(doc) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(doc)); } catch {}
  }

  loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  clearDraft() { localStorage.removeItem(DRAFT_KEY); }

  getSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = { snapEnabled: true, snapGridMm: 5, defaultFontFamily: 'sans', defaultFontSize: 10 };
    if (!raw) return defaults;
    try { return { ...defaults, ...JSON.parse(raw) }; } catch { return defaults; }
  }

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  _getIndex() {
    try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); } catch { return []; }
  }
}
