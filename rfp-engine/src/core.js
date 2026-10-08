// Core helpers, project model, numbering, coverage and persistence.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + '-' + Math.random().toString(36).slice(2, 8);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

const STEPS = [
  { id: 'inputs', n: 1, label: 'Inputs', group: 'Formatting' },
  { id: 'requirements', n: 2, label: 'Requirements', group: 'Formatting' },
  { id: 'format', n: 3, label: 'Format', group: 'Formatting' },
  { id: 'outline', n: 4, label: 'Outline', group: 'Drafting' },
  { id: 'draft', n: 5, label: 'Draft', group: 'Drafting' },
  { id: 'canvas', n: 6, label: 'Canvas', group: 'Layout' },
  { id: 'export', n: 7, label: 'Export', group: 'Layout' },
];

const REQ_TYPES = ['instruction', 'format', 'submission', 'technical', 'functional', 'commercial', 'legal', 'evaluation'];
const RESP_TYPES = ['narrative', 'table', 'yes/no', 'form', 'attachment', 'compliance-matrix'];
const MODES = ['verbatim', 'tailored', 'synthesized'];

const S = {
  project: null,
  ui: {
    step: 'inputs', view: 'working', reqFilter: 'all', reqQuery: '', libTab: 'text',
    focusBlock: null, drawer: null, modal: null, assetsOpen: false, selSection: null,
  },
};

function newProject(name) {
  return {
    v: 1, id: uid('p'), name: name || 'Untitled RFP', example: false,
    context: { client: '', bidding: '', notes: '', winThemes: '' },
    files: [], assets: [], library: [], requirements: [], objectives: [], topics: [],
    formatRules: {}, formatBasis: '', basisNote: '',
    sections: [], pending: null, changeLog: [], risks: [], matrix: [],
    reqSeq: 0, blockSeq: 0,
  };
}

/* Section numbering: level 1 gets 1, 2, 3; level 2 gets 1.1, 1.2. RFP-mandated numbers win when present. */
function numberSections(p = S.project) {
  let a = 0, b = 0;
  for (const s of p.sections) {
    if (s.level === 2) { b++; s.num = s.fixedNum || (a + '.' + b); }
    else { a++; b = 0; s.num = s.fixedNum || String(a); }
  }
}
const secById = id => S.project.sections.find(s => s.id === id);
const reqById = id => S.project.requirements.find(r => r.id === id);
const blockById = id => S.project.library.find(b => b.id === id);
const assetById = id => S.project.assets.find(a => a.id === id);
const fileById = id => S.project.files.find(f => f.id === id);

function newSection(o = {}) {
  return {
    id: uid('s'), title: o.title || 'New section', level: o.level === 2 ? 2 : 1, origin: o.origin || 'user',
    reqIds: o.reqIds || [], pageLimit: o.pageLimit || null, guidance: o.guidance || '', summarizes: !!o.summarizes,
    fixedNum: o.fixedNum || '', userEdited: o.origin === 'user',
    keyPoints: [], blockRefs: [], gaps: [], visuals: [], tables: [], blocks: [], status: 'empty', feedback: '',
  };
}

function newBlock(o) {
  return Object.assign({ id: uid('k'), type: 'text', html: '', width: 'full', sources: [], mode: 'manual', locked: false }, o);
}

/* Coverage: mandatory requirements mapped to a section (format), and cited by a drafted block (draft). */
function coverage(p = S.project) {
  // Layout, submission and scoring rules are met by the document itself, not by a section's answer.
  const mand = p.requirements.filter(r => r.mandatory && !['instruction', 'format', 'submission', 'evaluation'].includes(r.type));
  const mapped = new Set(p.sections.flatMap(s => s.reqIds));
  const cited = new Set();
  for (const s of p.sections) for (const b of s.blocks) for (const src of b.sources || []) if (src.t === 'req') cited.add(src.id);
  for (const s of p.sections) if (s.status === 'drafted') for (const id of s.reqIds) cited.add(id);
  return {
    total: mand.length,
    mapped: mand.filter(r => mapped.has(r.id)).length,
    addressed: mand.filter(r => cited.has(r.id)).length,
    unmapped: mand.filter(r => !mapped.has(r.id)),
  };
}

function reqSections(reqId) {
  return S.project.sections.filter(s => s.reqIds.includes(reqId));
}

function logChange(source, text) {
  S.project.changeLog.unshift({ ts: Date.now(), source, text });
  S.project.changeLog = S.project.changeLog.slice(0, 200);
}

function markUserEdit(sec, text) {
  if (sec) sec.userEdited = true;
  logChange('user', text);
}

function nextReqId() { S.project.reqSeq++; return 'R-' + String(S.project.reqSeq).padStart(3, '0'); }
function nextBlockId() { S.project.blockSeq++; return 'B-' + String(S.project.blockSeq).padStart(3, '0'); }

/* Word budget from page limits: about 450 words per page of narrative after headings and visuals. */
function wordBudget(sec) {
  if (sec.pageLimit) return Math.round(sec.pageLimit * 450);
  return sec.level === 2 ? 350 : 500;
}

/* HTML sanitizer for model-written and pasted text. Keeps a small set of inline and list tags. */
const ALLOWED = new Set(['P', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'H4', 'SPAN']);
function sanitize(html) {
  const doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
  const walk = node => {
    for (const c of Array.from(node.childNodes)) {
      if (c.nodeType === 1) {
        if (!ALLOWED.has(c.tagName)) {
          walk(c);
          while (c.firstChild) node.insertBefore(c.firstChild, c);
          c.remove();
          continue;
        }
        for (const a of Array.from(c.attributes)) if (!(c.tagName === 'SPAN' && a.name === 'class' && a.value === 'gapmark')) c.removeAttribute(a.name);
        walk(c);
      } else if (c.nodeType !== 3) c.remove();
    }
  };
  const root = doc.body.firstChild;
  walk(root);
  return markGaps(root.innerHTML);
}
function markGaps(html) {
  return html.replace(/(?<!gapmark">)\[(NEEDS (?:INPUT|VISUAL)[^\]]*)\]/g, '<span class="gapmark">[$1]</span>');
}
function textToHtml(t) {
  return String(t || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => /^[-•*]\s/m.test(p)
      ? '<ul>' + p.split(/\n/).map(l => '<li>' + esc(l.replace(/^[-•*]\s*/, '')) + '</li>').join('') + '</ul>'
      : '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
}
function htmlToText(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('li').forEach(li => li.prepend('- '));
  d.querySelectorAll('p,li,h4,br').forEach(el => el.append('\n'));
  return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

/* Persistence: the open project autosaves to this browser (IndexedDB). Project files are the portable copy. */
const DB_NAME = 'rfp-engine', STORE = 'kv';
function idb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  } catch { return null; }
}
async function idbSet(key, val) {
  try {
    const db = await idb();
    await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
    return true;
  } catch { return false; }
}
let saveTimer = null, lastSaved = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (await idbSet('project', JSON.stringify(S.project))) { lastSaved = Date.now(); const el = $('#saved'); if (el) el.textContent = 'Saved in this browser'; }
  }, 500);
}
/* Original file bytes are kept separately so a PDF source can be shown at its page. */
const fileBytes = new Map();
async function keepBytes(fileId, buf) { fileBytes.set(fileId, buf); await idbSet('bytes:' + fileId, buf); }
async function getBytes(fileId) {
  if (fileBytes.has(fileId)) return fileBytes.get(fileId);
  const b = await idbGet('bytes:' + fileId);
  if (b) fileBytes.set(fileId, b);
  return b;
}

/* Toasts and a simple progress status */
let toastTimer = null;
function toast(msg, opts = {}) {
  clearTimeout(toastTimer);
  const root = $('#toast-root');
  root.innerHTML = msg ? `<div class="toast ${opts.err ? 'err' : ''}" role="status"><span>${esc(msg)}</span>${opts.cancel ? '<button data-act="cancel-ai">Stop</button>' : ''}</div>` : '';
  if (msg && !opts.sticky) toastTimer = setTimeout(() => { root.innerHTML = ''; }, opts.err ? 7000 : 3200);
}

const ICON = {
  grip: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6l4 4 4-4"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  indent: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h10M7 8h6M3 13h10M3 6l2 2-2 2"/></svg>',
  outdent: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h10M7 8h6M3 13h10M5 6L3 8l2 2"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M3 8h10"/></svg>',
  merge: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 3v3a2 2 0 002 2h4a2 2 0 012 2v3M12 3v3a2 2 0 01-2 2"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>',
  half: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="5" height="10" rx="1"/><rect x="9" y="3" width="5" height="10" rx="1"/></svg>',
  full: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="10" rx="1"/></svg>',
  text: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h10M3 8h10M3 12h6"/></svg>',
  image: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 11l3.5-3.5 3 3 2-2L14 12"/><circle cx="11" cy="6" r="1"/></svg>',
  table: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 7h12M2 10h12M6 3v10"/></svg>',
  callout: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h10v7H7l-3 3v-3H3z"/></svg>',
  spark: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"/></svg>',
  logo: '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.7"><path d="M4 2h6l3 3v9H4z"/><path d="M6.5 8.5l1.5 1.5 3-3"/></svg>',
};
