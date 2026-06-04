/** pdfExport.js — jsPDF を使った PDF 出力 */
// jsPDF は index.html で CDN から読み込み済みの想定 (window.jspdf)

import { mmToPx, ptToPx, A4_W_MM, A4_H_MM } from './utils/coords.js';

export class PdfExporter {
  constructor() {
    this._fontLoaded = false;
  }

  /**
   * ページデータ配列を受け取り PDF を生成・ダウンロードする
   * @param {Array} pagesData - [{ id, elements: ElementData[] }]
   * @param {Object} options
   */
  async exportToPdf(pagesData, options = {}) {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) throw new Error('jsPDF が読み込まれていません');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // メタデータ
    doc.setProperties({
      title:   options.title   || 'ドキュメント',
      author:  options.author  || '',
      subject: options.subject || '',
      creator: 'DocEditor',
    });

    pagesData.forEach((page, pageIdx) => {
      if (pageIdx > 0) doc.addPage('a4', 'portrait');
      page.elements
        .slice()
        .sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1))
        .forEach(el => this._renderElement(doc, el));
    });

    const fileName = options.fileName ||
      `document_${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}.pdf`;

    if (options.openPreview !== false) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
    doc.save(fileName);
  }

  _renderElement(doc, el) {
    switch (el.type) {
      case 'text':  return this._renderText(doc, el);
      case 'image': return this._renderImage(doc, el);
      case 'table': return this._renderTable(doc, el);
    }
  }

  _renderText(doc, el) {
    const fontStyle = el.fontWeight === 'bold' ? 'bold' : 'normal';
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(el.fontSize || 10);
    // 色
    const c = this._hexToRgb(el.color || '#1e1e1e');
    doc.setTextColor(c.r, c.g, c.b);
    // 背景
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      const bg = this._hexToRgb(el.backgroundColor);
      doc.setFillColor(bg.r, bg.g, bg.b);
      doc.rect(el.x, el.y, el.width, el.height, 'F');
    }
    // テキスト描画（折り返し）
    const lines = doc.splitTextToSize(el.content || '', el.width);
    const lineH = (el.fontSize || 10) * (el.lineHeight || 1.6) * 0.352778; // pt→mm
    const align = el.textAlign === 'center' ? 'center' :
                  el.textAlign === 'right'  ? 'right'  : 'left';
    const offsetX = align === 'center' ? el.x + el.width / 2 :
                    align === 'right'  ? el.x + el.width : el.x;
    lines.forEach((line, i) => {
      doc.text(line, offsetX, el.y + (el.fontSize || 10) * 0.352778 + i * lineH, { align });
    });
  }

  _renderImage(doc, el) {
    if (!el.src || !el.src.startsWith('data:')) return;
    try {
      const fmt = el.src.includes('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(el.src, fmt, el.x, el.y, el.width, el.height);
    } catch (e) {
      console.warn('画像の埋め込みに失敗しました:', e);
    }
  }

  _renderTable(doc, el) {
    if (!el.cells || !el.cells.length) return;
    const colW = el.width / el.cols;
    const rowH = el.height / el.rows;
    el.cells.forEach((row, r) => {
      row.forEach((cell, c) => {
        const cx = el.x + c * colW;
        const cy = el.y + r * rowH;
        // 背景
        const isHeader = r === 0 && el.headerRow;
        if (isHeader) {
          const hc = this._hexToRgb(el.headerBg || '#1a3a5c');
          doc.setFillColor(hc.r, hc.g, hc.b);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.rect(cx, cy, colW, rowH, 'FD');
        // テキスト
        doc.setFontSize(cell.fontSize || 9);
        const tc = isHeader ? { r:255, g:255, b:255 } : this._hexToRgb(cell.color || '#1e1e1e');
        doc.setTextColor(tc.r, tc.g, tc.b);
        doc.setFont('helvetica', cell.fontWeight === 'bold' ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(cell.content || '', colW - 2);
        doc.text(lines, cx + 1.5, cy + (cell.fontSize || 9) * 0.352778 + 1);
      });
    });
  }

  _hexToRgb(hex) {
    const h = hex.replace('#', '');
    if (h.length === 3) {
      return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
    }
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  }
}
