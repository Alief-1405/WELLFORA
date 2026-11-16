import PDFDocument from "pdfkit";

export type PdfField = {
  label: string;
  value: string;
};

export type PdfCallout = {
  title: string;
  value: string;
};

export type OfficialPdfOptions = {
  title: string;
  reference: string;
  division: string;
  status: string;
  confidential?: boolean;
  fields: PdfField[];
  callouts?: PdfCallout[];
  signerName: string;
  signerTitle: string;
};

const pageMargin = 48;
const bodyColor = "#26352D";
const brandColor = "#1B382B";

function toPdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function availableWidth(document: PDFKit.PDFDocument) {
  return document.page.width - document.page.margins.left - document.page.margins.right;
}

function addFooter(document: PDFKit.PDFDocument, printedAt: string) {
  const currentY = document.y;
  const footerY = document.page.height - 60;
  document.save();
  document
    .moveTo(pageMargin, footerY - 5)
    .lineTo(document.page.width - pageMargin, footerY - 5)
    .lineWidth(0.5)
    .strokeColor("#C8D1CB")
    .stroke();
  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#66776D")
    .text(`Dicetak otomatis oleh sistem Wellfora pada ${printedAt} WIB`, pageMargin, footerY, {
      width: availableWidth(document),
      align: "center",
      lineBreak: false
    });
  document.restore();
  document.y = currentY;
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  const contentBottom = document.page.height - document.page.margins.bottom - 8;
  if (document.y + height > contentBottom) document.addPage();
}

function drawHeader(document: PDFKit.PDFDocument, options: OfficialPdfOptions) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const top = document.y;

  document.font("Helvetica-Bold").fontSize(20).fillColor(brandColor)
    .text("WELLFORA", left, top, { lineBreak: false });
  document.font("Helvetica-Bold").fontSize(8).fillColor("#54685B")
    .text(toPdfText(options.division).toUpperCase(), left, top + 25, { lineBreak: false });
  if (options.confidential) {
    document.font("Helvetica-Bold").fontSize(8).fillColor("#8B3E3E")
      .text("CONFIDENTIAL", left, top + 10, {
        width: availableWidth(document),
        align: "right",
        lineBreak: false
      });
  }

  document.moveTo(left, top + 43).lineTo(right, top + 43)
    .lineWidth(2).strokeColor(brandColor).stroke();
  document.moveTo(left, top + 47).lineTo(right, top + 47)
    .lineWidth(0.7).strokeColor("#8A9B90").stroke();
  document.y = top + 62;
}

function drawStatusBadge(document: PDFKit.PDFDocument, status: string) {
  const text = toPdfText(status).toUpperCase();
  document.font("Helvetica-Bold").fontSize(9);
  const badgeWidth = Math.max(88, document.widthOfString(text) + 24);
  const x = (document.page.width - badgeWidth) / 2;
  const y = document.y;

  document.roundedRect(x, y, badgeWidth, 22, 5)
    .fillAndStroke("#E8F0E9", "#C9D9CC");
  document.fillColor(brandColor).text(text, x, y + 6, {
    width: badgeWidth,
    align: "center",
    lineBreak: false
  });
  document.y = y + 34;
}

function drawFields(document: PDFKit.PDFDocument, fields: PdfField[]) {
  const x = document.page.margins.left;
  const width = availableWidth(document);
  const labelWidth = 142;
  const separatorWidth = 14;
  const valueX = x + labelWidth + separatorWidth;
  const valueWidth = width - labelWidth - separatorWidth;
  let rowIndex = 0;

  document.font("Helvetica-Bold").fontSize(9).fillColor(brandColor)
    .text("RINGKASAN DATA", x, document.y, { lineBreak: false });
  document.y += 18;

  for (const field of fields) {
    const label = toPdfText(field.label);
    const value = toPdfText(field.value || "-");
    document.font("Helvetica-Bold").fontSize(9);
    const labelHeight = document.heightOfString(label, { width: labelWidth - 16 });
    document.font("Helvetica").fontSize(9.5);
    const valueHeight = document.heightOfString(value, { width: valueWidth - 16, lineGap: 2 });
    const rowHeight = Math.max(24, Math.max(labelHeight, valueHeight) + 12);
    ensureSpace(document, rowHeight);
    const y = document.y;

    if (rowIndex % 2 === 0) {
      document.rect(x, y, width, rowHeight).fill("#F7F8F6");
    }
    document.font("Helvetica-Bold").fontSize(9).fillColor("#45594C")
      .text(label, x + 8, y + 6, { width: labelWidth - 16 });
    document.font("Helvetica-Bold").fontSize(9).fillColor("#748379")
      .text(":", x + labelWidth, y + 6, { width: separatorWidth, lineBreak: false });
    document.font("Helvetica").fontSize(9.5).fillColor(bodyColor)
      .text(value, valueX + 8, y + 6, { width: valueWidth - 16, lineGap: 2 });
    document.moveTo(x, y + rowHeight).lineTo(x + width, y + rowHeight)
      .lineWidth(0.4).strokeColor("#DDE3DE").stroke();
    document.y = y + rowHeight;
    rowIndex++;
  }

  document.y += 14;
}

function drawCallout(document: PDFKit.PDFDocument, callout: PdfCallout) {
  const x = document.page.margins.left;
  const width = availableWidth(document);
  const padding = 12;
  const innerWidth = width - padding * 2;
  const title = toPdfText(callout.title);
  const value = toPdfText(callout.value || "-");

  document.font("Helvetica-Bold").fontSize(9);
  const titleHeight = document.heightOfString(title, { width: innerWidth });
  document.font("Helvetica").fontSize(9.5);
  const valueHeight = document.heightOfString(value, { width: innerWidth, lineGap: 3 });
  const boxHeight = padding * 2 + titleHeight + 5 + valueHeight;
  ensureSpace(document, boxHeight + 10);
  const y = document.y;

  document.roundedRect(x, y, width, boxHeight, 5)
    .fillAndStroke("#F7F6F2", "#D9DED9");
  document.font("Helvetica-Bold").fontSize(9).fillColor(brandColor)
    .text(title, x + padding, y + padding, { width: innerWidth });
  document.font("Helvetica").fontSize(9.5).fillColor(bodyColor)
    .text(value, x + padding, y + padding + titleHeight + 5, {
      width: innerWidth,
      lineGap: 3
    });
  document.y = y + boxHeight + 10;
}

function drawSignature(document: PDFKit.PDFDocument, options: OfficialPdfOptions) {
  const signatureHeight = 88;
  const contentBottom = document.page.height - document.page.margins.bottom - 12;
  if (document.y + 12 > contentBottom - signatureHeight) document.addPage();

  const width = 225;
  const x = document.page.width - document.page.margins.right - width;
  const y = Math.max(document.y + 12, contentBottom - signatureHeight);
  document.font("Helvetica-Bold").fontSize(8).fillColor("#54685B")
    .text("PENGESAHAN ELEKTRONIK", x, y, { width, align: "left", lineBreak: false });
  document.font("Helvetica").fontSize(8).fillColor("#66776D")
    .text("Diterbitkan melalui sistem Wellfora", x, y + 14, { width, lineBreak: false });
  document.moveTo(x, y + 49).lineTo(x + width, y + 49)
    .lineWidth(0.6).strokeColor("#9AA99F").stroke();
  document.font("Helvetica-Bold").fontSize(10).fillColor(brandColor)
    .text(toPdfText(options.signerName || "-"), x, y + 54, { width, lineBreak: false });
  document.font("Helvetica").fontSize(8.5).fillColor("#526358")
    .text(toPdfText(options.signerTitle), x, y + 69, { width, lineBreak: false });
  document.y = y + signatureHeight;
}

export function createPdf(options: OfficialPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: pageMargin });
    const chunks: Buffer[] = [];
    const printedAt = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta"
    }).format(new Date());

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.on("pageAdded", () => addFooter(document, printedAt));
    addFooter(document, printedAt);

    drawHeader(document, options);
    document.font("Helvetica-Bold").fontSize(15).fillColor(brandColor)
      .text(toPdfText(options.title).toUpperCase(), {
        align: "center",
        width: availableWidth(document)
      });
    document.moveDown(0.35);
    document.font("Helvetica").fontSize(9).fillColor("#5D7369")
      .text(`Nomor: ${toPdfText(options.reference)}`, {
        align: "center",
        width: availableWidth(document)
      });
    document.moveDown(0.8);
    drawStatusBadge(document, options.status);
    drawFields(document, options.fields);

    for (const callout of options.callouts || []) {
      drawCallout(document, callout);
    }

    drawSignature(document, options);
    document.end();
  });
}

export function sendPdf(res: import("express").Response, filename: string, content: Buffer) {
  const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(content);
}

export function formatPdfDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta"
  }).format(value);
}

export function formatPdfDateTime(value: Date) {
  return `${formatPdfDate(value)}, ${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta"
  }).format(value)} WIB`;
}
