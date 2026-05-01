import { decodeSpec } from './spec-decoder.js';

const params = new URLSearchParams(location.search);
const indexUrl = params.get('index');

const els = {
  meta: document.getElementById('index-meta'),
  search: document.getElementById('search'),
  results: document.getElementById('results'),
  title: document.getElementById('title'),
  pageMeta: document.getElementById('page-meta'),
  content: document.getElementById('content'),
  renderedBtn: document.getElementById('rendered-btn'),
  sourceBtn: document.getElementById('source-btn'),
};

let pageIndex = null;
let pages = [];
let activeId = null;
let activeArticleText = '';
let activeRenderedHtml = '';

function showError(message) {
  els.content.className = 'content error';
  els.content.textContent = message;
}

function indexBaseUrl() {
  return indexUrl.slice(0, indexUrl.lastIndexOf('/') + 1);
}

function chunkUrl(chunkPath) {
  return new URL(chunkPath.replaceAll('\\', '/'), indexBaseUrl()).href;
}

function normalizeTitle(title) {
  return title.replaceAll('_', ' ').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
}

function formatInt(value) {
  return Number(value || 0).toLocaleString();
}

async function loadIndex() {
  if (!indexUrl) {
    throw new Error('No page_index.json URL was provided.');
  }
  const response = await fetch(indexUrl);
  if (!response.ok) throw new Error(`Could not load page index: HTTP ${response.status}`);
  pageIndex = await response.json();
  pages = pageIndex.pages || [];
  els.meta.textContent =
    `${formatInt(pageIndex.stats?.pages)} pages | ${formatInt(pageIndex.stats?.tokens_scanned)} tokens`;
  renderResults('');
}

function renderResults(query) {
  const q = normalizeTitle(query);
  const matches = [];
  for (const page of pages) {
    if (matches.length >= 100) break;
    if (!q || page.title_normalized?.includes(q)) matches.push(page);
  }

  if (!matches.length) {
    els.results.innerHTML = '<div class="meta">No matching titles</div>';
    return;
  }

  els.results.innerHTML = matches.map(page => `
    <button class="result ${page.id === activeId ? 'active' : ''}" data-id="${page.id}">
      ${escapeHtml(page.title || '(untitled)')}
      <small>#${page.id}${page.end ? '' : ' | incomplete'}</small>
    </button>
  `).join('');

  els.results.querySelectorAll('.result').forEach(button => {
    button.addEventListener('click', () => openPage(Number(button.dataset.id)));
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function stripBalancedTemplates(text) {
  let out = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++;
      continue;
    }
    if (depth > 0 && text[i] === '}' && text[i + 1] === '}') {
      depth--;
      i++;
      continue;
    }
    if (depth === 0) out += text[i];
  }
  return out;
}

function stripRefTags(text) {
  return text
    .replace(/<ref\b[^/]*?\/>/gis, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gis, '');
}

function cleanWikitext(text) {
  return stripBalancedTemplates(stripRefTags(text))
    .replace(/__\w+__/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\[\[(?:File|Image|Category):.*?\]\]\s*$/gim, '')
    .replace(/^\s*\{\|[\s\S]*?^\s*\|\}\s*$/gm, '')
    .replace(/&nbsp;/g, ' ');
}

function renderInline(text) {
  let safe = escapeHtml(text);

  safe = safe.replace(/\[\[(?:File|Image|Category):[^\]]+\]\]/gi, '');
  safe = safe.replace(/\[\[([^|\]#]+)#([^|\]]+)\|([^\]]+)\]\]/g, (_m, page, _section, label) =>
    `<a href="#" data-title="${escapeHtml(page.replaceAll('_', ' '))}">${label}</a>`);
  safe = safe.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_m, page, label) =>
    `<a href="#" data-title="${escapeHtml(page.replaceAll('_', ' '))}">${label}</a>`);
  safe = safe.replace(/\[\[([^\]]+)\]\]/g, (_m, page) => {
    const title = page.replaceAll('_', ' ');
    return `<a href="#" data-title="${escapeHtml(title)}">${escapeHtml(title)}</a>`;
  });
  safe = safe.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
  safe = safe.replace(/\[https?:\/\/[^\s\]]+\]/g, '');
  safe = safe.replace(/'''''(.+?)'''''/g, '<strong><em>$1</em></strong>');
  safe = safe.replace(/'''(.+?)'''/g, '<strong>$1</strong>');
  safe = safe.replace(/''(.+?)''/g, '<em>$1</em>');
  return safe;
}

function renderWikitext(text) {
  const cleaned = cleanWikitext(text);
  const lines = cleaned.split(/\r?\n/);
  const htmlParts = [];
  let paragraph = [];
  let listType = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    htmlParts.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listType) return;
    htmlParts.push(`</${listType}>`);
    listType = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(={2,6})\s*(.*?)\s*\1$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(4, Math.max(2, heading[1].length));
      htmlParts.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const list = line.match(/^([*#]+)\s*(.*)$/);
    if (list) {
      flushParagraph();
      const wanted = list[1][0] === '#' ? 'ol' : 'ul';
      if (listType !== wanted) {
        closeList();
        listType = wanted;
        htmlParts.push(`<${listType}>`);
      }
      htmlParts.push(`<li>${renderInline(list[2])}</li>`);
      continue;
    }

    if (line.startsWith(':')) {
      flushParagraph();
      closeList();
      htmlParts.push(`<blockquote>${renderInline(line.replace(/^:+\s*/, ''))}</blockquote>`);
      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return htmlParts.join('\n') || '<p>No readable article text found.</p>';
}

function setArticleMode(mode) {
  const sourceMode = mode === 'source';
  els.renderedBtn.classList.toggle('active', !sourceMode);
  els.sourceBtn.classList.toggle('active', sourceMode);
  els.content.className = sourceMode ? 'content source' : 'content';
  if (sourceMode) {
    els.content.textContent = activeArticleText || '';
  } else {
    els.content.innerHTML = activeRenderedHtml || '<p>No page selected.</p>';
    els.content.querySelectorAll('a[data-title]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        const title = link.dataset.title;
        els.search.value = title;
        renderResults(title);
        const ids = pageIndex?.title_index?.[normalizeTitle(title)];
        if (ids?.length) openPage(ids[0]);
      });
    });
  }
}

function extractPageFromShard(shardXml, title) {
  const escapedTitle = `<title>${title}</title>`;
  const titlePos = shardXml.indexOf(escapedTitle);
  if (titlePos < 0) {
    throw new Error(`Decoded shard did not contain title ${title}.`);
  }
  const pageStart = shardXml.lastIndexOf('<page>', titlePos);
  const pageEnd = shardXml.indexOf('</page>', titlePos);
  if (pageStart < 0 || pageEnd < 0) {
    throw new Error('Page crosses a shard boundary; browser reader does not handle that yet.');
  }
  return shardXml.slice(pageStart, pageEnd + '</page>'.length);
}

function extractArticleText(pageXml) {
  const start = pageXml.indexOf('<text');
  if (start < 0) return '';
  const startClose = pageXml.indexOf('>', start);
  if (startClose < 0) return '';
  const end = pageXml.indexOf('</text>', startClose + 1);
  if (end < 0) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = pageXml.slice(startClose + 1, end);
  return textarea.value;
}

async function openPage(pageId) {
  const page = pages.find(item => item.id === pageId);
  if (!page) return;
  activeId = pageId;
  renderResults(els.search.value);

  els.title.textContent = page.title || '(untitled)';
  els.pageMeta.textContent = `#${page.id}`;
  els.content.className = 'content empty';
  els.content.textContent = 'Decoding shard...';

  if (!page.end) {
    showError('This page is incomplete in the indexed shard set.');
    return;
  }
  if (page.start.chunk_index !== page.end.chunk_index) {
    showError('This page spans multiple shards. Multi-shard browser decode is not wired yet.');
    return;
  }

  try {
    const response = await fetch(chunkUrl(page.start.chunk_path));
    if (!response.ok) throw new Error(`Could not load shard: HTTP ${response.status}`);
    const decoded = await decodeSpec(await response.arrayBuffer());
    const pageXml = extractPageFromShard(decoded.source, page.title);
    const articleText = extractArticleText(pageXml);
    activeArticleText = articleText || pageXml;
    activeRenderedHtml = articleText ? renderWikitext(articleText) : `<pre>${escapeHtml(pageXml)}</pre>`;
    setArticleMode('rendered');
    els.pageMeta.textContent =
      `#${page.id} | shard ${page.start.chunk_index} | ${formatInt(articleText.length || pageXml.length)} chars`;
  } catch (error) {
    showError(error.message);
  }
}

els.search.addEventListener('input', () => renderResults(els.search.value));
els.renderedBtn.addEventListener('click', () => setArticleMode('rendered'));
els.sourceBtn.addEventListener('click', () => setArticleMode('source'));

loadIndex().catch(error => {
  els.meta.textContent = 'Index failed to load';
  showError(error.message);
});
