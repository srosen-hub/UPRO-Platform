// File reading (PDF, Word, Excel/CSV, text, images), library chunking and retrieval.

if (window.pdfjsLib) {
  // The page cannot start a worker from a CDN, so pdf.js runs on the main thread using the worker
  // script loaded as a normal <script> tag (it registers window.pdfjsWorker).
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:application/javascript,';
}

function extOf(name) { return (name.split('.').pop() || '').toLowerCase(); }
const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

function bufToDataUrl(buf, mime) {
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(new Blob([buf], { type: mime })); });
}

async function readAny(file) {
  const ext = extOf(file.name);
  const buf = await file.arrayBuffer();
  if (IMG_EXT.includes(ext)) {
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : 'image/' + ext;
    return { kind: 'image', ext, buf, dataUrl: await bufToDataUrl(buf, mime) };
  }
  if (ext === 'pdf') return Object.assign({ kind: 'pdf', ext, buf }, await readPdf(buf));
  if (ext === 'docx') return Object.assign({ kind: 'docx', ext, buf }, await readDocx(buf));
  if (['xlsx', 'xls', 'csv'].includes(ext)) return Object.assign({ kind: 'sheet', ext, buf }, readSheet(buf, ext));
  if (['txt', 'md', 'markdown', 'html', 'htm'].includes(ext)) {
    let text = new TextDecoder().decode(buf);
    if (ext.startsWith('htm')) { const d = new DOMParser().parseFromString(text, 'text/html'); text = d.body.innerText || d.body.textContent; }
    return { kind: 'text', ext, buf, text, pages: [{ n: 1, text }] };
  }
  throw new Error(`${file.name}: this file type is not supported. Use PDF, DOCX, XLSX, CSV, TXT, MD or an image.`);
}

async function readPdf(buf) {
  if (!window.pdfjsLib) throw new Error('The PDF reader did not load. Reload the page and try again.');
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const tc = await pg.getTextContent();
    let out = '', lastY = null;
    for (const it of tc.items) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += '\n';
      else if (out && !out.endsWith(' ') && !out.endsWith('\n')) out += ' ';
      out += it.str;
      if (it.hasEOL) out += '\n';
      lastY = y;
    }
    pages.push({ n: i, text: out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() });
  }
  return { pages, text: pages.map(p => `[[PAGE ${p.n}]]\n${p.text}`).join('\n\n') };
}

async function readDocx(buf) {
  if (!window.mammoth) throw new Error('The Word reader did not load. Reload the page and try again.');
  const res = await mammoth.convertToHtml({ arrayBuffer: buf.slice(0) });
  const d = new DOMParser().parseFromString('<div>' + res.value + '</div>', 'text/html');
  const images = $$('img', d).map((img, i) => ({ dataUrl: img.getAttribute('src'), alt: img.getAttribute('alt') || '', idx: i }))
    .filter(x => x.dataUrl && x.dataUrl.startsWith('data:image'));
  // Note the nearest preceding heading for each image so it can carry a caption and a location.
  let heading = '';
  const imgHeading = [];
  d.body.firstChild.querySelectorAll('h1,h2,h3,h4,img').forEach(el => { if (el.tagName === 'IMG') imgHeading.push(heading); else heading = el.textContent.trim(); });
  images.forEach((im, i) => { im.heading = imgHeading[i] || ''; });
  const parts = [];
  d.body.firstChild.querySelectorAll('h1,h2,h3,h4,h5,p,li,table').forEach(el => {
    if (el.tagName === 'TABLE') { parts.push($$('tr', el).map(tr => $$('td,th', tr).map(c => c.textContent.trim()).join(' | ')).join('\n')); return; }
    if (el.closest('table')) return;
    const t = el.textContent.trim();
    if (!t) return;
    if (/^H\d/.test(el.tagName)) parts.push('#'.repeat(+el.tagName[1]) + ' ' + t);
    else if (el.tagName === 'LI') parts.push('- ' + t);
    else parts.push(t);
  });
  const text = parts.join('\n\n');
  return { text, pages: [{ n: 1, text }], images, html: res.value };
}

function readSheet(buf, ext) {
  if (!window.XLSX) throw new Error('The spreadsheet reader did not load. Reload the page and try again.');
  const wb = ext === 'csv' ? XLSX.read(new TextDecoder().decode(buf), { type: 'string' }) : XLSX.read(new Uint8Array(buf), { type: 'array' });
  const sheets = [], lines = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: '' });
    sheets.push({ name, rows });
    const header = rows[0] || [];
    rows.forEach((r, i) => {
      if (!r.some(c => String(c).trim())) return;
      const cells = r.map((c, j) => (i > 0 && header[j] ? header[j] + ': ' : '') + String(c).trim()).filter(c => !/:\s*$/.test(c) && c);
      lines.push(`[[ROW ${name}:${i + 1}]] ${cells.join(' | ')}`);
    });
  }
  const text = lines.join('\n');
  return { text, pages: [{ n: 1, text }], sheets };
}

/* Split text into chunks of about `size` characters on paragraph or row boundaries. */
function chunkText(text, size = 24000) {
  const out = [];
  let cur = '';
  for (const para of text.split(/\n(?=\[\[(?:PAGE|ROW) )|\n{2,}/)) {
    if (cur.length + para.length > size && cur) { out.push(cur); cur = ''; }
    if (para.length > size) { for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size)); continue; }
    cur += (cur ? '\n\n' : '') + para;
  }
  if (cur) out.push(cur);
  return out;
}

/* Library blocks: Word and Markdown split on headings, PDFs on pages and paragraphs, spreadsheets one row per block. */
function splitLibrary(f, parsed) {
  const blocks = [];
  const add = (title, text, loc) => {
    text = text.trim();
    if (text.length < 40) return;
    blocks.push({ id: nextBlockId(), title: title.slice(0, 120) || f.name, text, fileId: f.id, fileName: f.name, loc, tags: [], summary: '', tier: f.tier || 'approved', origin: 'upload' });
  };
  if (parsed.kind === 'sheet') {
    for (const sh of parsed.sheets) {
      const header = sh.rows[0] || [];
      sh.rows.slice(1).forEach((r, i) => {
        const cells = r.map((c, j) => [header[j], String(c).trim()]).filter(([, v]) => v);
        if (!cells.length) return;
        add(String(cells[0][1]).slice(0, 100), cells.map(([h, v]) => (h ? h + ': ' : '') + v).join('\n'), `${sh.name} row ${i + 2}`);
      });
    }
    return blocks;
  }
  if (parsed.kind === 'pdf') {
    for (const pg of parsed.pages) {
      let buf = '', title = '';
      const flush = () => { if (buf) add(title || `${f.name} p.${pg.n}`, buf, 'p. ' + pg.n); buf = ''; title = ''; };
      for (const para of pg.text.split(/\n{2,}/)) {
        const first = para.split('\n')[0].trim();
        const looksHeading = first.length < 80 && para.split('\n').length > 1 && !/[.:,;]$/.test(first);
        if (buf.length > 1400 || (looksHeading && buf.length > 300)) flush();
        if (!buf && looksHeading) title = first;
        buf += (buf ? '\n\n' : '') + para;
      }
      flush();
    }
    return blocks;
  }
  // Heading-based split for docx, md and txt.
  const path = [];
  let title = '', buf = '';
  const flush = () => { if (buf.trim()) add(title || f.name, buf, path.join(' › ') || 'Start'); buf = ''; };
  for (const line of parsed.text.split('\n')) {
    const m = line.match(/^(#{1,4})\s+(.*)/);
    if (m) {
      flush();
      const lvl = m[1].length;
      path.length = lvl - 1; path[lvl - 1] = m[2].trim();
      title = m[2].trim();
    } else buf += line + '\n';
    if (buf.length > 3500) flush();
  }
  flush();
  return blocks;
}

/* Retrieval: tag filter first, then a BM25-style text score over block title and text. */
const STOP = new Set('the a an and or of to in for on with by be is are as at from that this it its will shall must should may can vendor proposer proposal respondent provide describe include including any all each their your our'.split(' '));
function tokens(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)); }
let idxCache = null;
function allBlocks() { return S.project.library.concat(WS.pinnedBlocks || []); }
function idxKey() { const lib = allBlocks(); return lib.length + ':' + lib.map(b => b.tags.length + (b.tier || '')[0]).join(''); }
function buildIndex() {
  const lib = allBlocks();
  const df = new Map(), docs = [];
  for (const b of lib) {
    const tf = new Map();
    for (const w of tokens(b.title + ' ' + b.title + ' ' + b.text + ' ' + (b.tags || []).join(' '))) tf.set(w, (tf.get(w) || 0) + 1);
    let len = 0; tf.forEach(v => len += v);
    docs.push({ b, tf, len });
    tf.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1));
  }
  const avg = docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1);
  idxCache = { df, docs, avg, n: docs.length, key: idxKey() };
  return idxCache;
}
function retrieve(query, { k = 8, tags = [] } = {}) {
  const lib = allBlocks();
  if (!lib.length) return [];
  const key = idxKey();
  const fresh = Date.now() - (WS.data.sources.glean.recencyMonths || 18) * 30 * 864e5;
  const ix = idxCache && idxCache.key === key ? idxCache : buildIndex();
  const q = [...new Set(tokens(query))];
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  const scored = ix.docs.map(d => {
    let s = 0;
    for (const w of q) {
      const f = d.tf.get(w); if (!f) continue;
      const idf = Math.log(1 + (ix.n - ix.df.get(w) + .5) / (ix.df.get(w) + .5));
      s += idf * (f * 2.2) / (f + 1.2 * (.25 + .75 * d.len / ix.avg));
    }
    const tagHits = (d.b.tags || []).filter(t => tagSet.has(t.toLowerCase()) || q.includes(t.toLowerCase())).length;
    if (s <= 0 && !tagHits) return { b: d.b, s: 0, tagHits };
    // Trust and freshness: approved and product sources rank higher, stale ones lower, discussions lowest.
    const tier = TIERS[d.b.tier || 'approved'] || TIERS.reference;
    const age = d.b.updated ? (Date.parse(d.b.updated) >= fresh ? 0.6 : -0.6) : 0;
    return { b: d.b, s: s + tagHits * 1.5 + tier.rank * 0.35 + age, tagHits };
  });
  // Tag filter first: when enough blocks share a tag with the query, rank only those.
  const tagged = scored.filter(x => x.tagHits > 0);
  const pool = tagged.length >= Math.min(k, 4) ? tagged : scored;
  return pool.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.b);
}
function retrieveImages(query, k = 6) {
  const q = new Set(tokens(query));
  return S.project.assets.map(a => {
    const words = tokens((a.caption || '') + ' ' + a.name + ' ' + (a.tags || []).join(' '));
    return { a, s: words.filter(w => q.has(w)).length };
  }).filter(x => x.s > 0).sort((x, y) => y.s - x.s).slice(0, k).map(x => x.a);
}
function sectionQuery(sec) {
  return [sec.title, sec.guidance, ...sec.reqIds.map(id => (reqById(id) || {}).text || ''), ...sec.keyPoints].join(' ');
}
