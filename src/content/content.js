(() => {
  if (window.__fullpageCaptureReady) return;
  window.__fullpageCaptureReady = true;

  let savedElements = [];

  // ── Page dimensions ───────────────────────────────────────────────────────────
  function getPageDimensions() {
    return {
      scrollHeight:    document.documentElement.scrollHeight,
      clientHeight:    document.documentElement.clientHeight,
      scrollWidth:     document.documentElement.scrollWidth,
      clientWidth:     document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  // ── Fixed / sticky hiding (includes shadow DOM + overflow fix) ────────────────
  function hideFixedElements() {
    savedElements = [];

    // Handle overflow:hidden on <html>/<body> that prevents scrolling
    for (const el of [document.documentElement, document.body]) {
      if (getComputedStyle(el).overflow === 'hidden') {
        savedElements.push({ el, prop: 'overflow', val: el.style.overflow });
        el.style.setProperty('overflow', 'visible', 'important');
      }
    }

    scanRoot(document.documentElement);
  }

  function scanRoot(root) {
    for (const el of root.querySelectorAll('*')) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') {
        savedElements.push({
          el,
          prop: 'position',
          val: el.style.position,
          extra: { top: el.style.top, bottom: el.style.bottom,
                   left: el.style.left, right: el.style.right },
        });
        el.style.setProperty('position', 'absolute', 'important');
      }
      if (el.shadowRoot) scanRoot(el.shadowRoot);
    }
  }

  function restoreFixedElements() {
    for (const s of savedElements) {
      if (s.prop === 'overflow') {
        s.el.style.overflow = s.val;
      } else {
        s.el.style.position = s.val;
        if (s.extra) {
          s.el.style.top    = s.extra.top;
          s.el.style.bottom = s.extra.bottom;
          s.el.style.left   = s.extra.left;
          s.el.style.right  = s.extra.right;
        }
      }
    }
    savedElements = [];
  }

  // ── Lazy-load pre-scroll ──────────────────────────────────────────────────────
  async function waitForLazyLoad(timeoutSec) {
    const timeoutMs  = (timeoutSec || 5) * 1000;
    const stepH      = document.documentElement.clientHeight;
    const totalH     = document.documentElement.scrollHeight;
    const steps      = Math.ceil(totalH / stepH);

    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, i * stepH);
      await delay(150);
    }
    window.scrollTo(0, 0);

    // Wait for <img> elements to finish loading
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const imgs = Array.from(document.querySelectorAll('img[src]'));
      if (imgs.every(img => img.complete && img.naturalWidth > 0)) break;
      await delay(300);
    }
  }

  // ── Infinite scroll detection ─────────────────────────────────────────────────
  async function detectInfiniteScroll(maxHeight) {
    const initialH = document.documentElement.scrollHeight;
    window.scrollTo(0, initialH);
    await delay(800);
    const afterH = document.documentElement.scrollHeight;
    window.scrollTo(0, 0);
    return {
      detected:      afterH > initialH,
      initialHeight: initialH,
      currentHeight: afterH,
      exceedsLimit:  maxHeight > 0 && afterH > maxHeight,
    };
  }

  // ── Area selection overlay ────────────────────────────────────────────────────
  function showSelectionOverlay(sendResponse) {
    if (document.getElementById('__fpc_overlay__')) return;

    const overlay = document.createElement('div');
    overlay.id = '__fpc_overlay__';
    overlay.setAttribute('style', [
      'position:fixed!important', 'top:0!important', 'left:0!important',
      'width:100vw!important', 'height:100vh!important',
      'background:rgba(0,0,0,0.45)!important',
      'cursor:crosshair!important', 'z-index:2147483647!important',
      'user-select:none!important', 'margin:0!important', 'padding:0!important',
    ].join(';'));

    const sel = document.createElement('div');
    sel.setAttribute('style', [
      'position:absolute!important', 'display:none!important',
      'border:2px solid #1e72e8!important',
      'background:rgba(30,114,232,0.12)!important',
      'box-sizing:border-box!important', 'pointer-events:none!important',
    ].join(';'));
    overlay.appendChild(sel);

    const hint = document.createElement('div');
    hint.textContent = 'Drag to select area  ·  ESC to cancel';
    hint.setAttribute('style', [
      'position:absolute!important', 'top:12px!important', 'left:50%!important',
      'transform:translateX(-50%)!important',
      'background:rgba(0,0,0,0.75)!important', 'color:#fff!important',
      'padding:6px 14px!important', 'border-radius:4px!important',
      'font:13px/1.4 system-ui,sans-serif!important', 'pointer-events:none!important',
      'white-space:nowrap!important',
    ].join(';'));
    overlay.appendChild(hint);

    let sx = 0, sy = 0, active = false;

    function pos(e) { return { x: e.clientX, y: e.clientY }; }

    function cleanup() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }

    function onKey(e) {
      if (e.key === 'Escape') { cleanup(); sendResponse(null); }
    }

    overlay.addEventListener('mousedown', e => {
      e.preventDefault();
      active = true;
      ({ x: sx, y: sy } = pos(e));
      sel.style.setProperty('display', 'block', 'important');
      sel.style.setProperty('left',   sx + 'px', 'important');
      sel.style.setProperty('top',    sy + 'px', 'important');
      sel.style.setProperty('width',  '0', 'important');
      sel.style.setProperty('height', '0', 'important');
    });

    overlay.addEventListener('mousemove', e => {
      if (!active) return;
      e.preventDefault();
      const { x, y } = pos(e);
      sel.style.setProperty('left',   Math.min(sx, x) + 'px', 'important');
      sel.style.setProperty('top',    Math.min(sy, y) + 'px', 'important');
      sel.style.setProperty('width',  Math.abs(x - sx) + 'px', 'important');
      sel.style.setProperty('height', Math.abs(y - sy) + 'px', 'important');
    });

    overlay.addEventListener('mouseup', e => {
      if (!active) return;
      active = false;
      e.preventDefault();
      const { x, y } = pos(e);
      const rx = Math.min(sx, x), ry = Math.min(sy, y);
      const rw = Math.abs(x - sx), rh = Math.abs(y - sy);
      cleanup();
      if (rw < 5 || rh < 5) { sendResponse(null); return; }
      sendResponse({ x: rx, y: ry, w: rw, h: rh, dpr: window.devicePixelRatio || 1 });
    });

    document.addEventListener('keydown', onKey);
    document.documentElement.appendChild(overlay);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Message router ────────────────────────────────────────────────────────────
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

    } else if (msg.action === 'waitForLazyLoad') {
      waitForLazyLoad(msg.timeout).then(() => sendResponse({ ok: true }));
      return true;

    } else if (msg.action === 'detectInfiniteScroll') {
      detectInfiniteScroll(msg.maxHeight).then(sendResponse);
      return true;

    } else if (msg.action === 'startAreaSelect') {
      showSelectionOverlay(sendResponse);
      return true;
    }
    return true;
  });
})();
