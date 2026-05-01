/**
 * Spectrum .spec Decoder — ES Module
 * Shared by background.js (service worker) and viewer.js.
 *
 * Supports:
 *   v6  —  uint16 LE tokens, 447-token dictionary (inline)
 *   v7-v10 — uint32 LE tokens, append-only token dictionary loaded from spec-tokens.json
 *
 * Exports:
 *   decodeSpec(arrayBuffer)  → { source, meta, checksumOk, tokenCount }
 *   inferContentType(pathname) → MIME type string
 *   inferHljsLang(pathname)    → highlight.js language name
 */

// ── v6 inline dictionary (447 tokens) ────────────────────────────────────────
const SPEC_TOKENS_V6 = ["if", "elif", "else", "for", "while", "break", "continue", "pass", "return", "yield", "def", "class", "lambda", "async", "await", "import", "from", "as", "try", "except", "finally", "raise", "assert", "True", "False", "None", "and", "or", "not", "in", "is", "global", "nonlocal", "del", "with", "print", "+", "-", "*", "/", "//", "%", "**", "==", "!=", "<", ">", "<=", ">=", "=", "+=", "-=", "*=", "/=", "&", "|", "^", "~", "<<", ">>", "(", ")", "[", "]", "{", "}", ":", ",", ".", ";", "@", "#", "->", "...", "\"", "'", "\"\"\"", "'''", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", " ", "\t", "\n", "\r", "abs", "aiter", "all", "anext", "any", "ascii", "bin", "breakpoint", "callable", "chr", "compile", "copyright", "credits", "delattr", "dir", "divmod", "enumerate", "eval", "exec", "exit", "filter", "format", "getattr", "globals", "hasattr", "hash", "help", "hex", "id", "input", "isinstance", "issubclass", "iter", "len", "license", "locals", "map", "max", "memoryview", "min", "next", "oct", "open", "ord", "pow", "property", "quit", "range", "repr", "reversed", "round", "setattr", "slice", "sorted", "staticmethod", "sum", "super", "vars", "zip", "bool", "bytearray", "bytes", "classmethod", "complex", "dict", "float", "frozenset", "int", "list", "object", "set", "str", "tuple", "type", "self", "cls", "args", "kwargs", "result", "value", "name", "data", "key", "obj", "func", "text", "node", "msg", "path", "url", "mode", "error", "index", "size", "count", "buf", "tmp", "flag", "Exception", "ValueError", "TypeError", "KeyError", "IndexError", "AttributeError", "RuntimeError", "StopIteration", "IOError", "OSError", "ImportError", "NameError", "NotImplementedError", "OverflowError", "ZeroDivisionError", "FileNotFoundError", "PermissionError", "TimeoutError", "ConnectionError", "RecursionError", "MemoryError", "SyntaxError", "UnicodeError", "ArithmeticError", "append", "extend", "insert", "remove", "pop", "clear", "sort", "reverse", "get", "update", "keys", "values", "items", "join", "split", "strip", "replace", "startswith", "endswith", "encode", "decode", "read", "write", "close", "seek", "flush", "copy", "lower", "upper", "match", "search", "findall", "os", "sys", "re", "io", "math", "json", "abc", "ast", "time", "functools", "itertools", "collections", "pathlib", "typing", "logging", "threading", "subprocess", "datetime", "unittest", "html", "head", "body", "div", "span", "ul", "ol", "li", "table", "tr", "td", "th", "form", "button", "script", "style", "link", "meta", "title", "header", "footer", "nav", "section", "article", "main", "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr", "strong", "em", "code", "pre", "img", "iframe", "canvas", "video", "audio", "href", "src", "alt", "placeholder", "rel", "disabled", "checked", "defer", "charset", "onclick", "onchange", "onsubmit", "onload", "tabindex", "download", "hidden", "multiple", "autocomplete", "colspan", "rowspan", "var", "let", "const", "function", "this", "new", "typeof", "instanceof", "switch", "case", "void", "debugger", "do", "of", "export", "null", "undefined", "NaN", "Infinity", "===", "!==", "=>", "++", "--", "?.", "??", "console", "document", "window", "JSON", "Object", "Array", "Math", "Number", "String", "Boolean", "Promise", "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "addEventListener", "querySelector", "getElementById", "callback", "resolve", "reject", "prototype", "module", "@media", "@import", "@keyframes", "@font-face", "@supports", "@charset", "@layer", "@container", "@page", "@namespace", "display", "position", "top", "right", "bottom", "left", "width", "height", "max-width", "min-width", "max-height", "min-height", "overflow", "z-index", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "border", "border-radius", "color", "font-size", "font-weight", "font-family", "line-height", "text-align", "text-decoration", "background", "background-color", "background-image", "opacity", "transform", "transition", "cursor", "none", "auto", "block", "inline", "inline-block", "flex", "grid", "absolute", "relative", "fixed", "sticky", "bold", "normal", "inherit", "initial", "unset", "center", "visible", "pointer", "solid"];
const SPEC_ID_ASCII_BASE_V6 = 447;
const SPEC_ID_RLE_V6        = 0xFFFD;
const SPEC_ID_UNICODE_V6    = 0xFFFE;

// ── v7 dictionary (lazy-loaded from spec-tokens.json) ─────────────────────────
// SPEC_ID_RLE_V7 = 0xFFFFFFFD, SPEC_ID_UNICODE_V7 = 0xFFFFFFFE
// uint32 LE tokens; Unicode escape followed by ONE uint32 code point
const SPEC_ID_RLE_V7     = 0xFFFFFFFD; // 4294967293
const SPEC_ID_UNICODE_V7 = 0xFFFFFFFE; // 4294967294

const CURRENT_DICT_VERSION = 10;
const ASCII_BASE_BY_DICT_VERSION = {
  7: 234702,
  8: 234830,
  9: 234893,
  10: 234957,
};

let _v7Tokens = null;  // Array<string>, current append-only token table

async function loadV7Tokens() {
  if (_v7Tokens !== null) return;
  const url = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
    ? chrome.runtime.getURL('spec-tokens.json')
    : new URL('./spec-tokens.json', import.meta.url).href;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load token dictionary (HTTP ${resp.status})`);
  _v7Tokens = await resp.json();
  if (_v7Tokens.length < ASCII_BASE_BY_DICT_VERSION[CURRENT_DICT_VERSION]) {
    throw new Error(`Token dictionary is stale (${_v7Tokens.length} entries).`);
  }
}

// ── Content-type inference from double extension ──────────────────────────────
const EXT_MIME = {
  '.html.spec':  'text/html',
  '.htm.spec':   'text/html',
  '.css.spec':   'text/css',
  '.js.spec':    'application/javascript',
  '.mjs.spec':   'application/javascript',
  '.cjs.spec':   'application/javascript',
  '.py.spec':    'text/plain',
  '.json.spec':  'application/json',
  '.ts.spec':    'application/javascript',
  '.tsx.spec':   'application/javascript',
  '.sql.spec':   'text/plain',
  '.rs.spec':    'text/plain',
  '.php.spec':   'text/plain',
  '.phtml.spec': 'text/plain',
  '.xml.spec':   'application/xml',
  '.md.spec':    'text/plain',
  '.txt.spec':   'text/plain',
};

export function inferContentType(pathname) {
  const p = pathname.toLowerCase().replace(/\?.*$/, '');
  for (const [ext, mime] of Object.entries(EXT_MIME)) {
    if (p.endsWith(ext)) return mime;
  }
  return 'text/plain';
}

export function inferHljsLang(pathname) {
  const p = pathname.toLowerCase();
  if (p.endsWith('.html.spec') || p.endsWith('.htm.spec')) return 'html';
  if (p.endsWith('.css.spec'))  return 'css';
  if (p.endsWith('.js.spec') || p.endsWith('.mjs.spec')) return 'javascript';
  if (p.endsWith('.ts.spec') || p.endsWith('.tsx.spec')) return 'typescript';
  if (p.endsWith('.py.spec'))   return 'python';
  if (p.endsWith('.xml.spec'))  return 'xml';
  if (p.endsWith('.php.spec') || p.endsWith('.phtml.spec')) return 'php';
  if (p.endsWith('.sql.spec'))  return 'sql';
  if (p.endsWith('.rs.spec'))   return 'rust';
  return 'plaintext';
}

// ── Header parsing ────────────────────────────────────────────────────────────
const MAGIC       = [0x53, 0x50, 0x45, 0x43]; // 'SPEC'
const HEADER_SIZE = 16;
const FLAG_RLE    = 0x01;

function readU16BE(buf, off) { return (buf[off] << 8) | buf[off + 1]; }
function readU32BE(buf, off) {
  return (buf[off] * 0x1000000) + (buf[off+1] << 16) + (buf[off+2] << 8) + buf[off+3];
}

function parseHeader(buf) {
  if (buf.length < HEADER_SIZE) throw new Error(`File too short (${buf.length} B).`);
  for (let i = 0; i < 4; i++) {
    if (buf[i] !== MAGIC[i]) throw new Error(`Bad magic bytes — not a .spec file.`);
  }
  const flags = readU16BE(buf, 6);
  return {
    dictVersion: readU16BE(buf, 4),
    flags,
    origLength:  readU32BE(buf, 8),
    languageId:  readU16BE(buf, 12),
    checksum:    readU16BE(buf, 14),
    rleEnabled:  !!(flags & FLAG_RLE),
  };
}

// ── zlib decompress (browser-native DecompressionStream) ─────────────────────
async function zlibDecompress(bytes) {
  const ds     = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// ── v6 token stream → source text (uint16 LE) ────────────────────────────────
function idsToSourceV6(ids) {
  const base   = SPEC_ID_ASCII_BASE_V6;
  const tokens = SPEC_TOKENS_V6;
  const parts  = [];
  let lastTok  = null;
  let i        = 0;

  while (i < ids.length) {
    const v = ids[i];

    if (v === SPEC_ID_RLE_V6) {
      const n = ids[i + 1];
      if (lastTok !== null) for (let k = 0; k < n; k++) parts.push(lastTok);
      i += 2; continue;
    }

    if (v === SPEC_ID_UNICODE_V6) {
      if (i + 2 >= ids.length) throw new Error(`Unicode escape at pos ${i} is truncated.`);
      // Use multiplication to avoid signed 32-bit overflow from << 16
      const cp  = ids[i + 1] * 65536 + ids[i + 2];
      const tok = (cp <= 0x10FFFF) ? String.fromCodePoint(cp) : '\uFFFD';
      parts.push(tok); lastTok = tok; i += 3; continue;
    }

    if (v >= base && v < base + 128) {
      const tok = String.fromCharCode(v - base);
      parts.push(tok); lastTok = tok; i++; continue;
    }

    const tok = tokens[v];
    if (tok === undefined) throw new Error(`Unknown v6 token ID ${v} at pos ${i}`);
    parts.push(tok); lastTok = tok; i++;
  }
  return parts.join('');
}

// ── v7 token stream → parts array (uint32 LE) ────────────────────────────────
// Returns an Array<string> of raw token strings (control tokens included).
// Callers decide whether to join() directly or pass through reconstructText().
function idsToPartsV7(ids, dictVersion) {
  const base   = ASCII_BASE_BY_DICT_VERSION[dictVersion];
  const tokens = _v7Tokens;
  const parts  = [];
  let lastTok  = null;
  let i        = 0;

  while (i < ids.length) {
    const v = ids[i];

    // RLE: 0xFFFFFFFD followed by uint32 repeat count
    if (v === SPEC_ID_RLE_V7) {
      const n = ids[i + 1];
      if (lastTok !== null) for (let k = 0; k < n; k++) parts.push(lastTok);
      i += 2; continue;
    }

    // Unicode fallback: 0xFFFFFFFE followed by uint32 code point
    if (v === SPEC_ID_UNICODE_V7) {
      if (i + 1 >= ids.length) throw new Error(`Unicode escape at pos ${i} is truncated.`);
      const cp  = ids[i + 1];
      const tok = (cp <= 0x10FFFF) ? String.fromCodePoint(cp) : '\uFFFD';
      parts.push(tok); lastTok = tok; i += 2; continue;
    }

    // ASCII fallback: base + char code (0–127)
    if (v >= base && v < base + 128) {
      const tok = String.fromCharCode(v - base);
      parts.push(tok); lastTok = tok; i++; continue;
    }

    // Dictionary token
    const tok = tokens[v];
    if (tok === undefined || v >= base) {
      throw new Error(`Unknown v${dictVersion} token ID ${v} at pos ${i} (ascii base ${base})`);
    }
    parts.push(tok); lastTok = tok; i++;
  }
  return parts;
}

// ── Plain-text reconstruction — mirrors text_tokenizer.reconstruct_text() ────
// Interprets CTRL:* control tokens and reassembles the original cased text.
function _applyCap(word, capMode) {
  if (!word || !capMode) return word;
  if (capMode === 'first') return word[0].toUpperCase() + word.slice(1);
  if (capMode === 'all')   return word.toUpperCase();
  return word;
}

function reconstructText(parts) {
  const result   = [];
  let capMode    = null;   // null | 'first' | 'all'
  let spelling   = [];
  let inSpelled  = false;

  for (const tok of parts) {
    // ── Control tokens ─────────────────────────────────────────────────────
    if (tok === 'CTRL:CAP_FIRST')  { capMode = 'first'; continue; }
    if (tok === 'CTRL:CAP_ALL')    { capMode = 'all';   continue; }
    if (tok === 'CTRL:NUM_SEP')    { continue; }   // boundary only; no output

    if (tok === 'CTRL:BEGIN_WORD') {
      inSpelled = true;
      spelling  = [];
      continue;
    }
    if (tok === 'CTRL:END_WORD') {
      result.push(_applyCap(spelling.join(''), capMode));
      capMode   = null;
      inSpelled = false;
      spelling  = [];
      continue;
    }

    // ── Inside a spelled-out word ───────────────────────────────────────────
    if (inSpelled) { spelling.push(tok); continue; }

    // ── All other tokens (words, whitespace, punctuation, digits) ──────────
    result.push(_applyCap(tok, capMode));
    capMode = null;
  }
  return result.join('');
}

// ── Top-level decode ──────────────────────────────────────────────────────────
export async function decodeSpec(arrayBuffer) {
  const buf  = new Uint8Array(arrayBuffer);
  const meta = parseHeader(buf);

  const dictVersion = meta.dictVersion;
  if (dictVersion !== 6 && !(dictVersion in ASCII_BASE_BY_DICT_VERSION)) {
    throw new Error(`Unsupported dict version ${dictVersion}. Supported versions: v6-v${CURRENT_DICT_VERSION}.`);
  }

  // Load append-only v7+ token list if needed
  if (dictVersion !== 6) await loadV7Tokens();

  const rawStream = await zlibDecompress(buf.slice(HEADER_SIZE));

  let ids, tokenCount;
  if (dictVersion === 6) {
    // uint16 LE
    tokenCount = Math.floor(rawStream.length / 2);
    const dv   = new DataView(rawStream.buffer, rawStream.byteOffset, rawStream.byteLength);
    ids = new Array(tokenCount);
    for (let i = 0; i < tokenCount; i++) ids[i] = dv.getUint16(i * 2, true);
  } else {
    // uint32 LE (v7+)
    tokenCount = Math.floor(rawStream.length / 4);
    const dv   = new DataView(rawStream.buffer, rawStream.byteOffset, rawStream.byteLength);
    ids = new Array(tokenCount);
    for (let i = 0; i < tokenCount; i++) ids[i] = dv.getUint32(i * 4, true);
  }

  let source;
  if (dictVersion === 6) {
    source = idsToSourceV6(ids);
  } else {
    const parts = idsToPartsV7(ids, dictVersion);
    // Language 4 = text, 9 = XML/Wiki. Both use text control tokens.
    source = (meta.languageId === 4 || meta.languageId === 9)
      ? reconstructText(parts)
      : parts.join('');
  }

  // Truncate to original byte length
  const enc      = new TextEncoder();
  const srcBytes = enc.encode(source);
  if (srcBytes.length > meta.origLength) {
    source = new TextDecoder('utf-8', { fatal: false }).decode(
      srcBytes.slice(0, meta.origLength)
    );
  }

  // Verify checksum
  const actualBytes = enc.encode(source);
  let sum = 0;
  for (const b of actualBytes) sum = (sum + b) & 0xFFFF;

  return { source, meta, checksumOk: sum === meta.checksum, tokenCount };
}
