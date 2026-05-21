document.addEventListener('DOMContentLoaded', () => {
  const btnFull    = document.getElementById('btn-full-page');
  const btnVisible = document.getElementById('btn-visible');
  const statusEl   = document.getElementById('status');
  const progressEl = document.getElementById('progress-wrap');

  // Receive progress updates broadcast from service worker
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'progress') {
      setStatus(msg.type, msg.text);
    }
  });

  btnFull.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Starting...');
    const res = await chrome.runtime.sendMessage({ action: 'captureFullPage' }).catch(toErr);
    handleResult(res);
  });

  btnVisible.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Capturing...');
    const res = await chrome.runtime.sendMessage({ action: 'captureVisible' }).catch(toErr);
    handleResult(res);
  });

  function handleResult(res) {
    if (res?.success) {
      // status already set to 'done' via broadcast; re-enable after short delay
      setTimeout(() => setBusy(false), 1800);
    } else {
      setStatus('error', res?.error || 'Something went wrong');
      setBusy(false);
    }
  }

  function setBusy(busy) {
    btnFull.disabled    = busy;
    btnVisible.disabled = busy;
    progressEl.classList.toggle('hidden', !busy);
    if (!busy) setStatus('', '');
  }

  function setStatus(type, text) {
    statusEl.textContent = text;
    statusEl.className   = `status ${type}`;
  }

  function toErr(err) {
    return { success: false, error: err.message };
  }
});
