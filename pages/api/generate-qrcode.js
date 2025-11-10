import PDFDocument from 'pdfkit';
import getStream from 'get-stream';
import QRCode from 'qrcode';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Only POST allowed');
    return;
  }

  const { number_sequence } = req.body || {};
  if (!number_sequence || typeof number_sequence !== 'string') {
    res.status(400).send('Missing number_sequence in request body');
    return;
  }

  const lines = number_sequence.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    res.status(400).send('No numbers provided');
    return;
  }

  for (const line of lines) {
    if (!/^\d+$/.test(line)) {
      res.status(400).send('All lines must contain only digits');
      return;
    }
  }

  try {
    const pngBuffers = await Promise.all(
      lines.map(async (txt) =>
        QRCode.toBuffer(txt, {
          type: 'png',
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 120,
        })
      )
    );

    const doc = new PDFDocument({ autoFirstPage: false });
    doc.addPage({ size: 'A4', margin: 20 });

    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 20;
    const qrSize = 70; // each QR code size
    const gap = 20;
    const cols = 6; // exactly 6 in a row
    const xStart = margin + (pageWidth - margin * 2 - (cols * qrSize + (cols - 1) * gap)) / 2;
    let x = xStart;
    let y = margin;
    let col = 0;

    for (let i = 0; i < pngBuffers.length; i++) {
      const buf = pngBuffers[i];

      // Add new page if needed
      if (y + qrSize + 30 > pageHeight - margin) {
        doc.addPage({ size: 'A4', margin: 20 });
        y = margin;
      }

      // Border
      doc.rect(x - 2, y - 2, qrSize + 4, qrSize + 4).stroke();

      // QR Image
      doc.image(buf, x, y, { width: qrSize, height: qrSize });

      // Label
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

    doc.end();
    const pdfBuffer = await getStream.buffer(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=qr_codes.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate PDF');
  }
}
