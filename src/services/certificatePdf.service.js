const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const AppError = require('../utils/AppError');

// DejaVu has wide Unicode coverage (Latin incl. Yoruba and Vietnamese letters, Greek, Cyrillic...).
// PDF's built-in fonts cannot draw letters like the dotted o in "Ọlá".
const fontDir = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT = {
  sans: path.join(fontDir, 'DejaVuSans.ttf'),
  sansBold: path.join(fontDir, 'DejaVuSans-Bold.ttf'),
  serifBold: path.join(fontDir, 'DejaVuSerif-Bold.ttf'),
};

const BRAND = '#4f46e5';
const DARK = '#111827';
const MUTED = '#6b7280';
const W = 841.89; // A4 landscape, in points
const H = 595.28;

function formatDate(date, timeZone) {
  const format = (tz) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: tz }).format(new Date(date));
  try {
    return format(timeZone);
  } catch {
    return format('UTC'); // unknown time zone name
  }
}

// "10 November 2026", or "10 November 2026 to 12 November 2026" for multi-day events
function formatDateRange(start, end, timeZone) {
  const a = formatDate(start, timeZone);
  const b = formatDate(end, timeZone);
  return a === b ? a : `${a} to ${b}`;
}

// Can this font draw every character? (Uses the fontkit font behind PDFKit; if that is not
// reachable the check is skipped rather than blocking certificates.)
function canDraw(doc, fontPath, text) {
  doc.font(fontPath);
  const fontkitFont = doc._font && doc._font.font;
  if (!fontkitFont || typeof fontkitFont.hasGlyphForCodePoint !== 'function') return true;
  return [...text].every((ch) => /\s/.test(ch) || fontkitFont.hasGlyphForCodePoint(ch.codePointAt(0)));
}

// Draws centered text starting at y and returns the y just below it.
function centered(doc, text, y, { font, size, color, maxWidth = W - 200, maxLines }) {
  doc.font(font).fontSize(size).fillColor(color);
  const options = { width: maxWidth, align: 'center' };
  const lineHeight = doc.currentLineHeight();
  const height = Math.min(doc.heightOfString(text, options), maxLines ? lineHeight * maxLines : Infinity);
  doc.text(text, (W - maxWidth) / 2, y, {
    ...options,
    ...(maxLines ? { height: lineHeight * maxLines, ellipsis: true } : {}),
  });
  return y + height;
}

// Picks a font size so text is never cut off. Each stage is tried in order, from its largest
// size down to its smallest, accepting the first size at which the text needs no more than
// `lines` lines. If nothing fits, the fallback is used (smallest size, more lines).
function fitFont(doc, text, font, width, stages, fallback) {
  for (const { maxSize, minSize, lines } of stages) {
    for (let size = maxSize; size >= minSize; size -= 2) {
      doc.font(font).fontSize(size);
      const needed = Math.round(doc.heightOfString(text, { width }) / doc.currentLineHeight());
      if (needed <= lines) return { size, maxLines: lines };
    }
  }
  return { size: fallback.size, maxLines: fallback.lines };
}

/**
 * Renders a certificate to a PDF Buffer, entirely from the stored certificate record
 * (so it can be regenerated at any time and never goes stale).
 */
async function renderCertificatePdf({ certificateId, recipientName, eventName, organizationName, eventStartDate, eventEndDate, timezone, issuedAt, verifyUrl }) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: { Title: 'Certificate of Attendance', Author: 'EventNest', Subject: eventName },
  });

  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // text typed by users must be drawable, or the PDF would show empty boxes instead of letters
  const organizationHeader = organizationName.toUpperCase();
  const userTexts = [recipientName, eventName, organizationName, organizationHeader];
  const drawable = [FONT.sansBold, FONT.serifBold].every((font) => userTexts.every((t) => canDraw(doc, font, t)));
  if (!drawable) {
    throw new AppError(
      'This certificate contains characters the PDF font cannot display yet (supported: Latin, Greek and Cyrillic scripts). It is still valid and can be verified online.',
      422
    );
  }

  // ---- frame ----
  doc.rect(24, 24, W - 48, H - 48).lineWidth(3).strokeColor(BRAND).stroke();
  doc.rect(34, 34, W - 68, H - 68).lineWidth(0.75).strokeColor('#c7d2fe').stroke();

  // ---- heading ----
  const headerWidth = W - 240;
  const header = fitFont(doc, organizationHeader, FONT.sansBold, headerWidth, [{ maxSize: 11, minSize: 7, lines: 1 }], { size: 7, lines: 1 });
  centered(doc, organizationHeader, 66, { font: FONT.sansBold, size: header.size, color: MUTED, maxWidth: headerWidth, maxLines: header.maxLines });
  centered(doc, 'CERTIFICATE OF ATTENDANCE', 98, { font: FONT.serifBold, size: 32, color: BRAND, maxWidth: W - 160, maxLines: 1 });
  centered(doc, 'This is to certify that', 158, { font: FONT.sans, size: 14, color: MUTED });

  // ---- recipient: one big line if possible, else smaller on two lines, else up to four ----
  const nameWidth = W - 200;
  const nameFit = fitFont(
    doc, recipientName, FONT.serifBold, nameWidth,
    [{ maxSize: 44, minSize: 30, lines: 1 }, { maxSize: 28, minSize: 18, lines: 2 }],
    { size: 18, lines: 4 }
  );
  const nameBottom = centered(doc, recipientName, 186, { font: FONT.serifBold, size: nameFit.size, color: DARK, maxWidth: nameWidth, maxLines: nameFit.maxLines });
  doc.moveTo(W / 2 - 170, nameBottom + 8).lineTo(W / 2 + 170, nameBottom + 8).lineWidth(1).strokeColor(BRAND).stroke();

  // ---- event ----
  const attendedBottom = centered(doc, 'has successfully attended', nameBottom + 24, { font: FONT.sans, size: 14, color: MUTED });
  const eventFit = fitFont(
    doc, eventName, FONT.sansBold, W - 200,
    [{ maxSize: 24, minSize: 20, lines: 2 }, { maxSize: 18, minSize: 16, lines: 3 }],
    { size: 16, lines: 4 }
  );
  const eventBottom = centered(doc, eventName, attendedBottom + 12, { font: FONT.sansBold, size: eventFit.size, color: DARK, maxLines: eventFit.maxLines });
  centered(doc, formatDateRange(eventStartDate, eventEndDate, timezone), eventBottom + 12, { font: FONT.sans, size: 14, color: MUTED });

  // ---- footer: ID + issue date on the left, QR code on the right ----
  const footerY = H - 138;
  doc.font(FONT.sans).fontSize(9).fillColor(MUTED).text('CERTIFICATE ID', 70, footerY, { characterSpacing: 1 });
  doc.font(FONT.sansBold).fontSize(15).fillColor(DARK).text(certificateId, 70, footerY + 14);
  doc.font(FONT.sans).fontSize(10).fillColor(MUTED).text(`Issued on ${formatDate(issuedAt, 'UTC')}`, 70, footerY + 40);
  doc.fontSize(9).text(`Verify this certificate at ${verifyUrl}`, 70, footerY + 58, { width: W - 270 });

  const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
  doc.image(qr, W - 70 - 84, footerY - 4, { width: 84 });
  doc.font(FONT.sans).fontSize(7).fillColor(MUTED).text('Scan to verify', W - 70 - 84, footerY + 82, { width: 84, align: 'center' });

  doc.end();
  return finished;
}

module.exports = { renderCertificatePdf, formatDateRange };