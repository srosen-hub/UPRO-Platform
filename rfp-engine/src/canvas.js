// Canvas: outline column, paper pages with draggable blocks, and an asset column.

function viewCanvas() {
  const p = S.project;
  numberSections();
  if (!p.sections.length) return `<div style="padding:24px"><div class="panel empty"><h3>Set the format first</h3><p>The canvas lays out the drafted sections as pages.</p></div></div>`;
  const customer = S.ui.view === 'customer';
  const rules = p.formatRules || {};
  const font = rules.fontFamily ? `font-family:"${esc(String(rules.fontFamily).replace(/"/g, ''))}", var(--f-doc);` : '';
  const size = rules.fontSize && /^\d+(\.\d+)?/.test(rules.fontSize) ? `font-size:${parseFloat(rules.fontSize)}pt;` : '';
  let fig = 0, tab = 0;
  const secHtml = p.sections.map(s => {
    const blocks = s.blocks.map((b, i) => {
      let n = '';
      if (b.type === 'image') n = 'Figure ' + (++fig);
      if (b.type === 'table') n = 'Table ' + (++tab);
      return blockHtml(s, b, i, n);
    }).join('');
    return `<section class="d-sec ${s.level === 2 ? 'l2' : ''}" id="ds-${s.id}" data-dsec="${s.id}">
      <div class="d-sec-h"><h2>${esc(s.num)}&nbsp;&nbsp;${esc(s.title)}</h2>${s.pageLimit ? `<span class="d-sec-pg" data-pg="${s.id}"></span>` : '<span class="d-sec-pg" data-pg="' + s.id + '"></span>'}</div>
      <div class="d-body" data-dbody="${s.id}">${blocks || `<div class="d-empty" data-dropempty="${s.id}">Drop text, images or tables here${s.status !== 'drafted' ? ', or draft this section first' : ''}</div>`}
        <div class="insert-row"><button class="btn sm ghost" data-act="ins" data-type="text" data-id="${s.id}">${ICON.text} Text</button><button class="btn sm ghost" data-act="ins" data-type="callout" data-id="${s.id}">${ICON.callout} Callout</button><button class="btn sm ghost" data-act="ins" data-type="table" data-id="${s.id}">${ICON.table} Table</button><button class="btn sm ghost" data-act="ins" data-type="image" data-id="${s.id}">${ICON.image} Visual</button></div>
      </div></section>`;
  }).join('');
  return `<div class="cv ${S.ui.assetsOpen ? 'assets-open' : ''}">
    <aside class="cv-col cv-left"><div class="cv-col-h"><h3>Sections</h3><span class="hint" id="cv-total"></span></div>
      <div id="mini">${p.sections.map(s => `<div class="mini-sec ${s.level === 2 ? 'l2' : ''}" data-act="jump" data-id="${s.id}" draggable="true" data-msec="${s.id}"><span class="mono faint">${esc(s.num)}</span><span>${esc(s.title)}</span><span class="pg" data-mpg="${s.id}"></span></div>`).join('')}</div></aside>
    <div class="cv-mid" id="cv-mid">
      <div class="cv-tools">
        <div class="toggle" role="group" aria-label="View"><button class="${!customer ? 'on' : ''}" data-act="view" data-v="working">Working view</button><button class="${customer ? 'on' : ''}" data-act="view" data-v="customer">Customer view</button></div>
        <span class="hint">${customer ? 'What the customer sees. Sources and tools are hidden.' : 'Drag blocks by the handle. Click a source chip to see where text came from.'}</span>
        <span class="bar-spacer"></span>
        <button class="btn sm" data-act="toggle-assets">${ICON.image} Assets</button>
      </div>
      <div class="paper-wrap"><div class="paper ${customer ? 'customer' : ''}" id="paper" style="${font}${size}">${secHtml}</div></div>
    </div>
    <aside class="cv-col cv-right">${assetColumn()}</aside>
  </div>`;
}

function blockHtml(s, b, i, label) {
  const bar = `<div class="blk-bar"><button class="drag" draggable="true" data-dragblk="${s.id}:${b.id}" title="Drag" aria-label="Drag">${ICON.grip}</button>
    <button data-act="blk-up" data-s="${s.id}" data-b="${b.id}" title="Move up" aria-label="Move up">${ICON.up}</button>
    <button data-act="blk-down" data-s="${s.id}" data-b="${b.id}" title="Move down" aria-label="Move down">${ICON.down}</button>
    <button data-act="blk-width" data-s="${s.id}" data-b="${b.id}" title="${b.width === 'half' ? 'Full width' : 'Half width'}" aria-label="Toggle width">${b.width === 'half' ? ICON.full : ICON.half}</button>
    <button data-act="blk-lock" data-s="${s.id}" data-b="${b.id}" title="${b.locked ? 'Unlock' : 'Lock (keeps it through redrafts)'}" aria-label="Lock">${ICON.lock}</button>
    ${b.type === 'table' ? `<button data-act="tbl-row" data-s="${s.id}" data-b="${b.id}" title="Add row">+row</button><button data-act="tbl-col" data-s="${s.id}" data-b="${b.id}" title="Add column">+col</button>` : ''}
    ${b.type === 'image' ? `<button data-act="pick-img" data-s="${s.id}" data-b="${b.id}" title="Choose image">img</button>` : ''}
    <button data-act="blk-rm" data-s="${s.id}" data-b="${b.id}" title="Delete" aria-label="Delete">${ICON.x}</button></div>`;
  const srcs = `<div class="src-row"><span class="src-mode">${b.mode}</span>${(b.sources || []).map(srcChip).join('')}</div>`;
  let inner = '';
  if (b.type === 'text') inner = `<div class="blk-text" contenteditable="true" data-edit="${s.id}:${b.id}">${b.html}</div>`;
  else if (b.type === 'callout') inner = `<div class="blk-callout blk-text" contenteditable="true" data-edit="${s.id}:${b.id}">${b.html}</div>`;
  else if (b.type === 'image') {
    const a = assetById(b.assetId);
    inner = `<figure class="blk-fig" style="margin:0">${a ? `<img src="${a.dataUrl || a.thumb}" alt="${esc(b.caption || a.caption || '')}" data-act="src" data-t="asset" data-id="${a.id}">${a.stale ? '<div class="d-sec-flag">No longer in the Figma library</div>' : ''}${a.source === 'figma' && !a.dataUrl ? '<div class="d-sec-flag" style="background:#e2edf6;color:#1d5c8c">Thumbnail. Full image is pulled at export.</div>' : ''}` : `<div class="ph" data-act="pick-img" data-s="${s.id}" data-b="${b.id}">[NEEDS VISUAL: ${esc(b.need || b.caption || 'choose an image')}]<br><span style="font-weight:400">Drop an image here or click to choose</span></div>`}
      <figcaption class="cap"><b>${label}:</b> <span contenteditable="true" data-cap="${s.id}:${b.id}">${esc(b.caption || (a && (a.caption || a.name)) || '')}</span></figcaption></figure>`;
  } else if (b.type === 'table') {
    const rows = b.rows || [['']];
    inner = `<div class="cap" style="margin:0 0 4px"><b>${label}:</b> <span contenteditable="true" data-cap="${s.id}:${b.id}">${esc(b.caption || '')}</span></div>
      <div class="blk-tbl"><table>${rows.map((r, ri) => `<tr>${r.map((c, ci) => `<${ri ? 'td' : 'th'} contenteditable="true" data-cell="${s.id}:${b.id}:${ri}:${ci}">${markGaps(esc(c))}</${ri ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></div>`;
  }
  return `<div class="blk ${b.width === 'half' ? 'half' : ''} ${b.locked ? 'locked' : ''}" data-blk="${s.id}:${b.id}">${bar}${inner}${srcs}</div>`;
}

function assetColumn() {
  const p = S.project;
  const tab = S.ui.libTab;
  const q = (S.ui.assetQuery || '').toLowerCase();
  let list = '';
  if (tab === 'images') {
    const figs = p.assets.filter(a => a.source === 'figma' && !a.stale && (!q || (a.name + a.caption).toLowerCase().includes(q)));
    const ups = p.assets.filter(a => a.source !== 'figma' && (!q || (a.name + a.caption).toLowerCase().includes(q)));
    list = `<div class="cv-col-h" style="position:static"><h3>Product (Figma)</h3>${FIG.state === 'on' && p.figma && p.figma.url ? '<button class="btn sm ghost" data-act="fig-sync">Sync</button>' : ''}</div>
      ${figs.map(assetRow).join('') || '<p class="hint" style="padding:8px 12px">Link a Figma library on the Inputs step.</p>'}
      <div class="cv-col-h" style="position:static"><h3>Other images</h3><button class="btn sm ghost" data-act="upload-img">Upload</button></div>
      ${ups.map(assetRow).join('') || '<p class="hint" style="padding:8px 12px">Photos, maps, org charts. Not for product visuals.</p>'}`;
  } else if (tab === 'text') {
    const items = (q ? p.library.filter(b => (b.title + b.text + b.tags.join(' ')).toLowerCase().includes(q)) : p.library).slice(0, 120);
    list = items.map(b => `<div class="asset" draggable="true" data-dragasset="lib:${b.id}"><span class="a-ic">${ICON.text}</span><span class="asset-t"><b>${esc(b.title)}</b><span>${b.id} · ${esc(b.tags.slice(0, 3).join(', '))}</span></span></div>`).join('') || '<p class="hint" style="padding:8px 12px">No library blocks.</p>';
  } else {
    list = [['compliance', 'Compliance matrix', 'From the requirements list'], ['timeline', 'Implementation timeline', 'Phases and durations'], ['team', 'Project team', 'Roles and names'], ['custom', 'Blank table', '2 columns'], ['callout', 'Callout', 'Key stat or proof point'], ['text', 'Text block', 'Empty paragraph']]
      .map(([k, t, d]) => `<div class="asset" draggable="true" data-dragasset="new:${k}"><span class="a-ic">${k === 'callout' ? ICON.callout : k === 'text' ? ICON.text : ICON.table}</span><span class="asset-t"><b>${t}</b><span>${d}</span></span></div>`).join('');
  }
  return `<div class="cv-col-h"><h3>Assets</h3><button class="icon-btn" data-act="toggle-assets" aria-label="Close assets">${ICON.x}</button></div>
    <div class="asset-tabs">${[['text', 'Text'], ['images', 'Images'], ['tables', 'Tables']].map(([k, l]) => `<button class="btn sm ${tab === k ? 'primary' : 'ghost'}" data-act="lib-tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${tab !== 'tables' ? `<div style="padding:8px 12px"><input class="input" id="asset-q" placeholder="Search" value="${esc(S.ui.assetQuery || '')}"></div>` : ''}
    <div>${list}</div>`;
}
function assetRow(a) {
  return `<div class="asset" draggable="true" data-dragasset="img:${a.id}" data-act="src" data-t="asset" data-id="${a.id}"><img src="${a.thumb || a.dataUrl || ''}" alt=""><span class="asset-t"><b>${esc(a.caption || a.name)}</b><span>${a.source === 'figma' ? 'Figma' : a.source === 'example' ? 'Example' : 'Upload'}${(a.tags || []).length ? ' · ' + esc(a.tags.slice(0, 2).join(', ')) : ''}</span></span></div>`;
}

/* Page measurement: 8.5 x 11 in page, 1 in margins, so the text area is 6.5 x 9 in. */
function measurePages() {
  const paper = $('#paper');
  if (!paper) return;
  const cs = getComputedStyle(paper);
  const contentW = paper.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const pageH = contentW * (9 / 6.5);
  const top0 = parseFloat(cs.paddingTop);
  $$('.pbreak', paper).forEach(x => x.remove());
  const totalH = paper.scrollHeight - top0 - parseFloat(cs.paddingBottom);
  const pages = Math.max(1, Math.ceil(totalH / pageH));
  for (let i = 1; i < pages; i++) {
    const d = document.createElement('div');
    d.className = 'pbreak'; d.style.top = (top0 + i * pageH) + 'px';
    d.innerHTML = `<span>PAGE ${i + 1}</span>`;
    paper.appendChild(d);
  }
  let overall = 0;
  for (const s of S.project.sections) {
    const el = $('#ds-' + s.id);
    if (!el) continue;
    const n = Math.round((el.offsetHeight / pageH) * 10) / 10;
    s._pages = n; overall += n;
    const over = s.pageLimit && n > s.pageLimit + 0.05;
    const label = `${n.toFixed(1)}${s.pageLimit ? ' / ' + s.pageLimit : ''} pp`;
    const a = $(`[data-pg="${s.id}"]`); if (a) { a.textContent = label; a.style.color = over ? '#b3261e' : ''; }
    const m = $(`[data-mpg="${s.id}"]`); if (m) { m.textContent = label; m.parentElement.classList.toggle('over', !!over); }
  }
  const lim = parseFloat(S.project.formatRules.pageLimit);
  const t = $('#cv-total');
  if (t) { t.textContent = `${pages}${lim ? ' / ' + lim : ''} pages`; t.style.color = lim && pages > lim ? 'var(--crit)' : ''; }
}

/* Block operations */
function findBlock(key) {
  const [sid, bid] = key.split(':');
  const s = secById(sid);
  const i = s ? s.blocks.findIndex(b => b.id === bid) : -1;
  return { s, i, b: s && s.blocks[i] };
}
function moveBlock(fromKey, toSecId, toIndex) {
  const { s, i, b } = findBlock(fromKey);
  if (!b) return;
  s.blocks.splice(i, 1);
  const t = secById(toSecId);
  if (t === s && toIndex > i) toIndex--;
  t.blocks.splice(clamp(toIndex, 0, t.blocks.length), 0, b);
  if (t !== s) logChange('user', `Moved a ${b.type} block from ${s.num} to ${t.num}.`);
}
function blockFromAsset(spec) {
  const [kind, id] = spec.split(':');
  if (kind === 'lib') { const lb = blockById(id); return lb && newBlock({ type: 'text', html: textToHtml(lb.text), mode: 'verbatim', sources: [{ t: 'lib', id: lb.id }] }); }
  if (kind === 'img') { const a = assetById(id); return a && newBlock({ type: 'image', assetId: a.id, caption: a.caption || a.name }); }
  if (kind === 'new') {
    if (id === 'text') return newBlock({ type: 'text', html: '<p>New paragraph.</p>' });
    if (id === 'callout') return newBlock({ type: 'callout', html: '<p>[NEEDS INPUT: key stat or proof point]</p>' });
    return makeTable(id, null);
  }
  return null;
}
async function ensureFullImage(b) {
  const a = assetById(b.assetId);
  if (a && a.source === 'figma' && !a.dataUrl && FIG.mcp) {
    try { await fetchFigmaImage(a); save(); renderMain(); } catch (e) { toast(e.message, { err: true }); }
  }
}

/* Drag and drop: blocks between and within sections, assets onto the page, sections in the outline. */
let drag = null;
function dropTarget(e) {
  const blk = e.target.closest('.blk');
  if (blk) {
    const r = blk.getBoundingClientRect();
    const after = blk.classList.contains('half') ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    const { s, i } = findBlock(blk.dataset.blk);
    return { el: blk, secId: s.id, index: i + (after ? 1 : 0), after };
  }
  const body = e.target.closest('[data-dbody]');
  if (body) return { el: null, secId: body.dataset.dbody, index: secById(body.dataset.dbody).blocks.length };
  const sec = e.target.closest('[data-dsec]');
  if (sec) return { el: null, secId: sec.dataset.dsec, index: secById(sec.dataset.dsec).blocks.length };
  return null;
}
function clearDropMarks() { $$('.drop-before,.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after')); $$('.drag-over-before,.drag-over-after').forEach(x => x.classList.remove('drag-over-before', 'drag-over-after')); }

document.addEventListener('dragstart', e => {
  const h = e.target.closest && e.target.closest('[data-dragblk]');
  const a = e.target.closest && e.target.closest('[data-dragasset]');
  const sec = e.target.closest && e.target.closest('[data-sec],[data-msec]');
  if (h) { drag = { kind: 'blk', key: h.dataset.dragblk }; e.dataTransfer.setDragImage(h.closest('.blk'), 10, 10); }
  else if (a) drag = { kind: 'asset', spec: a.dataset.dragasset };
  else if (sec) drag = { kind: 'sec', id: sec.dataset.sec || sec.dataset.msec };
  else return;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', 'rfp'); } catch { }
});
document.addEventListener('dragover', e => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    const z = e.target.closest('[data-drop], .ph, [data-dbody]');
    if (z) { e.preventDefault(); if (z.dataset.drop) z.classList.add('over'); }
    return;
  }
  if (!drag) return;
  if (drag.kind === 'sec') {
    const row = e.target.closest('[data-sec],[data-msec]');
    if (!row) return;
    e.preventDefault(); clearDropMarks();
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY > r.top + r.height / 2 ? 'drag-over-after' : 'drag-over-before');
    return;
  }
  const t = dropTarget(e);
  if (!t) return;
  e.preventDefault(); clearDropMarks();
  if (t.el) t.el.classList.add(t.after ? 'drop-after' : 'drop-before');
});
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', async e => {
  // Files dropped on an upload zone or on a page.
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    const z = e.target.closest('[data-drop]');
    if (z) { e.preventDefault(); z.classList.remove('over'); await addFiles(Array.from(e.dataTransfer.files), z.dataset.drop); return; }
    const t = dropTarget(e);
    if (t && S.ui.step === 'canvas') {
      e.preventDefault();
      const imgs = Array.from(e.dataTransfer.files).filter(f => IMG_EXT.includes(extOf(f.name)));
      const before = S.project.assets.length;
      await addFiles(imgs, 'library');
      const added = S.project.assets.slice(before);
      const sec = secById(t.secId);
      const ph = e.target.closest('.blk') && findBlock(e.target.closest('.blk').dataset.blk);
      if (ph && ph.b && ph.b.type === 'image' && !ph.b.assetId && added[0]) { ph.b.assetId = added[0].id; ph.b.caption = ph.b.caption || added[0].caption; }
      else added.forEach((a, k) => sec.blocks.splice(t.index + k, 0, newBlock({ type: 'image', assetId: a.id, caption: a.caption })));
      save(); renderMain();
    }
    return;
  }
  if (!drag) return;
  e.preventDefault();
  const d = drag; drag = null;
  clearDropMarks();
  if (d.kind === 'sec') {
    const row = e.target.closest('[data-sec],[data-msec]');
    if (!row) return;
    const targetId = row.dataset.sec || row.dataset.msec;
    if (targetId === d.id) return;
    const r = row.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    const list = S.project.sections;
    const [moved] = list.splice(list.findIndex(s => s.id === d.id), 1);
    list.splice(list.findIndex(s => s.id === targetId) + (after ? 1 : 0), 0, moved);
    moved.userEdited = true;
    numberSections();
    logChange('user', `Moved ${moved.title} to position ${moved.num}.`);
    save(); render();
    return;
  }
  const t = dropTarget(e);
  if (!t) return;
  if (d.kind === 'blk') moveBlock(d.key, t.secId, t.index);
  else {
    // Dropping an image onto an empty visual placeholder fills it.
    const ph = e.target.closest('.blk') && findBlock(e.target.closest('.blk').dataset.blk);
    if (d.spec.startsWith('img:') && ph && ph.b && ph.b.type === 'image' && !ph.b.assetId) {
      const a = assetById(d.spec.slice(4)); ph.b.assetId = a.id; ph.b.caption = ph.b.caption || a.caption || a.name; ph.b.need = '';
      await ensureFullImage(ph.b);
    } else {
      const b = blockFromAsset(d.spec);
      if (b) { secById(t.secId).blocks.splice(t.index, 0, b); if (b.type === 'image') ensureFullImage(b); }
    }
  }
  save(); renderMain();
});
document.addEventListener('dragend', () => { drag = null; clearDropMarks(); });

/* Text edits on the canvas update the model without re-rendering, so the caret stays put. */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.edit) { const { b } = findBlock(t.dataset.edit); if (b) { b.html = t.innerHTML; if (b.mode !== 'manual' && b.mode !== 'verbatim') b.edited = true; save(); } }
  else if (t.dataset && t.dataset.cap) { const { b } = findBlock(t.dataset.cap); if (b) { b.caption = t.textContent; save(); } }
  else if (t.dataset && t.dataset.cell) { const [sid, bid, ri, ci] = t.dataset.cell.split(':'); const { b } = findBlock(sid + ':' + bid); if (b) { b.rows[+ri][+ci] = t.textContent; save(); } }
});
document.addEventListener('focusout', e => {
  const t = e.target;
  if (t.dataset && t.dataset.edit) {
    const { b } = findBlock(t.dataset.edit);
    if (b) { b.html = sanitize(t.innerHTML); if (b.mode === 'verbatim' && htmlToText(b.html) !== htmlToText(textToHtml((blockById((b.sources[0] || {}).id) || {}).text || ''))) b.mode = 'tailored'; save(); }
    if (S.ui.step === 'canvas') requestAnimationFrame(measurePages);
  }
});
document.addEventListener('paste', e => {
  const t = e.target.closest && e.target.closest('[contenteditable="true"]');
  if (!t) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});
