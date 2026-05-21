export async function scrollStitchCapture(tab, onProgress) {
  const { id: tabId, windowId } = tab;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js'],
  });

  const dims = await sendTabMsg(tabId, { action: 'prepareCapture' });
  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = dims;

  const totalFrames = Math.ceil(scrollHeight / clientHeight);
  const frames = [];

  try {
    for (let i = 0; i < totalFrames; i++) {
      onProgress?.({ current: i + 1, total: totalFrames });

      await sendTabMsg(tabId, { action: 'scrollTo', y: i * clientHeight });
      await sleep(150);

      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      frames.push(dataUrl);
    }
  } finally {
    try { await sendTabMsg(tabId, { action: 'restoreElements' }); } catch {}
  }

  return { frames, dimensions: { scrollHeight, clientHeight, scrollWidth, clientWidth } };
}

function sendTabMsg(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(response);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
