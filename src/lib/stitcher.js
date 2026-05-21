import { chunkedStitch } from './chunked-stitch.js';

const MAX_DIMENSION = 32767;

// Returns { chunked: false, blob } for normal pages,
// or      { chunked: true,  blobs: Blob[] } for pages > MAX_DIMENSION px.
export async function stitchFrames(frames, dimensions) {
  const { scrollHeight, clientHeight, clientWidth } = dimensions;
  if (frames.length === 0) throw new Error('No frames to stitch');

  // Probe first frame to get real pixel dimensions
  const firstBlob   = await (await fetch(frames[0])).blob();
  const firstBitmap = await createImageBitmap(firstBlob);
  const frameW = firstBitmap.width;
  const frameH = firstBitmap.height;
  firstBitmap.close();

  const dpr     = frameH / clientHeight;
  const canvasH = Math.round(scrollHeight * dpr);

  if (frameW > MAX_DIMENSION || canvasH > MAX_DIMENSION) {
    const blobs = await chunkedStitch(frames, dimensions);
    return { chunked: true, blobs };
  }

  // Normal single-canvas stitch
  const bitmaps = await Promise.all(
    frames.map(url => fetch(url).then(r => r.blob()).then(b => createImageBitmap(b)))
  );

  const canvas = new OffscreenCanvas(frameW, canvasH);
  const ctx    = canvas.getContext('2d');

  for (let i = 0; i < bitmaps.length; i++) {
    const destY = i * frameH;
    const drawH = Math.min(frameH, canvasH - destY);
    ctx.drawImage(bitmaps[i], 0, 0, frameW, drawH, 0, destY, frameW, drawH);
    bitmaps[i].close();
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { chunked: false, blob };
}
