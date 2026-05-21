(() => {
  if (window.__fullpageCaptureReady) return;
  window.__fullpageCaptureReady = true;

  let savedElements = [];

  function getPageDimensions() {
    return {
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  function hideFixedElements() {
    savedElements = [];
    for (const el of document.querySelectorAll('*')) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        savedElements.push({
          el,
          position: el.style.position,
          top: el.style.top,
          bottom: el.style.bottom,
          left: el.style.left,
          right: el.style.right,
        });
        el.style.setProperty('position', 'absolute', 'important');
      }
    }
  }

  function restoreFixedElements() {
    for (const s of savedElements) {
      s.el.style.position = s.position;
      s.el.style.top = s.top;
      s.el.style.bottom = s.bottom;
      s.el.style.left = s.left;
      s.el.style.right = s.right;
    }
    savedElements = [];
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'prepareCapture') {
      hideFixedElements();
      sendResponse(getPageDimensions());
    } else if (msg.action === 'scrollTo') {
      window.scrollTo(0, msg.y);
      sendResponse({ ok: true });
    } else if (msg.action === 'restoreElements') {
      restoreFixedElements();
      window.scrollTo(0, 0);
      sendResponse({ ok: true });
    } else if (msg.action === 'getPageDimensions') {
      sendResponse(getPageDimensions());
    }
    return true;
  });
})();
