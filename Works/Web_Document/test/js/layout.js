/** layout.js — LayoutEngine: 絶対座標管理・スケール・スナップ */
import { mmToPx, pxToMm, A4_W_PX, A4_H_PX, A4_W_MM, A4_H_MM } from './utils/coords.js';

export class LayoutEngine {
  constructor(canvasArea) {
    this._area = canvasArea;
    this.snapEnabled = true;
    this.snapGridMm = 5;
    this._scale = 1;
    window.addEventListener('resize', () => this.applyScale());
  }

  /** スナップのON/OFF切り替え */
  setSnap(enabled, gridMm = 5) {
    this.snapEnabled = enabled;
    this.snapGridMm = gridMm;
  }

  /** mm 座標をスナップグリッドに吸着 */
  snapToGrid(mm) {
    if (!this.snapEnabled) return mm;
    return Math.round(mm / this.snapGridMm) * this.snapGridMm;
  }

  /** ビューポートに応じたスケールを計算して全A4ページに適用 */
  applyScale() {
    const areaW = this._area.clientWidth - 40;
    const scale = Math.min(1, areaW / A4_W_PX);
    this._scale = Math.max(0.3, scale);
    document.querySelectorAll('.a4-wrapper').forEach(w => {
      w.style.transform = `scale(${this._scale})`;
    });
    document.getElementById('scaleBadge').textContent =
      `A4: ${A4_W_PX}×${A4_H_PX}px  |  表示倍率: ${Math.round(this._scale * 100)}%`;
  }

  getCanvasScale() { return this._scale; }

  /** DOM 要素の style を mm データから設定する */
  applyPosition(domEl, data) {
    domEl.style.left   = mmToPx(data.x) + 'px';
    domEl.style.top    = mmToPx(data.y) + 'px';
    domEl.style.width  = mmToPx(data.width) + 'px';
    domEl.style.height = mmToPx(data.height) + 'px';
  }

  /** ポインターイベントのクライアント座標 → A4ページ内mm座標 */
  clientToMm(clientX, clientY, pageEl) {
    const rect = pageEl.getBoundingClientRect();
    const px = (clientX - rect.left) / this._scale;
    const py = (clientY - rect.top)  / this._scale;
    return { x: pxToMm(px), y: pxToMm(py) };
  }

  /** 要素がページ内に収まるようにクランプ */
  clamp(x, y, w, h) {
    return {
      x: Math.max(0, Math.min(x, A4_W_MM - w)),
      y: Math.max(0, Math.min(y, A4_H_MM - h)),
      w: Math.min(w, A4_W_MM),
      h: Math.min(h, A4_H_MM),
    };
  }
}
