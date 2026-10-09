// Screens: Outline, Draft, Export, the source drawer and modals.

function viewOutline() {
  const p = S.project;
  numberSections();
  if (!p.sections.length) return `<div class="head"><div><h1>Outline</h1></div></div><div class="panel empty"><h3>Set the format first</h3><p>The outline fills each section of the format with requirements, key points and library content.</p><p style="margin-top:12px"><button class="btn primary" data-act="go" data-step="format">Go to format</button></p></div>`;
  return `${exampleBanner()}${aiBanner()}
  <div class="head"><div><h1>Outline</h1><p>Each section gets its requirements, the points to make, the library blocks to use and how to use them. Gaps are listed only when the library has nothing that covers them. Approve or edit this before any prose is written.</p></div>
    <div class="actions"><button class="btn primary" data-act="outline-all" ${AI.state !== 'on' || !p.library.length ? 'disabled' : ''}>${ICON.spark} Populate all sections</button></div></div>
  ${!p.library.length ? '<div class="banner warn"><span class="grow">The content library is empty, so every point would become a gap. Add library files on the Inputs step first.</span></div>' : ''}
  <div class="stack">${p.sections.map(outlineCard).join('')}</div>`;
}

function outlineCard(s) {
  const reqs = s.reqIds.map(reqById).filter(Boolean);
  return `<article class="ocard" id="oc-${s.id}">
    <div class="ocard-h"><span class="mono muted">${esc(s.num)}</span><h3>${esc(s.title)}</h3>
      <span class="pill ${s.status === 'drafted' ? 'ok' : s.status === 'outlined' ? 'acc' : ''}">${{ empty: 'Not outlined', outlined: 'Outlined', drafted: 'Drafted' }[s.status]}</span>
      ${s.pageLimit ? `<span class="hint">${s.pageLimit} pages</span>` : ''}
      <button class="btn sm" data-act="outline-one" data-id="${s.id}" ${AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} ${s.status === 'empty' ? 'Outline' : 'Re-outline'}</button></div>
    <div class="ocard-b">
      <div><p class="label">Requirements</p>${reqs.map(r => `<div class="blockref"><span class="rid" data-act="src" data-t="req" data-id="${r.id}">${r.id}</span>${r.mandatory ? '<span class="pill m">M</span>' : ''}<span>${esc(r.text.slice(0, 140))}${r.text.length > 140 ? '…' : ''}</span></div>`).join('') || '<p class="hint">None mapped.</p>'}</div>
      <div><p class="label">Key points</p>
        <textarea class="textarea" data-kp="${s.id}" rows="${Math.max(3, s.keyPoints.length + 1)}" placeholder="One point per line">${esc(s.keyPoints.join('\n'))}</textarea></div>
      <div><p class="label">Internal sources found</p>
        ${s.research ? (s.research.sources.map(x => `<div class="blockref"><span class="pill ${x.tier === 'internal' ? 'warn' : x.tier === 'product' ? 'acc' : ''}">${(TIERS[x.tier] || TIERS.reference).short}</span><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>${x.updated ? `<span class="hint">${esc(String(x.updated).slice(0, 10))}</span>` : ''}${x.why ? `<div class="hint" style="flex-basis:100%">${esc(x.why)}</div>` : ''}</div>`).join('') || '<p class="hint">Nothing relevant found.</p>') : `<p class="hint">${KN.state === 'on' ? 'Found automatically when you outline.' : 'Company search is off.'}</p>`}
        <button class="btn sm ghost" data-act="research-one" data-id="${s.id}" style="margin-top:4px" ${KN.state !== 'on' || AI.state !== 'on' ? 'disabled' : ''}>${s.research ? 'Search again' : 'Search now'}</button>
        ${(s.conflicts || []).length ? `<p class="label" style="margin-top:10px">Conflicts between sources</p>${s.conflicts.map(c => `<div class="blockref"><span class="pill warn">Conflict</span><span>${esc(c.text)}${c.resolution ? `<br><span class="hint">Use: ${esc(c.resolution)}</span>` : ''}</span></div>`).join('')}` : ''}</div>
      <div><p class="label">Library blocks</p>
        ${s.blockRefs.map((r, i) => { const b = blockById(r.id); return b ? `<div class="blockref"><span class="rid" data-act="src" data-t="lib" data-id="${b.id}">${b.id}</span><span class="pill ${b.tier === 'internal' ? 'warn' : b.tier === 'product' ? 'acc' : ''}">${(TIERS[b.tier || 'approved'] || TIERS.reference).short}</span><b>${esc(b.title)}</b>
          <select class="select" data-mode="${s.id}:${i}" style="width:auto;padding:0 4px;font-size:11px">${MODES.map(m => `<option ${r.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <button class="icon-btn" data-act="rm-ref" data-id="${s.id}" data-i="${i}" aria-label="Remove block">${ICON.x}</button>
          ${r.reason ? `<div class="hint" style="flex-basis:100%">${esc(r.reason)}</div>` : ''}</div>` : ''; }).join('') || '<p class="hint">None chosen yet.</p>'}
        <button class="btn sm ghost" data-act="add-ref" data-id="${s.id}" style="margin-top:4px">${ICON.plus} Add block</button></div>
      <div><p class="label">Gaps</p>
        ${s.gaps.map((g, i) => `<div class="blockref"><span class="gap">${esc(g.text)}</span>${g.owner ? `<span class="tag">${esc(g.owner)}</span>` : ''}<button class="icon-btn" data-act="rm-gap" data-id="${s.id}" data-i="${i}" aria-label="Remove gap">${ICON.x}</button></div>`).join('') || '<p class="hint">No gaps.</p>'}
        <button class="btn sm ghost" data-act="add-gap" data-id="${s.id}" style="margin-top:4px">${ICON.plus} Add gap</button>
        <p class="label" style="margin-top:10px">Visuals and tables</p>
        ${s.visuals.map(v => { const a = v.assetId && assetById(v.assetId); return `<div class="blockref">${a ? `<span class="pill ${a.source === 'figma' ? 'acc' : ''}">${a.source === 'figma' ? 'Figma' : 'Image'}</span>${esc(a.caption || a.name)}` : `<span class="gap">NEEDS VISUAL: ${esc(v.need)}</span>`}</div>`; }).join('')}
        ${s.tables.map(t => `<div class="blockref"><span class="pill">Table</span>${esc(t.title)}</div>`).join('')}
        ${!s.visuals.length && !s.tables.length ? '<p class="hint">None suggested.</p>' : ''}</div>
    </div></article>`;
}

function viewDraft() {
  const p = S.project;
  numberSections();
  if (!p.sections.length) return `<div class="head"><div><h1>Draft</h1></div></div><div class="panel empty"><h3>Set the format first</h3></div>`;
  const order = draftOrder();
  const totalIssues = projectStyleIssues().reduce((a, x) => a + x.issues.length, 0);
  return `${exampleBanner()}${aiBanner()}
  <div class="head"><div><h1>Draft</h1><p>Sections are written one at a time: content sections first, then the executive summary and other summaries last. Verbatim blocks go in word for word. Locked blocks survive a redraft. Every passage keeps its sources.</p></div>
    <div class="actions"><button class="btn primary" data-act="draft-all" ${AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} Draft all sections</button><button class="btn" data-act="go" data-step="canvas">Open canvas</button></div></div>
  ${totalIssues ? `<div class="banner warn"><span class="grow"><b>${plural(totalIssues, 'style issue')}</b> found in drafted text (banned phrases, dashes, uniform rhythm). Use "Fix style" on each section, or edit on the canvas.</span></div>` : ''}
  <div class="stack">${order.map(draftCard).join('')}</div>`;
}

function draftCard(s) {
  const words = s.blocks.filter(b => b.type === 'text' || b.type === 'callout').reduce((a, b) => a + htmlToText(b.html).split(/\s+/).filter(Boolean).length, 0);
  const budget = wordBudget(s);
  const cited = new Set(s.blocks.flatMap(b => (b.sources || []).filter(x => x.t === 'req').map(x => x.id)));
  const reqs = s.reqIds.map(reqById).filter(Boolean);
  const issues = sectionStyleIssues(s);
  const gaps = s.blocks.reduce((a, b) => a + ((b.html || '').match(/NEEDS (INPUT|VISUAL)/g) || []).length + (b.type === 'image' && !b.assetId ? 1 : 0), 0);
  return `<article class="ocard">
    <div class="ocard-h"><span class="mono muted">${esc(s.num)}</span><h3>${esc(s.title)}</h3>
      ${s.summarizes ? '<span class="pill">Drafted last</span>' : ''}
      <span class="pill ${s.status === 'drafted' ? 'ok' : ''}">${s.status === 'drafted' ? 'Drafted' : 'Not drafted'}</span>
      ${s.status === 'drafted' ? `<span class="hint tnum">${words} / ~${budget} words</span>` : ''}
      ${reqs.length && s.status === 'drafted' ? `<span class="pill ${reqs.every(r => cited.has(r.id)) ? 'ok' : 'warn'}">${reqs.filter(r => cited.has(r.id)).length}/${reqs.length} reqs cited</span>` : ''}
      ${gaps ? `<span class="pill crit">${plural(gaps, 'gap')}</span>` : ''}
      ${issues.length ? `<span class="pill warn">${plural(issues.length, 'style issue')}</span>` : ''}
      <div class="actions">
        ${issues.length ? `<button class="btn sm" data-act="restyle" data-id="${s.id}">Fix style</button>` : ''}
        <button class="btn sm" data-act="draft-one" data-id="${s.id}" ${AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} ${s.status === 'drafted' ? 'Redraft' : 'Draft'}</button>
        <button class="btn sm ghost" data-act="canvas-to" data-id="${s.id}">On canvas</button></div></div>
    ${s.blocks.length ? `<div style="padding:12px 14px;max-height:360px;overflow:auto;font-family:var(--f-doc);font-size:var(--fs-m)">
      ${s.blocks.map(b => `<div style="margin-bottom:10px">${previewBlock(b)}<div class="row" style="margin-top:2px"><span class="mode ${b.mode}">${b.mode}</span>${(b.sources || []).map(srcChip).join('')}${b.locked ? '<span class="pill ok">Locked</span>' : ''}</div></div>`).join('')}</div>` : ''}
    ${issues.length ? `<div style="padding:0 14px 10px" class="row">${[...new Set(issues.map(i => i.label))].slice(0, 8).map(l => `<span class="tag">${esc(l)}</span>`).join('')}</div>` : ''}
    <div style="padding:10px 14px;border-top:1px solid var(--line)" class="row"><input class="input" data-fb="${s.id}" placeholder="Feedback for a redraft, e.g. lead with the 18-month timeline, cut the history" value="${esc(s.feedback || '')}" style="flex:1;min-width:200px">
      <button class="btn sm" data-act="redraft-fb" data-id="${s.id}" ${AI.state !== 'on' || s.status !== 'drafted' ? 'disabled' : ''}>Redraft with feedback</button></div>
  </article>`;
}

function previewBlock(b) {
  if (b.type === 'text') return `<div class="blk-text">${b.html}</div>`;
  if (b.type === 'callout') return `<div class="blk-callout" style="color:var(--paper-ink)">${b.html}</div>`;
  if (b.type === 'image') { const a = assetById(b.assetId); return a ? `<div class="row"><img src="${a.thumb || a.dataUrl}" alt="" style="height:48px;background:#fff;border:1px solid var(--line)"><span class="hint">${esc(b.caption || a.caption || a.name)}</span></div>` : `<span class="gapmark">[NEEDS VISUAL: ${esc(b.need || b.caption || '')}]</span>`; }
  if (b.type === 'table') return `<span class="hint">Table: ${esc(b.caption || '')} (${(b.rows || []).length - 1} rows)</span>`;
  return '';
}
function srcChip(src) {
  if (src.t === 'req') return `<button class="src req" data-act="src" data-t="req" data-id="${src.id}">${src.id}</button>`;
  return `<button class="src" data-act="src" data-t="lib" data-id="${src.id}">${src.id}</button>`;
}

/* Export */
function exportChecks() {
  const p = S.project;
  const checks = [];
  const c = coverage();
  let markers = 0, missingVis = 0, ids = 0, confirms = 0, fromDiscussion = 0;
  for (const s of p.sections) for (const b of s.blocks) {
    const t = blockText(b);
    markers += (t.match(/\[NEEDS (INPUT|VISUAL)/g) || []).length;
    confirms += (t.match(/\[CONFIRM/g) || []).length;
    if ((b.sources || []).some(x => x.t === 'lib' && (blockById(x.id) || {}).tier === 'internal')) fromDiscussion++;
    if (b.type === 'image' && !b.assetId) missingVis++;
    if (/\b(B|R|A|P)-\d{3}\b/.test(t)) ids++;
  }
  const empty = p.sections.filter(s => !s.blocks.length);
  const style = projectStyleIssues();
  const styleN = style.reduce((a, x) => a + x.issues.length, 0);
  const stale = p.assets.filter(a => a.stale && p.sections.some(s => s.blocks.some(b => b.assetId === a.id)));
  const fileNames = p.files.map(f => f.name).filter(n => n.length > 6);
  let nameLeaks = 0;
  for (const s of p.sections) for (const b of s.blocks) { const t = blockText(b); for (const n of fileNames.concat(allBlocks().filter(b => b.url).map(b => b.fileName).filter(n => n && n.length > 8))) if (t.includes(n)) nameLeaks++; }
  const overPages = p.sections.filter(s => s.pageLimit && s._pages && s._pages > s.pageLimit + 0.05);
  checks.push({ ok: !markers, sev: 'crit', text: markers ? `${plural(markers, 'gap marker')} still in the text ([NEEDS INPUT] or [NEEDS VISUAL])` : 'No gap markers left' });
  checks.push({ ok: !confirms, sev: 'crit', text: confirms ? `${plural(confirms, 'claim')} waiting for confirmation ([CONFIRM: ...], usually roadmap items or facts from internal discussion)` : 'No unconfirmed claims' });
  checks.push({ ok: !fromDiscussion, sev: 'warn', text: fromDiscussion ? `${plural(fromDiscussion, 'passage')} drawing on Slack, email or meeting notes. Check nothing internal shows through.` : 'Nothing drawn from internal discussion' });
  checks.push({ ok: !missingVis, sev: 'crit', text: missingVis ? `${plural(missingVis, 'visual placeholder')} without an image` : 'Every visual has an image' });
  checks.push({ ok: !c.unmapped.length, sev: 'crit', text: c.unmapped.length ? `${plural(c.unmapped.length, 'mandatory requirement')} not mapped to a section` : 'All mandatory requirements mapped' });
  checks.push({ ok: c.addressed >= c.total, sev: 'warn', text: `${c.addressed}/${c.total} mandatory requirements cited in the drafted text` });
  checks.push({ ok: !styleN, sev: 'crit', text: styleN ? `${plural(styleN, 'style issue')} that can read as machine-written, in ${plural(style.length, 'section')}` : 'Style check passed' });
  checks.push({ ok: !ids && !nameLeaks, sev: 'crit', text: ids || nameLeaks ? 'Internal ids or library file names appear in the text' : 'No internal references in the text' });
  checks.push({ ok: !stale.length, sev: 'crit', text: stale.length ? `${plural(stale.length, 'image')} no longer in the Figma library` : 'Product images match the Figma library' });
  checks.push({ ok: !empty.length, sev: 'warn', text: empty.length ? `${plural(empty.length, 'section')} with no content: ${empty.slice(0, 4).map(s => s.num).join(', ')}` : 'Every section has content' });
  checks.push({ ok: !overPages.length, sev: 'warn', text: overPages.length ? `Over the page limit: ${overPages.map(s => s.num).join(', ')}` : 'Within page limits (as last measured on the canvas)' });
  checks.push({ ok: !p.risks.length, sev: 'warn', text: p.risks.length ? `${plural(p.risks.length, 'client-mandated change')} not applied` : 'All client-mandated changes applied' });
  return checks;
}

function viewExport() {
  const checks = exportChecks();
  const blockers = checks.filter(c => !c.ok && c.sev === 'crit').length;
  const dl = DL.state === 'on';
  return `${exampleBanner()}
  <div class="head"><div><h1>Export</h1><p>The customer document carries only the clean text, images and tables. Source links, modes, ids and comments stay in the working view and the separate source map. File metadata carries your company name, not the tool.</p></div></div>
  ${!dl ? `<div class="banner warn"><span class="grow">${DL.state === 'connecting' ? 'Connecting…' : 'Downloads work when this page is open on claude.ai.'}</span></div>` : ''}
  <div class="grid2">
    <section class="panel"><div class="panel-h"><h2>Pre-export check</h2><span class="pill ${blockers ? 'crit' : 'ok'}">${blockers ? plural(blockers, 'blocker') : 'Ready'}</span></div><div class="panel-b stack-s">
      ${checks.map(c => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="pill ${c.ok ? 'ok' : c.sev}" style="min-width:52px;justify-content:center">${c.ok ? 'OK' : c.sev === 'crit' ? 'Fix' : 'Check'}</span><span>${esc(c.text)}</span></div>`).join('')}
    </div></section>
    <section class="panel"><div class="panel-h"><h2>Files</h2></div><div class="panel-b stack-s">
      <div class="field"><label for="exp-author">Author shown in the file properties</label><input class="input" id="exp-author" value="${esc(S.project.exportAuthor || '')}" placeholder="Your company name"></div>
      <button class="btn primary" data-act="export-docx" ${!dl ? 'disabled' : ''}>Customer response (.docx)</button>
      <p class="hint">Pulls the latest product images from Figma first. ${blockers ? 'Blockers above will be listed again before the file is made.' : ''}</p>
      <button class="btn" data-act="export-map" ${!dl ? 'disabled' : ''}>Internal source map (.csv)</button>
      <button class="btn" data-act="export-matrix" ${!dl || !S.project.matrix.length ? 'disabled' : ''}>Requirements matrix answers (.xlsx)</button>
      <hr style="border:0;border-top:1px solid var(--line);width:100%">
      <button class="btn" data-act="save-project" ${!dl ? 'disabled' : ''}>Save project file (.json)</button>
      <button class="btn" data-act="open-project">Open project file</button>
      <p class="hint">The project also saves automatically in this browser.</p>
    </div></section>
  </div>`;
}

/* Source drawer: internal only, shows the passage in its source. */
async function openSource(t, id) {
  S.ui.drawer = { t, id };
  renderOverlay();
}
function renderDrawer() {
  const d = S.ui.drawer;
  if (!d) return '';
  let title = '', body = '';
  if (d.t === 'req') {
    const r = reqById(d.id);
    if (!r) return '';
    const f = fileById(r.fileId);
    title = `${r.id} · ${r.mandatory ? 'Mandatory' : 'Optional'} ${r.type}`;
    let ctx = '';
    if (f) {
      const pg = f.pages.find(x => String(x.n) === String(r.page)) || (f.pages.length === 1 ? f.pages[0] : null);
      const txt = pg ? pg.text : f.text;
      ctx = highlight(txt, r.text);
    }
    body = `<p style="margin-bottom:10px"><b>${esc(r.text)}</b></p>
      <dl class="kv" style="margin-bottom:12px"><dt>Source</dt><dd>${esc(r.fileName || 'Added manually')}</dd>${r.page ? `<dt>Page / row</dt><dd>${esc(r.page)}</dd>` : ''}${r.section ? `<dt>RFP section</dt><dd>${esc(r.section)}</dd>` : ''}<dt>Response</dt><dd>${esc(r.responseType)}</dd><dt>Mapped to</dt><dd>${reqSections(r.id).map(s => esc(s.num + ' ' + s.title)).join(', ') || 'None'}</dd></dl>
      ${f && f.ext === 'pdf' && r.page ? `<canvas class="pdfpage" id="pdf-canvas" data-file="${f.id}" data-page="${esc(r.page)}"></canvas><p class="hint" style="margin:6px 0 12px">Page ${esc(r.page)} of ${esc(f.name)}</p>` : ''}
      ${ctx ? `<p class="label">In context</p><pre>${ctx}</pre>` : ''}`;
  } else if (d.t === 'lib') {
    const b = blockById(d.id);
    if (!b) return '';
    title = `${b.id} · ${b.title}`;
    body = `<dl class="kv" style="margin-bottom:12px"><dt>Trust</dt><dd>${esc((TIERS[b.tier || 'approved'] || TIERS.reference).label)}</dd><dt>${b.url ? 'Document' : 'File'}</dt><dd>${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.fileName)}</a>` : esc(b.fileName)}</dd><dt>Location</dt><dd>${esc(b.loc)}</dd>${b.updated ? `<dt>Updated</dt><dd>${esc(String(b.updated).slice(0, 10))}</dd>` : ''}${b.owner ? `<dt>Owner</dt><dd>${esc(b.owner)}</dd>` : ''}<dt>Tags</dt><dd>${b.tags.map(t => `<span class="tag">${esc(t)}</span>`).join(' ') || 'None'}</dd></dl>
      ${fileById(b.fileId) && fileById(b.fileId).ext === 'pdf' && /^p\. \d+/.test(b.loc) ? `<canvas class="pdfpage" id="pdf-canvas" data-file="${b.fileId}" data-page="${b.loc.replace('p. ', '')}"></canvas><p class="hint" style="margin:6px 0 12px">${esc(b.loc)} of ${esc(b.fileName)}</p>` : ''}
      <p class="label">Matched passage</p><pre><mark>${esc(b.text)}</mark></pre>
      <p class="label" style="margin-top:12px">Used in</p><p>${S.project.sections.filter(s => s.blocks.some(k => (k.sources || []).some(x => x.id === b.id))).map(s => esc(s.num + ' ' + s.title)).join(', ') || 'Not used yet'}</p>`;
  } else if (d.t === 'asset') {
    const a = assetById(d.id);
    if (!a) return '';
    title = a.caption || a.name;
    body = `<img src="${a.dataUrl || a.thumb}" alt="" style="width:100%;background:#fff;border:1px solid var(--line)">
      <dl class="kv" style="margin-top:12px"><dt>Source</dt><dd>${a.source === 'figma' ? 'Figma library' : a.source === 'example' ? 'Example image' : 'Uploaded'}</dd>${a.source === 'figma' ? `<dt>Frame</dt><dd><a href="${figmaFrameUrl(a)}" target="_blank" rel="noopener">${esc(a.name)}</a></dd><dt>Pulled</dt><dd>${a.fetchedAt ? new Date(a.fetchedAt).toLocaleString() : 'Thumbnail only'}</dd>` : ''}${a.fileName ? `<dt>File</dt><dd>${esc(a.fileName)}</dd>` : ''}</dl>`;
  }
  return `<aside class="drawer" role="dialog" aria-label="Source"><div class="drawer-h"><b>${esc(title)}</b><button class="icon-btn" data-act="close-drawer" aria-label="Close">${ICON.x}</button></div>
    <div class="drawer-b"><p class="hint" style="margin-bottom:10px">Internal only. Sources never appear in the customer document.</p>${body}</div></aside>`;
}
function highlight(full, needle) {
  const n = needle.slice(0, 80).trim();
  const i = full.toLowerCase().indexOf(n.toLowerCase().slice(0, 50));
  if (i < 0) return esc(full.slice(0, 3000));
  const start = Math.max(0, i - 600), end = Math.min(full.length, i + needle.length + 600);
  return (start ? '…' : '') + esc(full.slice(start, i)) + '<mark>' + esc(full.slice(i, i + needle.length)) + '</mark>' + esc(full.slice(i + needle.length, end)) + (end < full.length ? '…' : '');
}
async function drawPdfPage() {
  const cv = $('#pdf-canvas');
  if (!cv || !window.pdfjsLib) return;
  const buf = await getBytes(cv.dataset.file);
  if (!buf) { cv.replaceWith(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'The original PDF is not stored in this browser.' })); return; }
  try {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
    const pg = await pdf.getPage(clamp(parseInt(cv.dataset.page, 10) || 1, 1, pdf.numPages));
    const vp = pg.getViewport({ scale: 1.4 });
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  } catch { /* text context below is still shown */ }
}

/* Modals */
function renderModal() {
  const m = S.ui.modal;
  if (!m) return '';
  return `<div class="scrim" data-act="close-modal-scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(m.title)}">
    <div class="modal-h"><h2>${esc(m.title)}</h2><button class="icon-btn" data-act="close-modal" aria-label="Close">${ICON.x}</button></div>
    <div class="modal-b">${m.body}</div>
    <div class="modal-f">${m.foot || '<button class="btn" data-act="close-modal">Close</button>'}</div></div></div>`;
}

function modalSecReqs(secId) {
  const s = secById(secId);
  const items = S.project.requirements.map(r => `<label class="row" style="flex-wrap:nowrap;align-items:flex-start;padding:4px 0;border-top:1px solid var(--line)"><input type="checkbox" data-mapreq="${r.id}" ${s.reqIds.includes(r.id) ? 'checked' : ''}><span class="rid">${r.id}</span>${r.mandatory ? '<span class="pill m">M</span>' : ''}<span>${esc(r.text.slice(0, 160))}</span></label>`).join('');
  S.ui.modal = { title: `Requirements for ${s.num} ${s.title}`, body: items || '<p class="hint">No requirements yet.</p>', foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="save-sec-reqs" data-id="${s.id}">Save mapping</button>` };
  renderOverlay();
}
function modalAddRef(secId) {
  const s = secById(secId);
  const ranked = retrieve(sectionQuery(s), { k: 30 });
  const rest = allBlocks();
  const list = ranked.concat(rest.filter(b => !ranked.includes(b))).filter(b => !s.blockRefs.some(r => r.id === b.id)).slice(0, 80);
  S.ui.modal = {
    title: `Add library blocks to ${s.num}`,
    body: list.map(b => `<label class="row" style="flex-wrap:nowrap;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line)"><input type="checkbox" data-addref="${b.id}"><span class="rid">${b.id}</span><span><b>${esc(b.title)}</b><br><span class="hint">${esc((b.summary || b.text).slice(0, 160))}</span></span></label>`).join('') || '<p class="hint">The library is empty.</p>',
    foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="save-add-ref" data-id="${s.id}">Add selected</button>`,
  };
  renderOverlay();
}
function modalExportBlockers(checks) {
  S.ui.modal = {
    title: 'Not ready for the customer yet',
    body: `<p style="margin-bottom:10px">These would reach the customer as they are:</p>${checks.map(c => `<p>• ${esc(c.text)}</p>`).join('')}<p class="hint" style="margin-top:10px">Export anyway only for an internal review copy.</p>`,
    foot: `<button class="btn" data-act="close-modal">Go back and fix</button><button class="btn danger" data-act="export-docx-force">Export anyway</button>`,
  };
  renderOverlay();
}
function modalConfirm(title, text, act, data = '') {
  S.ui.modal = { title, body: `<p>${esc(text)}</p>`, foot: `<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="${act}" ${data}>Confirm</button>` };
  renderOverlay();
}

/* Bid context: pick the Salesforce opportunity, then review what the engine proposes before it fills the fields. */
async function startPullContext() {
  const p = S.project;
  const plan = p.sourcePlan;
  if (plan.salesforce && p.context.client) {
    let opps = [];
    try { toast('Looking up opportunities in Salesforce…', { sticky: true }); opps = await findOpportunities(p.context.client); }
    catch (e) { toast(e.message, { err: true }); await sleep(1500); }
    toast('');
    if (opps.length) {
      S.ui.modal = {
        title: 'Which opportunity is this?',
        body: opps.map((o, i) => `<label class="row" style="flex-wrap:nowrap;align-items:flex-start;padding:6px 0;border-top:1px solid var(--line)"><input type="radio" name="opp" value="${esc(o.id)}" ${i ? '' : 'checked'}><span><b>${esc(o.name)}</b><br><span class="hint">${esc(o.account || '')} · ${esc(o.stage || '')}${o.close ? ' · close ' + esc(o.close) : ''}${o.type ? ' · ' + esc(o.type) : ''}</span></span></label>`).join('')
          + `<label class="row" style="padding:6px 0;border-top:1px solid var(--line)"><input type="radio" name="opp" value=""><span>None of these, use notes only</span></label>`,
        foot: '<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="pull-context-go">Continue</button>',
      };
      renderOverlay();
      return;
    }
  }
  await runPullContext('');
}
async function runPullContext(oppId) {
  S.ui.modal = null; renderOverlay();
  try {
    const { res, sources } = await pullBidContext(oppId);
    S.ui.pendingContext = { res, sources };
    const p = S.project, rows = [['client', 'Client'], ['bidding', 'What we are bidding on'], ['winThemes', 'Win themes'], ['notes', 'Notes on the client']];
    S.ui.modal = {
      title: 'Review bid context',
      body: `<p class="hint" style="margin-bottom:8px">From ${plural(sources.length, 'source')}. Tick the fields to fill in. Unticked fields keep what you have.</p>`
        + rows.filter(([k]) => res[k]).map(([k, l]) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><label class="row"><input type="checkbox" data-ctxpick="${k}" ${!p.context[k] ? 'checked' : ''}><b>${l}</b>${p.context[k] ? '<span class="pill warn">Replaces what you have</span>' : ''}</label><pre style="white-space:pre-wrap;font:inherit;margin:6px 0 0">${esc(res[k])}</pre></div>`).join('')
        + ((res.stakeholders || []).length ? `<div style="padding:8px 0;border-top:1px solid var(--line)"><label class="row"><input type="checkbox" data-ctxpick="stakeholders" checked><b>Stakeholders</b></label>${res.stakeholders.map(s => `<div class="hint">${esc(s.name)}, ${esc(s.title || '')} (${esc(s.role || 'unknown')})</div>`).join('')}</div>` : '')
        + `<p class="label" style="margin-top:10px">Sources</p>${sources.map(s => `<div class="hint">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</div>`).join('') || '<p class="hint">None found.</p>'}`,
      foot: '<button class="btn" data-act="close-modal">Discard</button><button class="btn primary" data-act="pull-context-apply">Fill in selected</button>',
    };
    renderOverlay();
  } catch (e) { toast(e.message, { err: true }); }
}
function applyPulledContext() {
  const pc = S.ui.pendingContext; if (!pc) return;
  const c = S.project.context;
  for (const el of $$('[data-ctxpick]')) if (el.checked) c[el.dataset.ctxpick] = pc.res[el.dataset.ctxpick];
  c.sources = pc.sources;
  logChange('engine', `Filled bid context from ${plural(pc.sources.length, 'source')}.`);
  S.ui.pendingContext = null; S.ui.modal = null;
  save(); render();
}
