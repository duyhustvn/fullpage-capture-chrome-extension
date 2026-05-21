export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateFilename(hostname, ext = 'png') {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const host = hostname.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/^_+|_+$/g, '');
  return `fullpage-${host}-${ts}.${ext}`;
}

export async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:${blob.type};base64,${base64}`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
