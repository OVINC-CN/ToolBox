(() => {
  'use strict';
  const switcher = document.querySelector('.version-switcher');
  const viewer = document.getElementById('version-viewer');
  if (!switcher || !viewer) return;
  const summary = switcher.querySelector('summary');
  const currentLabel = document.getElementById('current-version');
  const currentFormat = document.getElementById('current-format');
  const currentDate = document.getElementById('current-date');
  const links = Array.from(switcher.querySelectorAll('a[data-version]'));
  // The catalogue comes from the root menu.
  const versions = new Map(links.map(link => [link.dataset.version, {
    id: link.dataset.version, label: link.dataset.label,
    format: link.dataset.format, date: link.dataset.date,
    path: link.getAttribute('href'), link
  }]));
  const defaultVersion = versions.get(document.body.dataset.defaultVersion);
  if (!defaultVersion) return;
  const feedback = document.getElementById('viewer-feedback');
  const message = document.getElementById('viewer-message');
  const recovery = document.getElementById('viewer-recovery');
  const standaloneLink = document.getElementById('open-version');
  let activeFrame = document.getElementById('version-frame');
  let activeVersion = null;
  let loadingTimer;
  let stopFrameSizing = () => {};

  function versionTitle(version) {
    return `${version.label} · ${version.format} · ${version.date}`;
  }

  // Grow the same-origin artwork frame so the outer document owns scrolling.
  // Only observe document layout, not the animation's per-frame SVG mutations.
  function followContentHeight(frame) {
    const child = frame.contentDocument;
    let pending = null;
    let disposed = false;
    const minimumHeight = () => Math.max(320, window.innerHeight);
    function measure() {
      pending = null;
      if (disposed || activeFrame !== frame || !child.body) return;
      const height = Math.ceil(Math.max(
        minimumHeight(), child.body.scrollHeight,
        child.body.getBoundingClientRect().height
      ));
      if (Math.abs(frame.getBoundingClientRect().height - height) > 0.5) {
        frame.style.height = height + 'px';
      }
    }
    function queueMeasure() {
      if (!disposed && pending === null) pending = requestAnimationFrame(measure);
    }
    function resetHeight() {
      frame.style.height = minimumHeight() + 'px';
      queueMeasure();
    }
    const observer = new ResizeObserver(queueMeasure);
    observer.observe(child.body);
    window.addEventListener('resize', resetHeight);
    child.addEventListener('load', queueMeasure, true);
    child.fonts?.ready.then(queueMeasure);
    resetHeight();
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('resize', resetHeight);
      child.removeEventListener('load', queueMeasure, true);
      if (pending !== null) cancelAnimationFrame(pending);
    };
  }

  function selectedFromURL() {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get('version');
    if (requested === null) return defaultVersion;
    if (versions.has(requested)) return versions.get(requested);
    url.searchParams.delete('version');
    window.history.replaceState(null, '', url);
    return defaultVersion;
  }

  function showVersion(version, reload = false) {
    switcher.open = false;
    if (!reload && activeVersion?.id === version.id) return;
    activeVersion = version;
    stopFrameSizing();
    stopFrameSizing = () => {};
    clearTimeout(loadingTimer);
    currentLabel.textContent = version.label;
    currentFormat.textContent = version.format;
    currentFormat.dataset.format = version.format;
    currentDate.textContent = version.date;
    const title = versionTitle(version);
    summary.setAttribute('aria-label', '切换版本，当前版本：' + title);
    document.title = title + ' · 版本展示';
    links.forEach(link => {
      const selected = link.dataset.version === version.id;
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.querySelector('.version-current').hidden = !selected;
    });
    viewer.setAttribute('aria-busy', 'true');
    feedback.hidden = false;
    recovery.hidden = true;
    message.textContent = '正在加载…';
    standaloneLink.href = version.path;

    // Replace the browsing context: old animations stop, and changing iframe
    // src does not create additional steps in the browser's Back history.
    const nextFrame = document.createElement('iframe');
    nextFrame.id = 'version-frame';
    nextFrame.title = title;
    nextFrame.src = version.path;
    function loadFailed() {
      if (activeFrame !== nextFrame) return;
      clearTimeout(loadingTimer);
      viewer.setAttribute('aria-busy', 'false');
      message.textContent = '页面暂未加载完成。';
      feedback.hidden = false;
      recovery.hidden = false;
    }
    nextFrame.addEventListener('load', () => {
      if (activeFrame !== nextFrame) return;
      try {
        const loadedURL = new URL(nextFrame.contentWindow.location.href);
        if (loadedURL.href === 'about:blank') return;
        const expectedURL = new URL(version.path, window.location.href);
        if (loadedURL.origin !== expectedURL.origin || !loadedURL.pathname.startsWith(expectedURL.pathname)) {
          loadFailed();
          return;
        }
        document.title = title + ' · 版本展示';
        stopFrameSizing();
        stopFrameSizing = followContentHeight(nextFrame);
      } catch {
        loadFailed();
        return;
      }
      clearTimeout(loadingTimer);
      viewer.setAttribute('aria-busy', 'false');
      feedback.hidden = true;
    });
    nextFrame.addEventListener('error', loadFailed);
    const previousFrame = activeFrame;
    activeFrame = nextFrame;
    previousFrame.replaceWith(nextFrame);
    loadingTimer = window.setTimeout(loadFailed, 15000);
  }

  links.forEach(link => {
    link.addEventListener('click', event => {
      // Modified clicks can still open the standalone version.
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const version = versions.get(link.dataset.version);
      if (activeVersion?.id !== version.id) {
        const url = new URL(window.location.href);
        url.searchParams.set('version', version.id);
        window.history.pushState({ version: version.id }, '', url);
      }
      showVersion(version);
      summary.focus();
    });
  });
  window.addEventListener('popstate', () => showVersion(selectedFromURL()));
  document.getElementById('retry-version').addEventListener('click', () => showVersion(activeVersion, true));
  document.addEventListener('click', event => {
    if (!switcher.contains(event.target)) switcher.open = false;
  });
  switcher.addEventListener('focusout', event => {
    if (event.relatedTarget && !switcher.contains(event.relatedTarget)) switcher.open = false;
  });
  switcher.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      switcher.open = false;
      summary.focus();
    }
  });
  showVersion(selectedFromURL());
})();
