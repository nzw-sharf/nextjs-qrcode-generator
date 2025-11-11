import PDFDocument from 'pdfkit';
import getStream from 'get-stream';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';

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

  if (!['qrcode', 'barcode'].includes(codeType)) {
    return res.status(400).send('Invalid codeType. Must be "qrcode" or "barcode"');
  }

  const lines = number_sequence
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return res.status(400).send('No numbers provided');
  }
  // Optional: for barcode, ensure digits only
  // if (codeType === 'qrcode') {
  //   for (const line of lines) {
  //     if (!/^\d+$/.test(line)) {
  //       res.status(400).send('All lines must contain only digits for QR Code');
  //       return;
  //     }
  //   }
  // }
  try {
    const imgBuffers = await Promise.all(
      lines.map(async (txt) => {
        if (codeType === 'qrcode') {
          return QRCode.toBuffer(txt, { type: 'png', width: 120, margin: 1 });
        } else {
          // Barcode buffer
          return bwipjs.toBuffer({
            bcid: 'code128',
            text: txt,
            scale: 3,
            height: 14,
            includetext: false, // text will be drawn next to barcode
            backgroundcolor: 'FFFFFF',
          });
        }
      })
    );

    // PDF setup
    const doc = new PDFDocument({ autoFirstPage: false });
    doc.addPage({ size: 'A4', margin: 20 });

    const pageWidth = 595.28; // A4 width
    const pageHeight = 841.89; // A4 height
    const margin = 20;

    if (codeType === 'qrcode') {
      // QR code layout (keep as before)
      const qrSize = 70;
      const gap = 20;
      const cols = 6;
      const xStart = margin + (pageWidth - margin * 2 - (cols * qrSize + (cols - 1) * gap)) / 2;

      let x = xStart;
      let y = margin;
      let col = 0;

      for (let i = 0; i < imgBuffers.length; i++) {
        const buf = imgBuffers[i];

        if (y + qrSize + 30 > pageHeight - margin) {
          doc.addPage({ size: 'A4', margin: 20 });
          y = margin;
        }

        doc.rect(x - 2, y - 2, qrSize + 4, qrSize + 4).stroke();
        doc.image(buf, x, y, { width: qrSize, height: qrSize });
        doc.fontSize(8).text(lines[i], x, y + qrSize + 5, { width: qrSize, align: 'center' });

        col++;
        if (col >= cols) {
          col = 0;
          x = xStart;
          y += qrSize + 30;
        } else {
          x += qrSize + gap;
        }
      }
    } else {
      // Barcode layout: 4 columns per row (30%-20%-30%-20%)
      const pageWidth = 595.28; // A4 width
      const margin = 20;
      const usableWidth = pageWidth - margin * 2;

      const colWidths = {
        barcode1: usableWidth * 0.3,
        number1: usableWidth * 0.2,
        barcode2: usableWidth * 0.3,
        number2: usableWidth * 0.2,
      };

      const barcodeHeight = 40;
      const gapY = 20; // space between rows
      const maxRows = 13;

      let y = 20;
      let currentRow = 1;

      for (let i = 0; i < lines.length; i += 2) {
        if (currentRow > maxRows) {
          doc.addPage({ size: 'A4', margin: 20 });
          y = 20;
          currentRow = 1;
        }

        // First barcode
        const buf1 = imgBuffers[i];
        doc.rect(margin - 2, y - 2, colWidths.barcode1 + 4, barcodeHeight + 4).stroke();
        doc.image(buf1, margin, y, { width: colWidths.barcode1, height: barcodeHeight });
        doc.fontSize(10).text(lines[i], margin + colWidths.barcode1, y + 12, { width: colWidths.number1, align: 'center' });

        // Second barcode if exists
        if (i + 1 < lines.length) {
          const buf2 = imgBuffers[i + 1];
          const x2 = margin + colWidths.barcode1 + colWidths.number1;
          doc.rect(x2 - 2, y - 2, colWidths.barcode2 + 4, barcodeHeight + 4).stroke();
          doc.image(buf2, x2, y, { width: colWidths.barcode2, height: barcodeHeight });
          doc.fontSize(10).text(lines[i + 1], x2 + colWidths.barcode2, y + 12, { width: colWidths.number2, align: 'center' });
        }

        y += barcodeHeight + gapY;
        currentRow++;
      }
    }


    doc.end();
    const pdfBuffer = await getStream.buffer(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${codeType}_codes.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate PDF');
  }
}
