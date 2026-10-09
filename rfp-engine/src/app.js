// Rendering, event wiring and startup.

function render() { renderBar(); renderRail(); renderMain(); renderOverlay(); }

function renderMain() {
  const main = $('#main');
  if (!main || !S.project) return;
  const step = S.ui.step;
  const views = { inputs: viewInputs, requirements: viewRequirements, format: viewFormat, outline: viewOutline, draft: viewDraft, canvas: viewCanvas, export: viewExport, library: viewLibrary, styleguide: viewStyleGuide, sources: viewSources, templates: viewTemplates };
  // Keep the canvas scroll position across re-renders.
  const mid = $('#cv-mid'), scroll = mid ? mid.scrollTop : 0, mainScroll = main.scrollTop;
  const active = document.activeElement && document.activeElement.id;
  main.className = 'main' + (step === 'canvas' ? ' flush' : '');
  main.innerHTML = (views[step] || viewInputs)();
  if (step === 'canvas') { const m = $('#cv-mid'); if (m) m.scrollTop = scroll; requestAnimationFrame(measurePages); }
  else main.scrollTop = mainScroll;
  const el = active && $('#' + active);
  if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search)$/.test(el.type)))) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch { } }
  renderRail();
}

function renderOverlay() {
  $('#overlay').innerHTML = renderDrawer() + renderModal();
  if (S.ui.drawer) drawPdfPage();
}

async function run(fn) {
  try { await fn(); }
  catch (e) { toast(e.message || String(e), { err: true }); }
  finally { save(); render(); }
}

let pickRole = 'rfp';
function pickFiles(role, accept) {
  pickRole = role;
  const inp = $('#file-pick');
  inp.accept = accept || '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.svg';
  inp.value = '';
  inp.click();
}

const ACTIONS = {
  'go': el => { S.ui.step = el.dataset.step; S.ui.drawer = null; render(); $('#main').scrollTop = 0; },
  'new-project': () => modalConfirm('Start a new project?', S.project.example ? 'The example project will be replaced with an empty one.' : 'The current project will be replaced. Save a project file first from the Export step if you want to keep it.', 'confirm-new'),
  'confirm-new': () => { const st = S.project.example ? null : S.project.style; S.project = newProject(); if (st) S.project.style = st; S.ui = Object.assign(S.ui, { step: 'inputs', modal: null, drawer: null }); fileBytes.clear(); save(); render(); },
  'cancel-ai': () => cancelAI(),
  'extract': () => run(extractRequirements).then(() => { if (!S.project.pending && S.project.requirements.length) { S.ui.step = 'requirements'; render(); } }),
  'tag-lib': () => run(tagLibrary),
  'rm-file': el => {
    const p = S.project, id = el.dataset.id, f = fileById(id);
    p.files = p.files.filter(x => x.id !== id);
    if (f.role === 'library') p.library = p.library.filter(b => b.fileId !== id);
    else p.requirements = p.requirements.filter(r => r.fileId !== id);
    for (const s of p.sections) s.reqIds = s.reqIds.filter(reqById);
    logChange('user', `Removed ${f.name}.`);
    save(); render();
  },
  'fig-sync': () => run(async () => {
    const v = ($('#fig-url') || {}).value;
    if (v !== undefined) S.project.figma = Object.assign(S.project.figma || {}, { url: v.trim() });
    await syncFigmaLibrary();
  }),
  'style-reset': () => modalConfirm('Reset the style guide?', 'Every field goes back to the defaults for everyone using these team settings.', 'confirm-style-reset'),
  'confirm-style-reset': () => { WS.data.styleGuide = JSON.parse(JSON.stringify(DEFAULT_STYLE_GUIDE)); saveWorkspace(); S.ui.modal = null; render(); },
  'sg-import-file': () => pickFiles('styleguide', '.pdf,.docx,.txt,.md'),
  'sg-import-url': () => { S.ui.modal = { title: 'Import the style guide from a link', body: '<div class="field"><label for="sg-url">Link to the style guide (Drive, Confluence or any page Glean can read)</label><input class="input" id="sg-url" placeholder="https://"></div>', foot: '<button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="sg-import-url-go">Import</button>' }; renderOverlay(); },
  'sg-import-url-go': () => { const u = ($('#sg-url') || {}).value || ''; S.ui.modal = null; renderOverlay(); run(async () => { const docs = await gleanRead([u.trim()]); if (!docs.length || !docs[0].text) throw new Error('Nothing could be read from that link.'); await importStyleGuide(docs[0].text); toast('Style guide imported. Review the fields.'); }); },
  'find-sources': () => run(findSourcesFromPlan),
  'research-one': el => run(() => researchSection(secById(el.dataset.id))),
  'pull-context': () => startPullContext(),
  'pull-context-go': () => { const r = $$('input[name="opp"]').find(x => x.checked); runPullContext(r ? r.value : ''); },
  'pull-context-apply': () => applyPulledContext(),
  'sync-pinned': () => run(async () => { const n = await syncPinned(); toast(`Cached ${plural(n, 'passage')} from pinned sources.`); }),
  'pin-add': () => { WS.data.sources.pinned.push({ url: '', tier: 'approved', title: '' }); saveWorkspace(); renderMain(); },
  'pin-rm': el => { WS.data.sources.pinned.splice(+el.dataset.i, 1); saveWorkspace(); renderMain(); },
  'recommend': () => run(async () => {
    if (S.project.sections.some(s => s.blocks.length)) {
      modalConfirm('Re-recommend the format?', 'Generated sections and their drafts are replaced. Sections you added or edited are kept.', 'confirm-recommend');
      return;
    }
    await recommendFormat(); S.ui.step = 'format';
  }),
  'confirm-recommend': () => { S.ui.modal = null; run(async () => { await recommendFormat(); S.ui.step = 'format'; }); },
  'add-req': () => {
    const r = { id: nextReqId(), text: 'New requirement', fileId: null, fileName: '', page: '', section: '', type: 'functional', mandatory: true, weight: '', responseType: 'narrative' };
    S.project.requirements.unshift(r); logChange('user', `Added requirement ${r.id}.`); save(); renderMain();
  },
  'rm-req': el => { const p = S.project; p.requirements = p.requirements.filter(r => r.id !== el.dataset.id); for (const s of p.sections) s.reqIds = s.reqIds.filter(id => id !== el.dataset.id); save(); render(); },
  'toggle-m': el => { const r = reqById(el.dataset.id); r.mandatory = !r.mandatory; save(); render(); },
  'add-obj': () => { S.project.objectives.push(''); renderMain(); },
  'rm-obj': el => { S.project.objectives.splice(+el.dataset.i, 1); save(); renderMain(); },
  'matrix': () => run(answerMatrix),
  'add-sec': () => { const s = newSection({ title: 'New section' }); S.project.sections.push(s); numberSections(); markUserEdit(s, 'Added a section.'); save(); render(); },
  'sec-add-after': el => { const p = S.project, i = p.sections.findIndex(s => s.id === el.dataset.id); const s = newSection({ title: 'New section', level: p.sections[i].level }); p.sections.splice(i + 1, 0, s); numberSections(); markUserEdit(s, `Added a section after ${p.sections[i].num}.`); save(); render(); },
  'sec-rm': el => { const s = secById(el.dataset.id); modalConfirm('Delete section?', `"${s.num} ${s.title}" and its draft will be removed. Its requirements become unmapped.`, 'confirm-sec-rm', `data-id="${s.id}"`); },
  'confirm-sec-rm': el => { const p = S.project, s = secById(el.dataset.id); p.sections = p.sections.filter(x => x.id !== s.id); logChange('user', `Deleted ${s.num} ${s.title}.`); numberSections(); S.ui.modal = null; save(); render(); },
  'sec-level': el => { const s = secById(el.dataset.id); s.level = s.level === 1 ? 2 : 1; numberSections(); markUserEdit(s, `Changed ${s.title} to level ${s.level}.`); save(); render(); },
  'sec-merge': el => {
    const p = S.project, i = p.sections.findIndex(s => s.id === el.dataset.id), a = p.sections[i], b = p.sections[i + 1];
    if (!b) { toast('There is no section below to merge with.'); return; }
    applyOp({ op: 'merge', ids: [a.id, b.id], title: a.title, source: 'user' });
    numberSections(); markUserEdit(a, `Merged ${b.title} into ${a.title}.`); save(); render();
  },
  'sec-reqs': el => modalSecReqs(el.dataset.id),
  'save-sec-reqs': el => { const s = secById(el.dataset.id); s.reqIds = $$('[data-mapreq]').filter(x => x.checked).map(x => x.dataset.mapreq); markUserEdit(s, `Changed requirement mapping for ${s.num} ${s.title}.`); S.ui.modal = null; save(); render(); },
  'map-unmapped': () => { const s = secById($('#map-sec').value); const ids = coverage().unmapped.map(r => r.id); s.reqIds = [...new Set(s.reqIds.concat(ids))]; markUserEdit(s, `Mapped ${ids.length} requirements to ${s.num} ${s.title}.`); save(); render(); },
  'clear-risks': () => { S.project.risks = []; save(); render(); },
  'fmt-change': () => { const v = $('#fmt-instr').value.trim(); if (!v) { toast('Describe the change first.'); return; } run(() => proposeFormatChange({ source: 'user', instruction: v })); },
  'pend-apply': () => { applyPending(); render(); toast('Changes applied.'); },
  'pend-discard': () => { const p = S.project; if (p.pending && p.pending.source === 'client') for (const o of p.pending.ops) p.risks.unshift({ id: uid('risk'), text: describeOp(o), reason: o.reason || '', at: Date.now() }); p.pending = null; save(); render(); },
  'outline-all': () => run(outlineAll),
  'outline-one': el => run(() => outlineSection(secById(el.dataset.id))),
  'rm-ref': el => { const s = secById(el.dataset.id); s.blockRefs.splice(+el.dataset.i, 1); save(); renderMain(); },
  'add-ref': el => modalAddRef(el.dataset.id),
  'save-add-ref': el => { const s = secById(el.dataset.id); for (const x of $$('[data-addref]').filter(x => x.checked)) s.blockRefs.push({ id: x.dataset.addref, reason: 'Added by you', mode: 'tailored' }); if (s.status === 'empty') s.status = 'outlined'; S.ui.modal = null; save(); render(); },
  'rm-gap': el => { secById(el.dataset.id).gaps.splice(+el.dataset.i, 1); save(); renderMain(); },
  'add-gap': el => { const s = secById(el.dataset.id); s.gaps.push({ text: 'Describe what is missing', owner: '' }); save(); renderMain(); },
  'draft-all': () => run(draftAll),
  'draft-one': el => run(() => draftSection(secById(el.dataset.id))),
  'redraft-fb': el => { const s = secById(el.dataset.id); const v = ($(`[data-fb="${s.id}"]`) || {}).value || ''; s.feedback = v.trim(); if (!s.feedback) { toast('Write the feedback first.'); return; } run(() => draftSection(s)); },
  'restyle': el => run(() => restyleSection(secById(el.dataset.id))),
  'canvas-to': el => { S.ui.step = 'canvas'; render(); requestAnimationFrame(() => { const t = $('#ds-' + el.dataset.id); if (t) t.scrollIntoView({ block: 'start' }); }); },
  'jump': el => { const t = $('#ds-' + el.dataset.id); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
  'view': el => { S.ui.view = el.dataset.v; renderMain(); },
  'toggle-assets': () => { S.ui.assetsOpen = !S.ui.assetsOpen; renderMain(); },
  'lib-tab': el => { S.ui.libTab = el.dataset.tab; renderMain(); },
  'upload-img': () => pickFiles('library', '.png,.jpg,.jpeg,.gif,.webp,.svg'),
  'ins': el => {
    const s = secById(el.dataset.id), t = el.dataset.type;
    const b = t === 'table' ? makeTable('custom', s) : t === 'image' ? newBlock({ type: 'image', need: 'choose an image', caption: '' }) : t === 'callout' ? newBlock({ type: 'callout', html: '<p>[NEEDS INPUT: key stat or proof point]</p>' }) : newBlock({ type: 'text', html: '<p>New paragraph.</p>' });
    s.blocks.push(b); save(); renderMain();
  },
  'blk-up': el => { const { s, i } = findBlock(el.dataset.s + ':' + el.dataset.b); if (i > 0) { [s.blocks[i - 1], s.blocks[i]] = [s.blocks[i], s.blocks[i - 1]]; save(); renderMain(); } },
  'blk-down': el => { const { s, i } = findBlock(el.dataset.s + ':' + el.dataset.b); if (i < s.blocks.length - 1) { [s.blocks[i + 1], s.blocks[i]] = [s.blocks[i], s.blocks[i + 1]]; save(); renderMain(); } },
  'blk-width': el => { const { b } = findBlock(el.dataset.s + ':' + el.dataset.b); b.width = b.width === 'half' ? 'full' : 'half'; save(); renderMain(); },
  'blk-lock': el => { const { b } = findBlock(el.dataset.s + ':' + el.dataset.b); b.locked = !b.locked; save(); renderMain(); },
  'blk-rm': el => { const { s, i } = findBlock(el.dataset.s + ':' + el.dataset.b); s.blocks.splice(i, 1); save(); renderMain(); },
  'tbl-row': el => { const { b } = findBlock(el.dataset.s + ':' + el.dataset.b); b.rows.push(b.rows[0].map(() => '')); save(); renderMain(); },
  'tbl-col': el => { const { b } = findBlock(el.dataset.s + ':' + el.dataset.b); b.rows.forEach((r, i) => r.push(i ? '' : 'Column')); save(); renderMain(); },
  'pick-img': el => {
    const key = el.dataset.s + ':' + el.dataset.b;
    const imgs = S.project.assets.filter(a => !a.stale);
    S.ui.modal = {
      title: 'Choose an image',
      body: imgs.length ? `<p class="hint" style="margin-bottom:8px">Product visuals must come from the Figma library.</p><div class="thumbs">${imgs.map(a => `<button class="thumb" style="cursor:pointer;text-align:left;padding:0" data-act="set-img" data-key="${key}" data-id="${a.id}"><img src="${a.thumb || a.dataUrl}" alt=""><div><span class="pill ${a.source === 'figma' ? 'acc' : ''}">${a.source === 'figma' ? 'Figma' : a.source === 'example' ? 'Example' : 'Upload'}</span> ${esc(a.caption || a.name)}</div></button>`).join('')}</div>` : '<p>No images yet. Sync the Figma library on the Inputs step, or upload a non-product image.</p>',
    };
    renderOverlay();
  },
  'set-img': el => { const { b } = findBlock(el.dataset.key); const a = assetById(el.dataset.id); b.assetId = a.id; b.caption = b.caption || a.caption || a.name; b.need = ''; S.ui.modal = null; save(); render(); ensureFullImage(b); },
  'src': el => openSource(el.dataset.t, el.dataset.id),
  'close-drawer': () => { S.ui.drawer = null; renderOverlay(); },
  'close-modal': () => { S.ui.modal = null; renderOverlay(); },
  'close-modal-scrim': (el, e) => { if (e.target === el) { S.ui.modal = null; renderOverlay(); } },
  'export-docx': () => exportDocx(false),
  'export-docx-force': () => exportDocx(true),
  'export-map': () => run(exportSourceMap),
  'export-matrix': () => run(exportMatrix),
  'save-project': () => run(saveProjectFile),
  'open-project': () => { const i = $('#project-pick'); i.value = ''; i.click(); },
};

document.addEventListener('click', e => {
  const drop = e.target.closest('[data-drop]');
  if (drop) { pickFiles(drop.dataset.drop); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.isContentEditable && el.dataset.act !== 'src') return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.ui.modal) S.ui.modal = null; else S.ui.drawer = null; renderOverlay(); }
  const drop = e.target.closest && e.target.closest('[data-drop]');
  if (drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickFiles(drop.dataset.drop); }
});
$('#file-pick').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  if (pickRole === 'styleguide') {
    run(async () => { const parsed = await readAny(files[0]); if (!parsed.text) throw new Error('No text found in that file.'); await importStyleGuide(parsed.text); toast('Style guide imported. Review the fields.'); });
    return;
  }
  addFiles(files, pickRole);
});
$('#project-pick').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) openProjectFile(f); });

/* Form fields that write straight to the model. */
document.addEventListener('input', e => {
  const t = e.target, p = S.project, d = t.dataset || {};
  if (t.id === 'proj-name') { p.name = t.value; save(); return; }
  if (d.ctx) { p.context[d.ctx] = t.value; save(); return; }
  if (d.sg) { if (wsEditable()) { sg()[d.sg] = t.value; saveWorkspace(); } return; }
  if (d.tpl) { WS.data.templates[d.tpl] = t.value; saveWorkspace(); return; }
  if (d.pinUrl !== undefined) { WS.data.sources.pinned[+d.pinUrl].url = t.value.trim(); saveWorkspace(); return; }
  if (t.id === 'ws-hints') { WS.data.sources.glean.hints = t.value; saveWorkspace(); return; }
  if (t.id === 'ws-recency') { WS.data.sources.glean.recencyMonths = parseInt(t.value, 10) || 18; saveWorkspace(); return; }
  if (t.id === 'plan-hints') { p.sourcePlan.hints = t.value; save(); return; }
  if (d.obj !== undefined) { p.objectives[+d.obj] = t.value; save(); return; }
  if (d.reqText) { const r = reqById(d.reqText); if (r) { r.text = t.textContent; save(); } return; }
  if (d.mxComment) { const m = p.matrix.find(x => x.reqId === d.mxComment); if (m) { m.comment = t.textContent; m.locked = true; save(); } return; }
  if (d.kp) { const s = secById(d.kp); s.keyPoints = t.value.split('\n').map(x => x.trim()).filter(Boolean); if (s.status === 'empty' && s.keyPoints.length) s.status = 'outlined'; save(); return; }
  if (d.fb) { secById(d.fb).feedback = t.value; save(); return; }
  if (t.id === 'req-q') { S.ui.reqQuery = t.value; renderMain(); return; }
  if (t.id === 'lib-q') { S.ui.libQuery = t.value; renderMain(); return; }
  if (t.id === 'asset-q') { S.ui.assetQuery = t.value; renderMain(); return; }
  if (t.id === 'fig-url') { p.figma = Object.assign(p.figma || {}, { url: t.value.trim() }); save(); return; }
  if (t.id === 'exp-author') { p.exportAuthor = t.value; save(); return; }
});
document.addEventListener('change', e => {
  const t = e.target, p = S.project, d = t.dataset || {};
  if (d.secTitle) { const s = secById(d.secTitle); if (s && s.title !== t.value) { const old = s.title; s.title = t.value; markUserEdit(s, `Renamed "${old}" to "${s.title}".`); save(); render(); } return; }
  if (d.secLimit !== undefined) { const s = secById(d.secLimit); s.pageLimit = parseFloat(t.value) || null; markUserEdit(s, `Set the page limit of ${s.num} to ${s.pageLimit || 'none'}.`); save(); render(); return; }
  if (d.reqType) { reqById(d.reqType).type = t.value; save(); render(); return; }
  if (d.reqResp) { reqById(d.reqResp).responseType = t.value; save(); render(); return; }
  if (d.mxStatus) { const m = p.matrix.find(x => x.reqId === d.mxStatus); m.status = t.value; m.locked = true; save(); return; }
  if (d.mode) { const [sid, i] = d.mode.split(':'); secById(sid).blockRefs[+i].mode = t.value; save(); return; }
  if (d.op) { const o = p.pending.ops.find(x => x.key === d.op); o.accept = t.checked; save(); renderMain(); return; }
  if (t.id === 'req-filter') { S.ui.reqFilter = t.value; renderMain(); return; }
  if (t.id === 'resp-type') { p.type = t.value; logChange('user', `Set the response type to ${t.options[t.selectedIndex].text}.`); save(); render(); return; }
  if (d.plan) { p.sourcePlan[d.plan] = t.checked; save(); renderMain(); return; }
  if (d.fileTier) { const f = fileById(d.fileTier); f.tier = t.value; for (const b of p.library) if (b.fileId === f.id) b.tier = t.value; save(); return; }
  if (d.pinTier !== undefined) { WS.data.sources.pinned[+d.pinTier].tier = t.value; for (const b of WS.pinnedBlocks) if (b.url === WS.data.sources.pinned[+d.pinTier].url) b.tier = t.value; saveWorkspace(); return; }
  if (t.id === 'ws-glean') { WS.data.sources.glean.enabled = t.checked; saveWorkspace(); return; }
});

/* Startup: reopen the project saved in this browser, or show the example. */
(async function start() {
  let saved = null;
  try { const raw = await idbGet('project'); if (raw) saved = JSON.parse(raw); } catch { saved = null; }
  S.project = saved && saved.sections ? saved : exampleProject();
  if (!S.project.sourcePlan) S.project.sourcePlan = { hints: '', glean: true, salesforce: true, figma: true };
  if (!S.project.type) S.project.type = 'rfp';
  numberSections();
  loadWorkspace();
  if (S.project.example) S.ui.step = 'canvas';
  render();
  window.addEventListener('resize', () => { if (S.ui.step === 'canvas') measurePages(); });
})();
