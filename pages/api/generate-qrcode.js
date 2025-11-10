import PDFDocument from 'pdfkit';
import getStream from 'get-stream';
import QRCode from 'qrcode';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
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
    const pngBuffers = await Promise.all(lines.map(async (txt) => {
      return await QRCode.toBuffer(txt, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 300 });
    }));

    const doc = new PDFDocument({ autoFirstPage: false });
    doc.addPage({ size: 'A4', margin: 20 });

    const pageWidth = 595.28;
    const pageHeight = 841.89;

    const margin = 20;
    const availableWidth = pageWidth - margin * 2;

    const qrSize = 120;
    const gap = 16;
    const cols = Math.floor((availableWidth + gap) / (qrSize + gap));
    const xStart = margin + (availableWidth - (cols * qrSize + (cols - 1) * gap)) / 2;
    let x = xStart;
    let y = margin;
    let col = 0;

    for (let i = 0; i < pngBuffers.length; i++) {
      const buf = pngBuffers[i];

      if (y + qrSize > pageHeight - margin) {
        doc.addPage({ size: 'A4', margin: 20 });
        y = margin;
      }

      doc.image(buf, x, y, { width: qrSize, height: qrSize });
      doc.fontSize(10).text(lines[i], x, y + qrSize + 6, { width: qrSize, align: 'center' });

      col++;
      if (col >= cols) {
        col = 0;
        x = xStart;
        y += qrSize + 28;
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
