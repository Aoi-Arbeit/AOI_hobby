/** main.js — AppController: アプリ初期化・ルーティング */
import { LayoutEngine } from './layout.js';
import { EditorController } from './editor.js';
import { PdfExporter } from './pdfExport.js';
import { StorageManager } from './utils/storage.js';

const storage = new StorageManager();
let layout, editor, exporter;
let pages = [];        // { id, el, templatePage }
let currentPageId = null;
let docTitle = '無題のドキュメント';
let templateType = 'report';

// ── 初期化 ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const canvasArea = document.getElementById('canvasArea');
  layout  = new LayoutEngine(canvasArea);
  editor  = new EditorController(layout);
  exporter = new PdfExporter();

  // ホーム画面を表示
  showHome();

  // キーボードショートカット
  document.addEventListener('keydown', handleKey);

  // Undo/Redo ボタン状態
  window.addEventListener('history:changed', e => {
    document.getElementById('btnUndo').disabled = !e.detail.canUndo;
    document.getElementById('btnRedo').disabled = !e.detail.canRedo;
  });

  // プロパティパネル更新
  window.addEventListener('element:selected', e => updatePropsPanel(e.detail.element));

  // 自動保存（5分ごと）
  setInterval(() => autoSave(), 5 * 60 * 1000);
});

// ── ホーム画面 ──────────────────────────────────────
function showHome() {
  document.getElementById('homeScreen').classList.remove('hidden');
  document.getElementById('editorScreen').classList.add('hidden');
}

function showEditor() {
  document.getElementById('homeScreen').classList.add('hidden');
  document.getElementById('editorScreen').classList.remove('hidden');
  layout.applyScale();
}

// ── テンプレート読み込み ────────────────────────────
window.selectTemplate = async function(type) {
  templateType = type;
  const res = await fetch(`js/templates/${type}.json`);
  const tpl = await res.json();
  docTitle = tpl.name + ' — 新規';
  document.getElementById('docTitle').textContent = docTitle;
  pages = [];
  document.getElementById('canvasArea').innerHTML =
    '<div id="scaleBadge" class="scale-badge"></div>';
  document.getElementById('pageNav').innerHTML =
    '<div class="side-label">ページ</div>';

  for (const tplPage of tpl.pages) {
    addPage(tplPage.elements);
  }
  setCurrentPage(pages[0].id);
  showEditor();
};

// ── ページ追加 ──────────────────────────────────────
function addPage(elements = []) {
  const pid = 'page_' + Date.now();
  const wrapper = document.createElement('div');
  wrapper.className = 'a4-wrapper';
  const pageEl = document.createElement('div');
  pageEl.className = 'a4-page';
  pageEl.id = pid;

  // グリッドガイド
  const grid = document.createElement('div');
  grid.className = 'grid-guide';
  pageEl.appendChild(grid);

  const label = document.createElement('div');
  label.className = 'page-label';
  label.textContent = `p. ${pages.length + 1}`;

  wrapper.appendChild(pageEl);
  wrapper.appendChild(label);
  document.getElementById('canvasArea').insertBefore(
    wrapper, document.getElementById('scaleBadge')
  );

  editor.registerPage(pid, pageEl);
  if (elements.length) editor.loadPage(pid, elements);

  // ページサムネイル
  const thumb = document.createElement('div');
  thumb.className = 'page-thumb';
  thumb.dataset.pid = pid;
  thumb.innerHTML = `
    <div class="page-thumb-inner">
      <div style="height:4px;background:#1a3a5c;border-radius:1px;margin-bottom:3px"></div>
      ${Array(5).fill('<div style="height:2px;background:#dde;border-radius:1px;margin-bottom:2px"></div>').join('')}
    </div>
    <span class="page-thumb-num">${pages.length + 1}</span>`;
  thumb.addEventListener('click', () => {
    setCurrentPage(pid);
    document.getElementById(pid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('pageNav').appendChild(thumb);

  pages.push({ id: pid, el: pageEl });
  return pid;
}

window.addNewPage = () => {
  const pid = addPage();
  setCurrentPage(pid);
  document.getElementById(pid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function setCurrentPage(pid) {
  currentPageId = pid;
  editor.setCurrentPage(pid);
  document.querySelectorAll('.page-thumb').forEach(t =>
    t.classList.toggle('active', t.dataset.pid === pid)
  );
}

// ── ツールバーアクション ────────────────────────────
window.addText = () => {
  editor.addElement('text', {
    x: 20, y: 20, width: 100, height: 20,
    content: 'テキストをダブルクリックで編集',
    fontFamily: 'sans', fontSize: 10, color: '#1e1e1e',
  }, currentPageId);
};

window.addImage = () => {
  editor.addElement('image', { x: 30, y: 50, width: 60, height: 45 }, currentPageId);
};

window.addTable = () => {
  editor.addElement('table', {
    x: 20, y: 60, width: 170, height: 36, rows: 3, cols: 3
  }, currentPageId);
};

window.doUndo = () => editor.undo();
window.doRedo = () => editor.redo();

window.deleteSelected = () => {
  editor.deleteSelected();
  showToast('要素を削除しました');
};

window.toggleGrid = () => {
  document.querySelectorAll('.grid-guide').forEach(g => g.classList.toggle('visible'));
};

// ── PDF出力 ──────────────────────────────────────────
window.exportPdf = async () => {
  showToast('PDF を生成中...');
  try {
    const pagesData = pages.map(p => ({
      id: p.id,
      elements: editor.serializePage(p.id),
    }));
    await exporter.exportToPdf(pagesData, {
      title: docTitle,
      fileName: `${templateType}_${formatDate()}.pdf`,
    });
    showToast('PDF を出力しました');
  } catch (e) {
    console.error(e);
    showToast('PDF 出力に失敗しました: ' + e.message);
  }
};

// ── 保存 ──────────────────────────────────────────────
window.saveDoc = () => {
  const doc = buildDocObj();
  const res = storage.save(doc);
  showToast(res.success ? '保存しました' : (res.warning || '保存に失敗しました'));
};

function autoSave() {
  const doc = buildDocObj();
  storage.saveDraft(doc);
}

function buildDocObj() {
  return {
    id: 'doc_' + Date.now(),
    title: docTitle,
    templateType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pageSize: 'A4',
    pages: pages.map(p => ({
      id: p.id, pageNumber: pages.indexOf(p) + 1,
      elements: editor.serializePage(p.id),
    })),
  };
}

// ── プロパティパネル ──────────────────────────────────
function updatePropsPanel(el) {
  const panel = document.getElementById('propsContent');
  if (!el) {
    panel.innerHTML = '<p class="props-hint">要素を選択すると<br>プロパティを編集できます</p>';
    return;
  }
  const d = el.data;
  panel.innerHTML = `
    <div class="props-field-label">X 座標 (mm)</div>
    <input class="props-input" type="number" value="${d.x.toFixed(1)}" step="1"
      onchange="updateProp('x', +this.value)">
    <div class="props-field-label">Y 座標 (mm)</div>
    <input class="props-input" type="number" value="${d.y.toFixed(1)}" step="1"
      onchange="updateProp('y', +this.value)">
    <div class="props-field-label">幅 (mm)</div>
    <input class="props-input" type="number" value="${d.width.toFixed(1)}" step="1"
      onchange="updateProp('width', +this.value)">
    <div class="props-field-label">高さ (mm)</div>
    <input class="props-input" type="number" value="${d.height.toFixed(1)}" step="1"
      onchange="updateProp('height', +this.value)">
    ${d.type === 'text' ? `
    <div class="props-field-label">フォントサイズ (pt)</div>
    <input class="props-input" type="number" value="${d.fontSize}" step="0.5" min="6" max="72"
      onchange="updateProp('fontSize', +this.value)">
    <div class="props-field-label">フォント</div>
    <select class="props-select" onchange="updateProp('fontFamily', this.value)">
      <option value="sans" ${d.fontFamily==='sans'?'selected':''}>ゴシック体</option>
      <option value="serif" ${d.fontFamily==='serif'?'selected':''}>明朝体</option>
    </select>
    <div class="props-field-label">太字</div>
    <select class="props-select" onchange="updateProp('fontWeight', this.value)">
      <option value="normal" ${d.fontWeight==='normal'?'selected':''}>普通</option>
      <option value="bold" ${d.fontWeight==='bold'?'selected':''}>太字</option>
    </select>
    <div class="props-field-label">テキストカラー</div>
    <div class="color-row">
      ${['#1e1e1e','#1a3a5c','#2e7dcc','#2a7a4b','#c06010','#ffffff'].map(c =>
        `<div class="color-swatch${d.color===c?' active':''}" style="background:${c}"
          onclick="updateProp('color','${c}')"></div>`
      ).join('')}
    </div>` : ''}
    <div style="margin-top:6px">
      <button class="btn btn-danger" style="width:100%;font-size:11px" onclick="deleteSelected()">
        削除
      </button>
    </div>`;
}

window.updateProp = (key, value) => {
  const el = editor._selected;
  if (!el) return;
  if (key === 'x' || key === 'y') {
    el.updatePosition(key === 'x' ? value : el.data.x, key === 'y' ? value : el.data.y);
  } else if (key === 'width' || key === 'height') {
    el.updateSize(key === 'width' ? value : el.data.width, key === 'height' ? value : el.data.height);
  } else if (el.updateData) {
    el.updateData({ [key]: value });
  }
  // カラースウォッチ更新
  updatePropsPanel(el);
};

// ── キーボードショートカット ──────────────────────────
function handleKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); editor.undo(); }
    if (e.key === 'y') { e.preventDefault(); editor.redo(); }
    if (e.key === 's') { e.preventDefault(); saveDoc(); }
    if (e.key === 'p') { e.preventDefault(); exportPdf(); }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (editor._selected) { e.preventDefault(); deleteSelected(); }
  }
  if (e.key === 'Escape') editor.selectElement(null);
}

// ── ユーティリティ ──────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function formatDate() {
  return new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
}
