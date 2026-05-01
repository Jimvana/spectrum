/**
 * Spectrum .spec Viewer — Background Service Worker (MV3 module)
 *
 * Intercepts top-level navigation to any *.spec URL and redirects it to
 * viewer.html, passing the original URL as ?url=…
 *
 * CSS/JS subresources are handled entirely in viewer.js (fetched and decoded
 * there, then inlined before the iframe srcdoc is set) — no service-worker
 * fetch interceptor needed, which keeps this worker simple and avoids
 * extension-page CSP conflicts.
 */

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    // Top-level frames only
    if (details.frameId !== 0) return;

    const url = details.url;

    // Don't loop back on our own viewer page
    if (url.startsWith(chrome.runtime.getURL(''))) return;

    // Open page indexes in the wiki reader.
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      if (path.endsWith('/page_index.json')) {
        const wikiUrl =
          chrome.runtime.getURL('wiki.html') +
          '?index=' + encodeURIComponent(url);
        chrome.tabs.update(details.tabId, { url: wikiUrl }).catch(() => {});
        return;
      }
      if (!path.endsWith('.spec')) return;
    } catch { return; }

    const viewerUrl =
      chrome.runtime.getURL('viewer.html') +
      '?url=' + encodeURIComponent(url);

    // .catch() swallows the "No tab with id" race condition that fires when
    // the tab is closed or replaced before the update lands.
    chrome.tabs.update(details.tabId, { url: viewerUrl }).catch(() => {});
  },
  { url: [{ urlMatches: '(\\.spec|/page_index\\.json)(\\?.*)?$' }] }
);
