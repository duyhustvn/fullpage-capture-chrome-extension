export async function cdpCapture(tab) {
  const { id: tabId } = tab;
  let attached = false;
  let timeoutHandle;

  const attach = () => new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve();
    });
  });

  const detach = () => new Promise(resolve => {
    chrome.debugger.detach({ tabId }, () => resolve());
  });

  const sendCmd = (method, params = {}) => new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, result => {
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(result);
    });
  });

  timeoutHandle = setTimeout(async () => {
    if (attached) { try { await detach(); } catch {} }
  }, 30000);

  try {
    await attach();
    attached = true;

    const { contentSize } = await sendCmd('Page.getLayoutMetrics');
    const width = Math.ceil(contentSize.width);
    const height = Math.ceil(contentSize.height);

    await sendCmd('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const { data } = await sendCmd('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });

    await sendCmd('Emulation.clearDeviceMetricsOverride');
    return data; // base64 PNG
  } finally {
    clearTimeout(timeoutHandle);
    if (attached) { try { await detach(); } catch {} }
  }
}
