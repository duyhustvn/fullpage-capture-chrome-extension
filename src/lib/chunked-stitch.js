// Stitches frames for pages taller than the 32767px canvas limit.
// Returns an array of Blobs (PNG), one per chunk.

const CHUNK_MAX_H = 30000; // safe canvas height per chunk

export async function chunkedStitch(frames, dimensions) {
  const { scrollHeight, clientHeight, clientWidth } = dimensions;
  if (frames.length === 0) throw new Error('No frames to stitch');

  const bitmaps = await Promise.all(
    frames.map(url => fetch(url).then(r => r.blob()).then(b => createImageBitmap(b)))
  );

  const frameW = bitmaps[0].width;
  const frameH = bitmaps[0].height;
  const dpr    = frameH / clientHeight;
  const totalH = Math.round(scrollHeight * dpr);

  const chunks = [];
  let globalY = 0;      // y position in full image (px)
  let frameIdx = 0;     // which frame we're pulling pixels from
  let frameUsedH = 0;   // how many px of current frame already consumed

  while (globalY < totalH) {
    const chunkH = Math.min(CHUNK_MAX_H, totalH - globalY);
    const canvas  = new OffscreenCanvas(frameW, chunkH);
    const ctx     = canvas.getContext('2d');

    let destY = 0;
    while (destY < chunkH && frameIdx < bitmaps.length) {
      const availInFrame = frameH - frameUsedH;
      const needed       = chunkH - destY;
      const drawH        = Math.min(availInFrame, needed);

      ctx.drawImage(
        bitmaps[frameIdx],
        0, frameUsedH, frameW, drawH,  // src
        0, destY,      frameW, drawH   // dst
      );

      destY      += drawH;
      frameUsedH += drawH;
      if (frameUsedH >= frameH) {
        frameIdx++;
        frameUsedH = 0;
      }
    }

    chunks.push(await canvas.convertToBlob({ type: 'image/png' }));
    globalY += chunkH;
  }

  bitmaps.forEach(b => b.close());
  return chunks;
}
