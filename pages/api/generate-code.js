import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';

// === Pure grid math helper (no PDFDocument dependency) ===
export function computeGrid() {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const COLS   = 5;
  const ROWS   = 7;
  const CELL_W = PAGE_W / COLS;
  const CELL_H = PAGE_H / ROWS;
  const verticalXs   = [0, 1, 2, 3, 4, 5].map(i => i * CELL_W);
  const horizontalYs = [0, 1, 2, 3, 4, 5, 6, 7].map(j => j * CELL_H);
  return { CELL_W, CELL_H, verticalXs, horizontalYs };
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed');
  }

  const { number_sequence, codeType } = req.body || {};
  if (!number_sequence || typeof number_sequence !== 'string') {
    return res.status(400).send('Missing number_sequence in request body');
  }

  if (!['qrcode', 'barcode', 'smallQrcode'].includes(codeType)) {
    return res.status(400).send('Invalid codeType. Must be "qrcode" or "barcode" or "small Qrcode"');
  }

  const lines = number_sequence
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return res.status(400).send('No numbers provided');
  }

  try {
    const imgBuffers = await Promise.all(
      lines.map(async (txt) => {
        if (codeType === 'qrcode' || codeType === 'smallQrcode') {
          return QRCode.toBuffer(txt, { type: 'png', width: 90, margin: 1 });
        } else {
          return bwipjs.toBuffer({
            bcid: 'code128',
            text: txt,
            scale: 3,
            height: 14,
            includetext: false,
            backgroundcolor: 'FFFFFF',
          });
        }
      })
    );

    // Tell browser this is a PDF file to download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${codeType}_codes.pdf"`);

    const doc = new PDFDocument({ autoFirstPage: false });
    doc.pipe(res); // <— Stream directly to response (no 4 MB buffer limit)

    doc.addPage({ size: 'A4', margin: 0 });
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 10;

    if (codeType === 'qrcode') {
      // === Grid constants (via pure helper)
      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const COLS   = 5;
      const ROWS   = 7;
      const { CELL_W, CELL_H, verticalXs, horizontalYs } = computeGrid();
      // PAGE_W, PAGE_H, COLS, ROWS kept for drawCutLines/drawCell closures

      // === Helper: draw cut lines on the current page
      function drawCutLines(doc) {
        doc.strokeColor('#000000').lineWidth(0.5);
        for (const x of verticalXs) {
          doc.moveTo(x, 0).lineTo(x, PAGE_H).stroke();
        }
        for (const y of horizontalYs) {
          doc.moveTo(0, y).lineTo(PAGE_W, y).stroke();
        }
      }

      // === Helper: draw a single QR cell at grid position (col, row)
      function drawCell(doc, buf, label, col, row) {
        const x0 = col * CELL_W;
        const y0 = row * CELL_H;
        const cellPadding = 6;   // gap between cut line and cell border
        const innerPadding = 6;  // gap between cell border and QR image
        const labelHeight = 12;
        const labelGap = 3;

        // Cell border sits inside the cut lines with cellPadding on each side
        const borderX = x0 + cellPadding;
        const borderY = y0 + cellPadding;
        const borderW = CELL_W - 2 * cellPadding;
        const borderH = CELL_H - 2 * cellPadding;

        // Draw cell border
        doc.save()
           .strokeColor('#9f9f9f').lineWidth(0.5)
           .rect(borderX, borderY, borderW, borderH)
           .stroke()
           .restore();

        // QR fits within the border with innerPadding on each side
        const maxQrW = borderW - 2 * innerPadding;
        const maxQrH = borderH - 2 * innerPadding - labelGap - labelHeight;
        const qrSize = Math.min(maxQrW, maxQrH);
        const qrX = borderX + (borderW - qrSize) / 2;
        const qrY = borderY + innerPadding;
        const labelY = qrY + qrSize + labelGap;

        doc.image(buf, qrX, qrY, { width: qrSize, height: qrSize });
        doc.fontSize(8).text(label, borderX + innerPadding, labelY, { width: maxQrW, align: 'center' });
      }

      // === QR layout: 5×7 grid with cut lines
      let col = 0;
      let row = 0;

      // Draw cut lines on the first page (already added above)
      drawCutLines(doc);

      for (let i = 0; i < imgBuffers.length; i++) {
        const buf = imgBuffers[i];

        // When a full page is filled, add a new page and draw cut lines
        if (col === 0 && row === 0 && i > 0) {
          doc.addPage({ size: 'A4', margin: 0 });
          drawCutLines(doc);
        }

        drawCell(doc, buf, lines[i], col, row);

        col++;
        if (col >= COLS) {
          col = 0;
          row++;
          if (row >= ROWS) {
            row = 0;
          }
        }
      }
    } else if(codeType === 'smallQrcode') {
      // === Small QR grid: 6 cols × 13 rows = 78 cells per page
      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const COLS   = 6;
      const ROWS   = 13;
      const CELL_W = PAGE_W / COLS;
      const CELL_H = PAGE_H / ROWS;

      const verticalXs   = Array.from({ length: COLS + 1 }, (_, i) => i * CELL_W);
      const horizontalYs = Array.from({ length: ROWS + 1 }, (_, j) => j * CELL_H);

      function drawCutLines(doc) {
        doc.strokeColor('#000000').lineWidth(0.5);
        for (const x of verticalXs) {
          doc.moveTo(x, 0).lineTo(x, PAGE_H).stroke();
        }
        for (const y of horizontalYs) {
          doc.moveTo(0, y).lineTo(PAGE_W, y).stroke();
        }
      }

      function drawCell(doc, buf, label, col, row) {
        const x0 = col * CELL_W;
        const y0 = row * CELL_H;
        const cellPadding = 2;   // gap between cut line and cell border
        const innerPadding = 2;  // gap between cell border and QR image
        const labelHeight = 8;
        const labelGap = 1;

        const borderX = x0 + cellPadding;
        const borderY = y0 + cellPadding;
        const borderW = CELL_W - 2 * cellPadding;
        const borderH = CELL_H - 2 * cellPadding;

        doc.save()
           .strokeColor('#9f9f9f').lineWidth(0.5)
           .rect(borderX, borderY, borderW, borderH)
           .stroke()
           .restore();

        const maxQrW = borderW - 2 * innerPadding;
        const maxQrH = borderH - 2 * innerPadding - labelGap - labelHeight;
        const qrSize = Math.min(maxQrW, maxQrH);
        const qrX = borderX + (borderW - qrSize) / 2;
        const qrY = borderY + innerPadding + (maxQrH - qrSize) / 2;
        const labelY = borderY + borderH - innerPadding - labelHeight;

        doc.image(buf, qrX, qrY, { width: qrSize, height: qrSize });
        doc.fontSize(8).text(label, borderX + innerPadding, labelY, { width: maxQrW, align: 'center' });
      }

      
      let col = 0;
      let row = 0;

      drawCutLines(doc);

      for (let i = 0; i < imgBuffers.length; i++) {
        if (col === 0 && row === 0 && i > 0) {
          doc.addPage({ size: 'A4', margin: 0 });
          drawCutLines(doc);
        }

        drawCell(doc, imgBuffers[i], lines[i], col, row);

        col++;
        if (col >= COLS) {
          col = 0;
          row++;
          if (row >= ROWS) {
            row = 0;
          }
        }
      }
    }  else {
      // === Barcode layout: 4 columns (30% 20% 30% 20%)
      const usableWidth = pageWidth - margin * 2;
      const colWidths = {
        barcode1: usableWidth * 0.2,
        number1: usableWidth * 0.3,
        barcode2: usableWidth * 0.2,
        number2: usableWidth * 0.3,
      };

      const barcodeHeight = 40;
      const gapY = 20;
      const maxRows = 13;
      let y = 20;
      let currentRow = 1;

      for (let i = 0; i < lines.length; i += 2) {
        if (currentRow > maxRows) {
          doc.addPage({ size: 'A4', margin: 20 });
          y = 20;
          currentRow = 1;
        }

        const buf1 = imgBuffers[i];
        doc.rect(margin - 2, y - 2, colWidths.barcode1 + 4, barcodeHeight + 4).stroke();
        doc.image(buf1, margin, y, { width: colWidths.barcode1, height: barcodeHeight });
        doc.fontSize(26).text(lines[i], margin + colWidths.barcode1, y + 12, {
          width: colWidths.number1,
          align: 'center',
        });

        if (i + 1 < lines.length) {
          const buf2 = imgBuffers[i + 1];
          const x2 = margin + colWidths.barcode1 + colWidths.number1;
          doc.rect(x2 - 2, y - 2, colWidths.barcode2 + 4, barcodeHeight + 4).stroke();
          doc.image(buf2, x2, y, { width: colWidths.barcode2, height: barcodeHeight });
          doc.fontSize(26).text(lines[i + 1], x2 + colWidths.barcode2, y + 12, {
            width: colWidths.number2,
            align: 'center',
          });
        }

        y += barcodeHeight + gapY;
        currentRow++;
      }
    }

    doc.end(); // Finish PDF stream
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).send('Failed to generate PDF');
  }
}
