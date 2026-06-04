/** coords.js — mm / px / pt 変換ユーティリティ (副作用なし・純粋関数) */

export const DPI = 96;
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

export const A4_W_MM = 210;
export const A4_H_MM = 297;
export const A4_W_PX = mmToPx(A4_W_MM); // ≈ 794
export const A4_H_PX = mmToPx(A4_H_MM); // ≈ 1123

/** mm → px */
export function mmToPx(mm) {
  return (mm / MM_PER_INCH) * DPI;
}

/** px → mm */
export function pxToMm(px) {
  return (px / DPI) * MM_PER_INCH;
}

/** pt → px */
export function ptToPx(pt) {
  return (pt / PT_PER_INCH) * DPI;
}

/** px → pt */
export function pxToPt(px) {
  return (px / DPI) * PT_PER_INCH;
}

/**
 * 座標をA4用紙内にクランプする
 * @param {number} x - mm
 * @param {number} y - mm
 * @param {number} w - mm
 * @param {number} h - mm
 * @param {number} [margin=0] - mm
 */
export function clampToPage(x, y, w, h, margin = 0) {
  const maxX = A4_W_MM - margin;
  const maxY = A4_H_MM - margin;
  const cx = Math.max(margin, Math.min(x, maxX - w));
  const cy = Math.max(margin, Math.min(y, maxY - h));
  const cw = Math.min(w, A4_W_MM - margin * 2);
  const ch = Math.min(h, A4_H_MM - margin * 2);
  return { x: cx, y: cy, w: cw, h: ch };
}
