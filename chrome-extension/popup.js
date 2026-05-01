/**
 * Spectrum .spec Viewer — Popup Script
 *
 * Handles the "Open .spec file" button and drag-and-drop in the toolbar popup.
 *
 * Flow:
 *  1. User picks a file (or drops one on the drop zone)
 *  2. We read it as an ArrayBuffer and convert to a regular Array so it can
 *     be stored in chrome.storage.session (which only holds JSON-serialisable
 *     values — no raw ArrayBuffers)
 *  3. A UUID key is written to session storage alongside the filename
 *  4. viewer.html is opened in a new tab with ?key=<uuid>&filename=<name>
 *  5. viewer.js reads the bytes back out of session storage, decodes, renders
 *
 * Recent files are persisted in chrome.storage.local (filename + open date
 * only — not the raw bytes, which could be large).
 */

const RECENT_KEY    = 'spec_recent_files';
const MAX_RECENT    = 8;

// ── Open a file ───────────────────────────────────────────────────────────────

async function openFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.spec')) {
    alert('Please select a .spec file.');
    return;
  }

  // Read bytes and encode as base64 — ~33% overhead vs. ~300% for a number array
  // Chunk the fromCharCode call to avoid call-stack overflow on large files
  const arrayBuffer = await file.arrayBuffer();
  const u8 = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < u8.length; i += 8192) {
    binary += String.fromCharCode(...u8.subarray(i, i + 8192));
  }
  const b64 = btoa(binary);

  // Store under a UUID key in session storage
  const key = 'spec_' + crypto.randomUUID();
  await chrome.storage.session.set({ [key]: { b64, filename: file.name } });

  // Record in recent list (name + size + timestamp only)
  await addRecent({ name: file.name, size: file.size, openedAt: Date.now() });

  // Open viewer in a new tab
  const viewerUrl = chrome.runtime.getURL('viewer.html') +
    '?key=' + encodeURIComponent(key) +
    '&filename=' + encodeURIComponent(file.name);

  chrome.tabs.create({ url: viewerUrl });
  window.close(); // close popup
}

// ── File input ────────────────────────────────────────────────────────────────

document.getElementById('open-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
  openFile(e.target.files[0]);
});

// ── Drop zone ─────────────────────────────────────────────────────────────────

const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('click', () => {
  document.getElementById('file-input').click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  openFile(file);
});

// ── Recent files ──────────────────────────────────────────────────────────────

async function loadRecent() {
  const result = await chrome.storage.local.get(RECENT_KEY);
  return result[RECENT_KEY] || [];
}

async function addRecent(entry) {
  let recent = await loadRecent();
  // Remove duplicate name if present
  recent = recent.filter(r => r.name !== entry.name);
  recent.unshift(entry);
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  await chrome.storage.local.set({ [RECENT_KEY]: recent });
}

async function removeRecent(name) {
  let recent = await loadRecent();
  recent = recent.filter(r => r.name !== name);
  await chrome.storage.local.set({ [RECENT_KEY]: recent });
  renderRecent();
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

async function renderRecent() {
  const recent  = await loadRecent();
  const list    = document.getElementById('recent-list');
  const section = document.getElementById('recent-section');

  if (recent.length === 0) {
    list.innerHTML = '<div class="no-recent">No files opened yet</div>';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = recent.map(r => `
    <div class="recent-item" data-name="${encodeURIComponent(r.name)}">
      <span class="recent-icon">🗄️</span>
      <div class="recent-info">
        <div class="recent-name" title="${r.name}">${r.name}</div>
        <div class="recent-meta">${formatSize(r.size)} · ${formatDate(r.openedAt)}</div>
      </div>
      <button class="recent-delete" title="Remove from recent" data-name="${encodeURIComponent(r.name)}">✕</button>
    </div>
  `).join('');

  // Delete buttons
  list.querySelectorAll('.recent-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeRecent(decodeURIComponent(btn.dataset.name));
    });
  });

  // Clicking a recent item opens the file picker pre-filtered
  // (we can't re-open from path alone — browsers don't allow that)
  list.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
  });
}

// Init
renderRecent();
