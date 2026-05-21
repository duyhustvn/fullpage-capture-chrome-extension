const MAX_DIMENSION = 32767;

export async function stitchFrames(frames, dimensions) {
  const { scrollHeight, clientHeight, clientWidth } = dimensions;

  const bitmaps = await Promise.all(
    frames.map(url => fetch(url).then(r => r.blob()).then(b => createImageBitmap(b)))
  );

  if (bitmaps.length === 0) throw new Error('No frames to stitch');

  const frameW = bitmaps[0].width;
  const frameH = bitmaps[0].height;
  const dpr = frameH / clientHeight;

  const canvasW = frameW;
  const canvasH = Math.round(scrollHeight * dpr);

  if (canvasW > MAX_DIMENSION || canvasH > MAX_DIMENSION) {
    bitmaps.forEach(b => b.close());
    throw new Error(`Page too long to capture (${canvasH}px exceeds ${MAX_DIMENSION}px canvas limit)`);
  }

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < bitmaps.length; i++) {
    const destY = i * frameH;
    const drawH = Math.min(frameH, canvasH - destY);
    ctx.drawImage(bitmaps[i], 0, 0, frameW, drawH, 0, destY, frameW, drawH);
    bitmaps[i].close();
  }

  return canvas.convertToBlob({ type: 'image/png' });
}
