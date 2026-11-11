// Render each leaf from valle.pdf at the current screen resolution, without disturbing page flips.
(function () {
  // Parse and decode the PDF in a real Web Worker so the flip animation keeps the main thread.
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.js';
  // valle.pdf is linearized, so PDF.js fetches byte ranges and the first spread draws early.
  const docPromise = pdfjsLib.getDocument({ url: 'valle.pdf', isEvalSupported: false }).promise;
  const MAX_LEAF_HEIGHT = 3072;   // caps memory per page image on large/high-DPI screens
  const pageUrls = new Map();     // "page:part" -> object URL
  let renderedHeight = 0, generation = 0;

  function targetLeafHeight() {
    const leaf = document.querySelector('#book .leaf');
    const cssHeight = leaf ? leaf.getBoundingClientRect().height : 0;
    const h = Math.max(cssHeight, window.innerHeight * 0.9);
    return Math.min(MAX_LEAF_HEIGHT, Math.ceil(h * (window.devicePixelRatio || 1)));
  }

  // Wait until no page is flipping (flipbook.js sets `busy`), then for an idle moment.
  function whenQuiet() {
    return new Promise(resolve => {
      const check = () => {
        if (typeof busy !== 'undefined' && busy) return setTimeout(check, 120);
        if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 500 });
        else setTimeout(resolve, 0);
      };
      check();
    });
  }

  // Decode before swapping in, so the browser never decodes a large image mid-flip.
  async function applyUrl(key, url) {
    const [page, part] = key.split(':');
    const probe = new Image();
    probe.src = url;
    try { await probe.decode(); } catch (_) { /* fall back to lazy decode */ }
    await whenQuiet();
    document.querySelectorAll(`img.art[data-pdf-page="${page}"][data-part="${part}"]`).forEach(img => { img.src = url; });
  }

  async function renderPage(doc, number, leafHeight, gen) {
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: leafHeight / base.height });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    if (gen !== generation) return;
    const parts = Array.from(new Set(Array.from(document.querySelectorAll(`img.art[data-pdf-page="${number}"]`), i => i.dataset.part)));
    for (const part of parts) {
      let out = canvas;
      if (part !== 'full') {
        const half = Math.floor(canvas.width / 2);
        out = document.createElement('canvas');
        out.width = part === 'left' ? half : canvas.width - half;
        out.height = canvas.height;
        out.getContext('2d').drawImage(canvas, part === 'left' ? 0 : half, 0, out.width, out.height, 0, 0, out.width, out.height);
      }
      const blob = await new Promise(r => out.toBlob(r, 'image/png'));
      if (gen !== generation) return;
      const key = `${number}:${part}`;
      const old = pageUrls.get(key);
      const url = URL.createObjectURL(blob);
      pageUrls.set(key, url);
      await applyUrl(key, url);
      if (old) setTimeout(() => URL.revokeObjectURL(old), 2000);
    }
    canvas.width = canvas.height = 0;   // release canvas memory promptly
  }

  // PDF page shown on the currently visible spread (book page 1 is the cover = PDF page 1).
  function currentPdfPage() {
    const first = Number((document.querySelector('#page-number') || {}).value || 1);
    return first <= 1 ? 1 : Math.floor(first / 2) + 1;
  }

  async function renderAll() {
    const leafHeight = targetLeafHeight();
    if (leafHeight <= renderedHeight) return;
    renderedHeight = leafHeight;
    const gen = ++generation;
    const doc = await docPromise;
    const pending = new Set(Array.from({ length: doc.numPages }, (_, i) => i + 1));
    while (pending.size) {
      await whenQuiet();
      if (gen !== generation) return;
      // Always render the remaining page nearest to where the reader is now, preferring ahead.
      const at = currentPdfPage();
      let next = null, best = Infinity;
      for (const p of pending) {
        const d = p >= at ? p - at : (at - p) + 0.5;
        if (d < best) { best = d; next = p; }
      }
      pending.delete(next);
      await renderPage(doc, next, leafHeight, gen);
    }
  }

  // Leaves are cloned on resize; keep their already-rendered images and re-render if bigger is needed.
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderAll, 400); });
  renderAll().catch(err => { console.error(err); });
})();
