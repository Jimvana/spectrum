/**
 * Spectrum .spec Viewer — Viewer Page Script (ES module)
 *
 * Flow:
 *  1. Read ?url= param, fetch the .spec binary, decode with spec-decoder.js
 *  2. For HTML files  → fetch + decode every *.spec CSS/JS subresource,
 *                       inline them directly into the HTML, then set srcdoc.
 *                       The iframe has no allow-same-origin so it gets a null
 *                       origin with no inherited CSP — external resources like
 *                       Google Fonts load normally, inlined JS runs freely.
 *  3. For everything  → syntax-highlighted source view (highlight.js bundled
 *                       locally, no CDN).
 */

import { decodeSpec, inferHljsLang } from './spec-decoder.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function showError(title, message) {
  document.getElementById('loading').style.display = 'none';
  const err = document.getElementById('error');
  err.style.display = 'flex';
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-body').textContent  = message;
}

function setMeta({ filename, meta, checksumOk, tokenCount, fileSize, langName }) {
  const ratio  = fileSize ? (fileSize / meta.origLength).toFixed(3) + '×' : '—';
  document.getElementById('meta-filename').textContent = filename;
  document.getElementById('meta-lang').textContent     = langName;
  document.getElementById('meta-tokens').textContent   = tokenCount.toLocaleString() + ' tokens';
  document.getElementById('meta-orig').textContent     = meta.origLength.toLocaleString() + ' bytes';
  document.getElementById('meta-ratio').textContent    = ratio + ' .spec/source';
  const ck = document.getElementById('meta-cksum');
  ck.textContent = checksumOk ? '✓' : '⚠';
  ck.title       = checksumOk ? 'Checksum verified' : 'Checksum mismatch';
  ck.className   = 'pill ' + (checksumOk ? 'ok' : 'warn');
  document.getElementById('meta-dictv').textContent = `dict v${meta.dictVersion}`;
}

// ── Inline CSS / JS into decoded HTML ────────────────────────────────────────
//
// Fetches and decodes every *.spec stylesheet and script reference found in
// the parsed document, replacing them with inline <style> / <script> nodes.
// This sidesteps all CSP/origin issues in the sandboxed iframe.

async function inlineSpecResources(doc, baseDir) {
  // CSS: <link rel="stylesheet" href="*.spec">
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))
    .filter(el => el.getAttribute('href').toLowerCase().endsWith('.spec'));

  for (const link of links) {
    try {
      const url  = new URL(link.getAttribute('href'), baseDir).href;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { source: css } = await decodeSpec(await resp.arrayBuffer());
      const style = doc.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
    } catch (e) {
      console.warn('[spec-viewer] Could not inline CSS:', link.getAttribute('href'), e.message);
    }
  }

  // JS: <script src="*.spec">
  const scripts = Array.from(doc.querySelectorAll('script[src]'))
    .filter(el => el.getAttribute('src').toLowerCase().endsWith('.spec'));

  for (const script of scripts) {
    try {
      const url  = new URL(script.getAttribute('src'), baseDir).href;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { source: js } = await decodeSpec(await resp.arrayBuffer());
      const inlined = doc.createElement('script');
      inlined.textContent = js;
      // Preserve any type/defer/async attributes (except src)
      for (const attr of script.attributes) {
        if (attr.name !== 'src') inlined.setAttribute(attr.name, attr.value);
      }
      script.replaceWith(inlined);
    } catch (e) {
      console.warn('[spec-viewer] Could not inline JS:', script.getAttribute('src'), e.message);
    }
  }
}

// ── Live HTML render ──────────────────────────────────────────────────────────

async function renderLive(source, specUrl) {
  const baseDir = specUrl.substring(0, specUrl.lastIndexOf('/') + 1);

  const parser = new DOMParser();
  const doc    = parser.parseFromString(source, 'text/html');

  await inlineSpecResources(doc, baseDir);

  // srcdoc needs a complete serialised document
  const finalHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

  const iframe = document.getElementById('live-iframe');
  iframe.srcdoc = finalHtml;
  iframe.style.display = 'block';

  // Show toggle
  document.getElementById('view-toggle').style.display = 'flex';
  document.getElementById('live-btn').addEventListener('click',   () => setView('live'));
  document.getElementById('source-btn').addEventListener('click', () => setView('source'));
}

function setView(mode) {
  const iframe   = document.getElementById('live-iframe');
  const codeWrap = document.getElementById('code-wrap');
  document.getElementById('live-btn').classList.toggle('active',   mode === 'live');
  document.getElementById('source-btn').classList.toggle('active', mode === 'source');
  iframe.style.display   = mode === 'live'   ? 'block' : 'none';
  codeWrap.style.display = mode === 'source' ? 'block' : 'none';
}

// ── Source render ─────────────────────────────────────────────────────────────

function renderSource(source, langHljs, hidden) {
  const codeEl = document.getElementById('source-code');
  codeEl.textContent = source;
  codeEl.className   = `language-${langHljs}`;
  if (typeof hljs !== 'undefined') hljs.highlightElement(codeEl);
  document.getElementById('code-wrap').style.display = hidden ? 'none' : 'block';
}

// ── Copy button ───────────────────────────────────────────────────────────────

function initCopyBtn(source) {
  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(source).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy source'; }, 2000);
    });
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const params   = new URLSearchParams(window.location.search);
  const specUrl  = params.get('url');
  const storageKey = params.get('key');

  if (!specUrl && !storageKey) {
    showError('No URL provided', 'Navigate to a .spec file to open it, or use the toolbar button.');
    return;
  }

  // Resolve filename — from storage metadata or from the URL path
  let filename;
  if (storageKey) {
    filename = decodeURIComponent(params.get('filename') || 'file.spec');
  } else {
    filename = decodeURIComponent(specUrl).split('/').pop().split('?')[0];
  }

  document.title = filename + ' — Spectrum Viewer';
  document.getElementById('loading-name').textContent = filename;

  // Fetch raw binary — two sources: session storage (popup) or URL fetch
  let arrayBuffer, fileSize;

  if (storageKey) {
    // Opened via the popup file picker — bytes are in session storage
    try {
      const result = await chrome.storage.session.get(storageKey);
      const entry  = result[storageKey];
      if (!entry) throw new Error('Session data expired or not found. Please re-open the file.');
      // Decode base64 back to ArrayBuffer
      const binary = atob(entry.b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      arrayBuffer = bytes.buffer;
      fileSize    = arrayBuffer.byteLength;
      // Clean up so session storage doesn't fill up
      chrome.storage.session.remove(storageKey);
    } catch (e) {
      showError('Could not read file from storage', e.message);
      return;
    }
  } else {
    // Opened via URL navigation or address bar
    try {
      const response = await fetch(specUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      arrayBuffer = await response.arrayBuffer();
      fileSize    = arrayBuffer.byteLength;
    } catch (e) {
      showError(
        'Failed to fetch .spec file',
        `${e.message}\n\n` +
        'For local files (file://) enable "Allow access to file URLs"\n' +
        'at chrome://extensions → Spectrum .spec Viewer → Details'
      );
      return;
    }
  }

  // Decode
  let decoded;
  try {
    decoded = await decodeSpec(arrayBuffer);
  } catch (e) {
    showError('Decode error', e.message);
    return;
  }

  const { source, meta, checksumOk, tokenCount } = decoded;

  // Language from double extension (more reliable than lang ID alone)
  const langHljs = inferHljsLang(filename) || 'plaintext';
  const langName = langHljs.charAt(0).toUpperCase() + langHljs.slice(1);
  const isHtml   = langHljs === 'html';

  document.getElementById('loading').style.display = 'none';
  document.getElementById('result').style.display  = 'flex';

  setMeta({ filename, meta, checksumOk, tokenCount, fileSize, langName });
  renderSource(source, langHljs, isHtml);   // hidden initially for HTML
  initCopyBtn(source);

  if (isHtml) {
    // For storage-opened files there's no base URL — subresource inlining
    // won't be possible, but the decoded HTML will still render correctly
    // as a self-contained page if its CSS/JS were already inlined.
    await renderLive(source, specUrl || '');
    setView('live');
  }
}

document.addEventListener('DOMContentLoaded', main);
