// Requires jsPDF UMD to be loaded as a <script> tag before this module runs.
// Called exclusively from preview page context (needs DOM canvas & Image).

export async function generatePdf(dataUrl, pageSize, imgWidth, imgHeight) {
  const { jsPDF } = window.jspdf;

  if (pageSize === 'fit') {
    // 1px at 96 dpi = 0.75pt
    const W = imgWidth * 0.75;
    const H = imgHeight * 0.75;
    const doc = new jsPDF({
      unit: 'pt',
      format: [W, H],
      orientation: W > H ? 'l' : 'p',
      compress: true,
    });
    doc.addImage(dataUrl, 'PNG', 0, 0, W, H, '', 'FAST');
    return doc.output('blob');
  }

  // A4 or Letter (portrait)
  const PAGE = pageSize === 'a4'
    ? { w: 595.28, h: 841.89 }
    : { w: 612, h: 792 };
  const margin = 20;
  const contentW = PAGE.w - margin * 2;
  const contentH = PAGE.h - margin * 2;

  // Scale factor: fit image width into content width
  const scale = contentW / imgWidth;
  // How many source pixels tall fits in one page
  const srcPxPerPage = contentH / scale;
  const totalPages = Math.ceil(imgHeight / srcPxPerPage);

  const doc = new jsPDF({ unit: 'pt', format: pageSize, orientation: 'portrait', compress: true });
  const img = await loadImage(dataUrl);

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) doc.addPage();
    const srcY = i * srcPxPerPage;
    const srcH = Math.min(srcPxPerPage, imgHeight - srcY);
    const destH = srcH * scale;

    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = Math.round(srcH);
    canvas.getContext('2d').drawImage(img, 0, srcY, imgWidth, srcH, 0, 0, imgWidth, srcH);

    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, destH, '', 'FAST');
  }

  return doc.output('blob');
}

// Generate multi-page PDF from an array of chunk data URLs (oversized pages).
// Each chunk is rendered as one or more PDF pages at the chosen page size.
export async function generatePdfFromChunks(chunkDataUrls, pageSize) {
  const { jsPDF } = window.jspdf;

  const PAGE = pageSize === 'a4'
    ? { w: 595.28, h: 841.89 }
    : pageSize === 'letter'
    ? { w: 612, h: 792 }
    : null;

  const doc = new jsPDF({
    unit: 'pt',
    format: PAGE ? pageSize : 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const margin   = PAGE ? 20 : 0;
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const contentW = pageW  - margin * 2;
  const contentH = pageH  - margin * 2;

  let firstPage = true;
  for (const chunkUrl of chunkDataUrls) {
    const img    = await loadImage(chunkUrl);
    const scale  = contentW / img.naturalWidth;
    const chunkH = img.naturalHeight * scale;

    // If chunk fits in one page
    if (chunkH <= contentH) {
      if (!firstPage) doc.addPage();
      doc.addImage(chunkUrl, 'PNG', margin, margin, contentW, chunkH, '', 'FAST');
      firstPage = false;
      continue;
    }

    // Chunk spans multiple pages — slice with canvas
    const srcPxPerPage = contentH / scale;
    const totalPages   = Math.ceil(img.naturalHeight / srcPxPerPage);
    for (let i = 0; i < totalPages; i++) {
      if (!firstPage) doc.addPage();
      const srcY  = i * srcPxPerPage;
      const srcH  = Math.min(srcPxPerPage, img.naturalHeight - srcY);
      const destH = srcH * scale;
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = Math.round(srcH);
      cv.getContext('2d').drawImage(img, 0, srcY, img.naturalWidth, srcH, 0, 0, img.naturalWidth, srcH);
      doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, destH, '', 'FAST');
      firstPage = false;
    }
  }

  return doc.output('blob');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
