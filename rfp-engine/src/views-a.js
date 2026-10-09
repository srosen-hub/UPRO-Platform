// Screens: app bar, step rail, Inputs, Requirements, Format.

function renderBar() {
  const p = S.project; if (!p) return;
  const c = coverage();
  const pct = c.total ? Math.round(100 * c.mapped / c.total) : 0;
  const cls = !c.total ? '' : pct === 100 ? '' : pct >= 80 ? 'warn' : 'crit';
  const aiCls = AI.busy ? 'busy' : AI.state === 'on' ? 'on' : '';
  const aiTxt = AI.busy ? AI.busy : AI.state === 'on' ? 'Claude ready' : AI.state === 'connecting' ? 'Connecting' : 'AI off (open on claude.ai)';
  $('#bar').innerHTML = `
    <div class="brand"><span class="brand-mark">${ICON.logo}</span><span>RFP Engine</span></div>
    <input class="proj-name" id="proj-name" value="${esc(p.name)}" aria-label="Project name">
    ${p.example ? '<span class="pill warn">Example project</span>' : ''}
    <span class="bar-spacer"></span>
    <span class="meter" title="Mandatory requirements mapped to a section"><span class="tnum">${c.mapped}/${c.total} mandatory mapped</span><span class="meter-track"><span class="meter-fill ${cls}" style="width:${pct}%"></span></span></span>
    <span class="ai-dot ${aiCls}">${esc(aiTxt)}</span>
    <span class="hint" id="saved"></span>
    <button class="btn sm" data-act="new-project">New project</button>`;
}

function renderRail() {
  const p = S.project;
  const done = {
    inputs: p.files.some(f => f.role === 'rfp'),
    requirements: p.requirements.length > 0,
    format: p.sections.length > 0,
    outline: p.sections.length && p.sections.every(s => s.status !== 'empty'),
    draft: p.sections.length && p.sections.every(s => s.status === 'drafted'),
    canvas: false, export: false,
  };
  const meta = {
    inputs: p.files.length ? p.files.length + ' files' : '',
    requirements: p.requirements.length ? String(p.requirements.length) : '',
    format: p.sections.length ? String(p.sections.length) : '',
    outline: p.sections.length ? p.sections.filter(s => s.status !== 'empty').length + '/' + p.sections.length : '',
    draft: p.sections.length ? p.sections.filter(s => s.status === 'drafted').length + '/' + p.sections.length : '',
  };
  let html = '', group = '';
  for (const st of STEPS) {
    if (st.group !== group) { group = st.group; html += `<div class="rail-group">${group}</div>`; }
    html += `<button class="step ${S.ui.step === st.id ? 'on' : ''} ${done[st.id] ? 'done' : ''}" data-act="go" data-step="${st.id}"><span class="step-n">${done[st.id] ? '✓' : st.n}</span><span>${st.label}</span><span class="step-meta">${meta[st.id] || ''}</span></button>`;
  }
  html += '<div class="rail-group">Team</div>';
  for (const [id, label, n] of [['styleguide', 'Style guide', 'S'], ['sources', 'Sources', 'K'], ['templates', 'Templates', 'T']]) {
    html += `<button class="step ${S.ui.step === id ? 'on' : ''}" data-act="go" data-step="${id}"><span class="step-n">${n}</span><span>${label}</span><span class="step-meta">${id === 'sources' ? WS.data.sources.pinned.length || '' : ''}</span></button>`;
  }
  $('#rail').innerHTML = html;
}

function aiBanner() {
  if (AI.state === 'on') return '';
  if (AI.state === 'connecting') return `<div class="banner"><span class="grow">Connecting to Claude…</span></div>`;
  return `<div class="banner warn"><span class="grow"><b>AI steps are off.</b> They run through your Claude account when this page is open on claude.ai. You can still review, edit, lay out and export.</span></div>`;
}
function exampleBanner() {
  if (!S.project.example) return '';
  return `<div class="banner"><span class="grow"><b>This is an example project</b> (a made-up utility and vendor) so you can see every step filled in. Start a new project to load a real RFP and content library.</span><button class="btn sm primary" data-act="new-project">Start a new project</button></div>`;
}

/* Inputs */
function fileRow(f) {
  const ext = (f.ext || '').slice(0, 4);
  const meta = f.role === 'rfp'
    ? [f.docType && `<span class="pill acc">${esc(f.docType)}</span>`, f.processed ? `${f.reqCount} requirements` : '<span class="pill warn">Not read yet</span>', f.isChange && '<span class="pill crit">New client input</span>']
    : [`${f.blockCount || 0} passages`, tierSelect('data-file-tier', f.id, f.tier || 'approved')];
  return `<div class="file"><span class="file-ic ${esc(ext)}">${esc(ext.toUpperCase())}</span>
    <div style="min-width:0"><div class="file-name">${esc(f.name)}</div><div class="file-meta">${meta.filter(Boolean).join('<span class="faint">·</span>')}${f.pages && f.pages.length > 1 ? `<span class="faint">·</span>${f.pages.length} pages` : ''}</div></div>
    <button class="icon-btn" data-act="rm-file" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">${ICON.x}</button></div>`;
}

function tierSelect(attr, id, val) {
  return `<select class="select" ${attr}="${id}" style="width:auto;padding:1px 4px;font-size:11px" aria-label="Source tier">${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${t.short}</option>`).join('')}</select>`;
}

function viewInputs() {
  const p = S.project;
  const rfp = p.files.filter(f => f.role === 'rfp');
  const lib = p.files.filter(f => f.role === 'library');
  const unread = rfp.filter(f => !f.processed).length;
  const fig = p.figma || {};
  const figAssets = p.assets.filter(a => a.source === 'figma');
  const upAssets = p.assets.filter(a => a.source !== 'figma');
  const plan = p.sourcePlan || (p.sourcePlan = { hints: '', glean: true, salesforce: true, figma: true });
  const internal = p.library.filter(b => b.origin === 'glean');
  const pinnedN = (WS.pinnedBlocks || []).length;
  const kn = KN.state === 'on';
  const ctx = p.context;
  return `${exampleBanner()}${aiBanner()}
  <div class="head"><div><h1>Inputs</h1><p>Load the client's documents, tell the engine where your own knowledge lives, and pull in what the team already knows about this client. Uploading an addendum later runs it through the change review.</p></div>
    <div class="actions"><button class="btn primary" data-act="extract" ${!unread || AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} Extract requirements${unread ? ` (${unread})` : ''}</button></div></div>
  <div class="grid2">
    <section class="panel"><div class="panel-h"><h2>Client documents</h2>
      <select class="select" id="resp-type" style="width:auto" aria-label="Response type">${RESPONSE_TYPES.map(t => `<option value="${t.id}" ${p.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div class="panel-b stack-s">
        <div class="drop" data-drop="rfp" tabindex="0" role="button"><strong>Drop the client's files here or click to choose</strong>Instructions, scope, requirements, questionnaires, forms, addenda. PDF, Word, Excel, CSV or text.</div>
        <div class="files">${rfp.map(fileRow).join('') || '<p class="hint">No client files yet.</p>'}</div>
      </div></section>
    <section class="panel"><div class="panel-h"><h2>Content library</h2><span class="hint">${p.library.length} passages · ${internal.length} from internal tools${pinnedN ? ` · ${pinnedN} pinned team passages` : ''}</span></div>
      <div class="panel-b stack-s">
        <div class="drop" data-drop="library" tabindex="0" role="button"><strong>Upload library files</strong>Capability write-ups, case studies, past answers, bios. Set each file's trust level after upload.</div>
        <div class="files">${lib.map(fileRow).join('')}</div>
        <p class="label" style="margin-top:6px">Also look through</p>
        <label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-plan="glean" ${plan.glean ? 'checked' : ''}><span><b>Company search</b> <span class="hint">Drive, Confluence, Slack, email and meeting notes, through Glean</span></span></label>
        <label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-plan="salesforce" ${plan.salesforce ? 'checked' : ''}><span><b>Salesforce</b> <span class="hint">Opportunity, contacts and activity, for bid context</span></span></label>
        <label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-plan="figma" ${plan.figma ? 'checked' : ''}><span><b>Figma</b> <span class="hint">Product images from the team library</span></span></label>
        <div class="field"><label for="plan-hints">Where to look</label><textarea class="textarea" id="plan-hints" rows="3" placeholder="e.g. Past RFPs are in the 'RFP Response Examples' Drive folder. Product roadmap is in the Product Confluence space. Ignore anything before 2025.">${esc(plan.hints)}</textarea>
          <span class="hint">Plain language. Used for every search on this project, on top of the team's sources.</span></div>
        <div class="row"><button class="btn sm primary" data-act="find-sources" ${!kn || AI.state !== 'on' || !plan.glean ? 'disabled' : ''}>${ICON.spark} Find sources now</button>
          <button class="btn sm" data-act="tag-lib" ${AI.state !== 'on' || !p.library.some(b => !b.tags.length) ? 'disabled' : ''}>Tag untagged passages</button>
          <button class="btn sm ghost" data-act="go" data-step="library">Browse library</button></div>
        ${!kn ? `<p class="hint">${KN.state === 'connecting' ? 'Connecting to your tools…' : 'Internal tools work when this page is open on claude.ai with the connectors set up.'}</p>` : '<p class="hint">Sources are also found section by section when you build the outline.</p>'}
      </div></section>
    <section class="panel"><div class="panel-h"><h2>Product images from Figma</h2><span class="hint">${figAssets.length} frames${fig.syncedAt ? ' · synced ' + new Date(fig.syncedAt).toLocaleString() : ''}</span></div>
      <div class="panel-b stack-s">
        <p class="hint">Product visuals come only from the latest Figma library. Put each image in its own top-level frame on a library page, then link that page.</p>
        <div class="field"><label for="fig-url">Figma library link</label><input class="input" id="fig-url" placeholder="https://www.figma.com/design/…?node-id=…" value="${esc(fig.url || '')}"></div>
        <div class="row"><button class="btn sm primary" data-act="fig-sync" ${FIG.state !== 'on' || !plan.figma ? 'disabled' : ''}>Sync from Figma</button>
          ${FIG.state !== 'on' ? `<span class="hint">${FIG.state === 'connecting' ? 'Connecting…' : 'Available when this page is open on claude.ai with Figma connected.'}</span>` : ''}</div>
        ${figAssets.length ? `<div class="thumbs">${figAssets.slice(0, 12).map(a => `<div class="thumb">${a.thumb ? `<img src="${a.thumb}" alt="">` : '<img alt="">'}<div title="${esc(a.name)}">${a.stale ? '⚠ ' : ''}${esc(a.name)}</div></div>`).join('')}</div>` : ''}
        ${upAssets.length ? `<p class="hint">${plural(upAssets.length, 'other image')} from uploads or the example (non-product use only).</p>` : ''}
      </div></section>
    <section class="panel"><div class="panel-h"><h2>Bid context</h2>
      <button class="btn sm primary" data-act="pull-context" ${!kn || AI.state !== 'on' || (!plan.glean && !plan.salesforce) ? 'disabled' : ''}>${ICON.spark} Pull from Salesforce and notes</button></div>
      <div class="panel-b stack-s">
        <div class="field"><label for="ctx-client">Client</label><input class="input" id="ctx-client" data-ctx="client" value="${esc(ctx.client)}"></div>
        <div class="field"><label for="ctx-bidding">What we are bidding on</label><textarea class="textarea" id="ctx-bidding" data-ctx="bidding">${esc(ctx.bidding)}</textarea></div>
        <div class="field"><label for="ctx-win">Win themes</label><textarea class="textarea" id="ctx-win" data-ctx="winThemes">${esc(ctx.winThemes)}</textarea></div>
        <div class="field"><label for="ctx-notes">Notes on the client</label><textarea class="textarea" id="ctx-notes" data-ctx="notes" rows="5">${esc(ctx.notes)}</textarea><span class="hint">Internal only. Drafts use these for context and never quote them.</span></div>
        ${(ctx.stakeholders || []).length ? `<div><p class="label">Stakeholders</p>${ctx.stakeholders.map(s => `<div class="blockref"><b>${esc(s.name)}</b><span class="hint">${esc(s.title || '')}</span><span class="tag">${esc(s.role || '')}</span></div>`).join('')}</div>` : ''}
        ${(ctx.sources || []).length ? `<div><p class="label">Pulled from</p>${ctx.sources.map(s => `<div class="blockref"><span class="pill ${s.kind === 'salesforce' ? 'acc' : ''}">${s.kind === 'salesforce' ? 'Salesforce' : esc(s.datasource || 'Internal')}</span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}${s.updated ? `<span class="hint">${esc(String(s.updated).slice(0, 10))}</span>` : ''}</div>`).join('')}</div>` : ''}
      </div></section>
    <section class="panel" style="grid-column:1/-1"><div class="panel-h"><h2>House style</h2><button class="btn sm" data-act="go" data-step="styleguide">Open style guide</button></div>
      <div class="panel-b"><p class="hint">Every draft follows the team style guide: tone, writing rules, terminology, approved facts and banned phrases. The style check flags anything that reads as machine-written before export.</p></div></section>
  </div>`;
}

/* Team workspace pages */
function wsBanner() {
  const shared = WS.mode === 'shared';
  return `<div class="banner ${shared ? '' : 'warn'}"><span class="grow">${shared
    ? (WS.canEdit ? '<b>Team settings.</b> Changes here apply to every project and everyone this page is shared with.' : '<b>Team settings, read only.</b> Editors of this page maintain them.')
    : '<b>Saved in this browser only.</b> Open this page on claude.ai to share these settings with your team.'}</span></div>`;
}
function viewStyleGuide() {
  const g = sg(), ro = wsEditable() ? '' : 'readonly';
  const field = (k, label, rows, hint) => `<div class="field"><label for="sg-${k}">${label}</label><textarea class="textarea" id="sg-${k}" data-sg="${k}" rows="${rows}" ${ro}>${esc(g[k])}</textarea>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  return `${wsBanner()}
  <div class="head"><div><h1>Style guide</h1><p>Sent with every drafting request and checked before export. Import an existing guide or edit the fields directly.</p></div>
    <div class="actions"><button class="btn" data-act="sg-import-file" ${!wsEditable() || AI.state !== 'on' ? 'disabled' : ''}>Import from a file</button><button class="btn" data-act="sg-import-url" ${!wsEditable() || AI.state !== 'on' || KN.state !== 'on' ? 'disabled' : ''}>Import from a link</button><button class="btn ghost" data-act="style-reset" ${!wsEditable() ? 'disabled' : ''}>Reset to defaults</button></div></div>
  <div class="grid2">
    <section class="panel"><div class="panel-h"><h2>Voice</h2></div><div class="panel-b stack-s">
      ${field('tone', 'Tone', 3)}
      ${field('rules', 'Writing rules', 10, 'One rule per line.')}
      ${field('voiceSample', 'Sample of our own writing', 6, 'A few paragraphs from a winning response. Drafts match its rhythm and word choice.')}
    </div></section>
    <section class="panel"><div class="panel-h"><h2>Words and facts</h2></div><div class="panel-b stack-s">
      ${field('terminology', 'Terminology', 5, 'One per line: preferred term | terms to avoid, comma separated. The checker flags the avoided terms.')}
      ${field('facts', 'Approved facts and figures', 5, 'Customer counts, certifications, years in business. Drafts use these exact values.')}
      ${field('formatting', 'Formatting conventions', 4, 'Headings, numbers, dates, punctuation.')}
      ${field('banned', 'Banned words and phrases', 6, 'Comma separated. These read as machine-written and block export.')}
    </div></section>
  </div>`;
}
function viewSources() {
  const src = WS.data.sources, ro = !wsEditable();
  return `${wsBanner()}
  <div class="head"><div><h1>Knowledge sources</h1><p>Where the engine looks for content, and how far to trust each source. Pinned documents are read in full and searched first. Company search fills in the rest.</p></div>
    <div class="actions"><button class="btn primary" data-act="sync-pinned" ${KN.state !== 'on' || !src.pinned.length || ro ? 'disabled' : ''}>Sync pinned sources</button></div></div>
  <div class="grid-main">
    <section class="panel"><div class="panel-h"><h2>Pinned documents</h2><button class="btn sm" data-act="pin-add" ${ro ? 'disabled' : ''}>${ICON.plus} Add</button></div>
      <div class="panel-b">${src.pinned.map((x, i) => `<div class="blockref" style="flex-wrap:wrap">
        <input class="input" data-pin-url="${i}" value="${esc(x.url)}" placeholder="Link to a Drive doc, Confluence page or folder" style="flex:1;min-width:220px" ${ro ? 'readonly' : ''}>
        ${tierSelect('data-pin-tier', i, x.tier)}
        <button class="icon-btn" data-act="pin-rm" data-i="${i}" aria-label="Remove" ${ro ? 'disabled' : ''}>${ICON.x}</button>
        <div class="hint" style="flex-basis:100%">${x.title ? esc(x.title) + ' · ' : ''}${x.syncedAt ? 'synced ' + new Date(x.syncedAt).toLocaleDateString() : 'not synced yet'}${x.updated ? ' · source updated ' + esc(String(x.updated).slice(0, 10)) : ''}</div></div>`).join('') || '<p class="hint">Pin your RFP library, approved boilerplate, product roadmap and positioning docs here.</p>'}
        <p class="hint" style="margin-top:8px">${plural((WS.pinnedBlocks || []).length, "passage")} cached from pinned documents.</p></div></section>
    <div class="stack">
      <section class="panel"><div class="panel-h"><h2>Company search</h2></div><div class="panel-b stack-s">
        <label class="row"><input type="checkbox" id="ws-glean" ${src.glean.enabled ? 'checked' : ''} ${ro ? 'disabled' : ''}> Search internal tools through Glean</label>
        <div class="field"><label for="ws-recency">Prefer sources updated in the last</label><div class="row"><input class="input" id="ws-recency" value="${src.glean.recencyMonths}" style="width:70px" inputmode="numeric" ${ro ? 'readonly' : ''}> months</div></div>
        <div class="field"><label for="ws-hints">Where things live</label><textarea class="textarea" id="ws-hints" rows="4" ${ro ? 'readonly' : ''} placeholder="e.g. Approved answers are in the Proposal Library Drive folder. Roadmaps live in the Product Confluence space.">${esc(src.glean.hints)}</textarea></div>
      </div></section>
      <section class="panel"><div class="panel-h"><h2>Trust tiers</h2></div><div class="panel-b stack-s">
        ${Object.values(TIERS).map(t => `<div><b>${t.label}</b><div class="hint">${esc(t.use)}</div></div>`).join('')}
      </div></section>
    </div>
  </div>`;
}
function viewTemplates() {
  const ro = wsEditable() ? '' : 'readonly';
  return `${wsBanner()}
  <div class="head"><div><h1>Templates</h1><p>The structure used when a client does not mandate one. One section per line; indent with two spaces for a sub-section.</p></div></div>
  <div class="grid2">${RESPONSE_TYPES.map(t => `<section class="panel"><div class="panel-h"><h2>${t.label}</h2></div><div class="panel-b"><textarea class="textarea mono" data-tpl="${t.id}" rows="10" ${ro}>${esc(WS.data.templates[t.id] || '')}</textarea></div></section>`).join('')}</div>`;
}

/* Library browser (reached from Inputs) */
function viewLibrary() {
  const p = S.project;
  const q = (S.ui.libQuery || '').toLowerCase();
  const items = allBlocks().filter(b => !q || (b.title + ' ' + b.text + ' ' + b.tags.join(' ')).toLowerCase().includes(q));
  return `<div class="head"><div><h1>Content library</h1><p>${p.library.length} text blocks and ${p.assets.length} images. Tags drive retrieval: the engine filters by topic first, then matches on the requirement text.</p></div>
    <div class="actions"><input class="input" id="lib-q" placeholder="Search blocks" value="${esc(S.ui.libQuery || '')}" style="width:220px"><button class="btn" data-act="go" data-step="inputs">Back to inputs</button></div></div>
  <div class="grid2">
    <section class="panel"><div class="panel-h"><h2>Text blocks</h2><span class="hint">${items.length} shown</span></div><div class="panel-b">
      ${items.slice(0, 200).map(b => `<div class="lib-item"><div class="row"><span class="rid" data-act="src" data-t="lib" data-id="${b.id}">${b.id}</span><h4>${esc(b.title)}</h4></div>
        <p>${esc(b.summary || b.text.slice(0, 240))}</p>
        <div class="row" style="margin-top:4px"><span class="pill ${b.tier === 'internal' ? 'warn' : b.tier === 'product' ? 'acc' : ''}">${(TIERS[b.tier || 'approved'] || TIERS.reference).short}</span>${b.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}<span class="hint">${esc(b.fileName)} · ${esc(b.loc)}${b.updated ? ' · ' + esc(String(b.updated).slice(0, 10)) : ''}</span></div></div>`).join('') || '<p class="hint">No blocks match.</p>'}
    </div></section>
    <section class="panel"><div class="panel-h"><h2>Images</h2></div><div class="panel-b">
      <div class="thumbs">${p.assets.map(a => `<div class="thumb"><img src="${a.thumb || a.dataUrl || ''}" alt=""><div title="${esc(a.caption || a.name)}"><span class="pill ${a.source === 'figma' ? 'acc' : ''}">${a.source === 'figma' ? 'Figma' : a.source === 'example' ? 'Example' : 'Upload'}</span> ${esc(a.caption || a.name)}</div></div>`).join('') || '<p class="hint">No images yet.</p>'}</div>
    </div></section>
  </div>`;
}

/* Requirements */
function viewRequirements() {
  const p = S.project;
  const c = coverage();
  const f = S.ui.reqFilter, q = S.ui.reqQuery.toLowerCase();
  const unmappedIds = new Set(c.unmapped.map(r => r.id));
  const rows = p.requirements.filter(r =>
    (f === 'all' || (f === 'mandatory' && r.mandatory) || (f === 'unmapped' && unmappedIds.has(r.id)) || r.type === f) &&
    (!q || (r.id + ' ' + r.text + ' ' + r.section).toLowerCase().includes(q)));
  const byType = REQ_TYPES.map(t => [t, p.requirements.filter(r => r.type === t).length]).filter(x => x[1]);
  const matrixRows = p.requirements.filter(r => r.responseType === 'compliance-matrix' || r.responseType === 'yes/no');
  if (!p.requirements.length) return `${aiBanner()}<div class="head"><div><h1>Requirements</h1></div></div><div class="panel empty"><h3>No requirements yet</h3><p>Add the client's RFP files on the Inputs step, then extract requirements.</p><p style="margin-top:12px"><button class="btn primary" data-act="go" data-step="inputs">Go to inputs</button></p></div>`;
  return `${exampleBanner()}${aiBanner()}
  <div class="head"><div><h1>Requirements</h1><p>Every requirement pulled from the RFP package, with its source. Fix types and mandatory flags here; the format and drafts follow from this list.</p></div>
    <div class="actions"><button class="btn" data-act="add-req">${ICON.plus} Add requirement</button><button class="btn primary" data-act="recommend" ${AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} ${p.sections.length ? 'Re-recommend format' : 'Recommend format'}</button></div></div>
  <div class="grid2" style="margin-bottom:16px">
    <section class="panel"><div class="panel-h"><h2>Summary</h2></div><div class="panel-b cov">
      <div><div class="cov-n">${p.requirements.length}</div><div class="hint">requirements</div></div>
      <div><div class="cov-n">${p.requirements.filter(r => r.mandatory).length}</div><div class="hint">mandatory</div></div>
      <div><div class="cov-n" style="color:${c.unmapped.length ? 'var(--crit)' : 'var(--ok)'}">${c.unmapped.length}</div><div class="hint">mandatory not mapped</div></div>
      <div style="flex-basis:100%" class="row">${byType.map(([t, n]) => `<span class="tag">${t} ${n}</span>`).join('')}</div>
    </div></section>
    <section class="panel"><div class="panel-h"><h2>Client objectives</h2><button class="btn sm ghost" data-act="add-obj">${ICON.plus} Add</button></div><div class="panel-b stack-s">
      ${p.objectives.map((o, i) => `<div class="row" style="flex-wrap:nowrap"><span class="mono faint">${i + 1}</span><input class="input" data-obj="${i}" value="${esc(o)}"><button class="icon-btn" data-act="rm-obj" data-i="${i}" aria-label="Remove objective">${ICON.x}</button></div>`).join('') || '<p class="hint">Objectives are proposed with the format. You can edit them.</p>'}
      ${p.topics.length ? `<div class="row">${p.topics.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div></section>
    <section class="panel"><div class="panel-h"><h2>Format rules found</h2></div><div class="panel-b">
      ${Object.keys(p.formatRules).length ? `<dl class="kv">${Object.entries(p.formatRules).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : v)}</dd>`).join('')}</dl>` : '<p class="hint">None found yet.</p>'}
      ${(p.keyDates || []).length ? `<p class="label" style="margin-top:12px">Key dates</p><dl class="kv">${p.keyDates.map(d => `<dt>${esc(d.label)}</dt><dd>${esc(d.date)}</dd>`).join('')}</dl>` : ''}
    </div></section>
  </div>
  <section class="panel">
    <div class="panel-h"><div class="row">
      <select class="select" id="req-filter" style="width:auto">${[['all', 'All'], ['mandatory', 'Mandatory'], ['unmapped', 'Mandatory, not mapped']].concat(REQ_TYPES.map(t => [t, 'Type: ' + t])).map(([v, l]) => `<option value="${v}" ${f === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input class="input" id="req-q" placeholder="Search" value="${esc(S.ui.reqQuery)}" style="width:200px"></div>
      <span class="hint">${rows.length} shown</span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Requirement</th><th>Type</th><th>M/O</th><th>Response</th><th>Mapped to</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="${unmappedIds.has(r.id) ? 'unmapped' : ''}">
      <td><span class="rid" data-act="src" data-t="req" data-id="${r.id}">${r.id}</span></td>
      <td class="txt"><div contenteditable="true" data-req-text="${r.id}">${esc(r.text)}</div><div class="hint">${esc(r.fileName || 'Added manually')}${r.page ? ' · p. ' + esc(r.page) : ''}${r.section ? ' · §' + esc(r.section) : ''}${r.weight ? ' · weight ' + esc(r.weight) : ''}${r.fromChange ? ' · <b>from client change</b>' : ''}</div></td>
      <td><select class="select" data-req-type="${r.id}" style="width:auto">${REQ_TYPES.map(t => `<option ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><button class="pill ${r.mandatory ? 'm' : ''}" data-act="toggle-m" data-id="${r.id}">${r.mandatory ? 'Mandatory' : 'Optional'}</button></td>
      <td><select class="select" data-req-resp="${r.id}" style="width:auto">${RESP_TYPES.map(t => `<option ${r.responseType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td>${reqSections(r.id).map(s => `<span class="tag">${esc(s.num)} ${esc(s.title.slice(0, 26))}</span>`).join(' ') || '<span class="faint">None</span>'}</td>
      <td><button class="icon-btn" data-act="rm-req" data-id="${r.id}" aria-label="Delete requirement">${ICON.x}</button></td></tr>`).join('')}
    </tbody></table></div>
  </section>
  ${matrixRows.length ? viewMatrix(matrixRows) : ''}`;
}

function viewMatrix(rows) {
  const p = S.project;
  return `<section class="panel" style="margin-top:16px"><div class="panel-h"><h2>Requirements matrix answers</h2>
    <div class="row"><span class="hint">${rows.length} rows · low confidence first</span><button class="btn sm primary" data-act="matrix" ${AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} Answer rows</button></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Requirement</th><th>Status</th><th>Comment</th><th>Sources</th><th>Confidence</th></tr></thead><tbody>
    ${rows.map(r => ({ r, m: p.matrix.find(x => x.reqId === r.id) })).sort((a, b) => ({ low: 0, medium: 1, high: 2, undefined: -1 }[a.m && a.m.confidence] - { low: 0, medium: 1, high: 2, undefined: -1 }[b.m && b.m.confidence])).map(({ r, m }) => `<tr>
      <td><span class="rid" data-act="src" data-t="req" data-id="${r.id}">${r.id}</span></td>
      <td class="txt">${esc(r.text.slice(0, 220))}</td>
      <td>${m ? `<select class="select" data-mx-status="${r.id}" style="width:auto">${['Comply', 'Partial', 'Roadmap', 'Does not comply', 'Needs input'].map(s => `<option ${m.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : '<span class="faint">Not answered</span>'}</td>
      <td class="txt">${m ? `<div contenteditable="true" data-mx-comment="${r.id}">${esc(m.comment)}</div>` : ''}</td>
      <td>${m ? m.sources.map(id => `<span class="rid" data-act="src" data-t="lib" data-id="${id}">${id}</span>`).join(' ') : ''}</td>
      <td>${m ? `<span class="pill ${m.confidence === 'high' ? 'ok' : m.confidence === 'medium' ? 'warn' : 'crit'}">${m.confidence}</span>` : ''}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}

/* Format */
function viewFormat() {
  const p = S.project;
  numberSections();
  const c = coverage();
  if (!p.sections.length) return `${aiBanner()}<div class="head"><div><h1>Format</h1></div></div><div class="panel empty"><h3>No format yet</h3><p>Once requirements are extracted, the engine recommends a structure: the RFP's mandated order first, then the evaluation criteria, then a standard layout.</p><p style="margin-top:12px"><button class="btn primary" data-act="recommend" ${AI.state !== 'on' || !p.requirements.length ? 'disabled' : ''}>${ICON.spark} Recommend format</button> <button class="btn" data-act="add-sec">${ICON.plus} Start from scratch</button></p></div>`;
  const basis = { 'rfp-mandated': 'Mirrors the structure the RFP mandates', 'evaluation-criteria': 'Ordered by the evaluation criteria', default: 'Standard structure (the RFP sets none)' }[p.formatBasis] || '';
  const pend = p.pending;
  return `${exampleBanner()}${aiBanner()}
  <div class="head"><div><h1>Format</h1><p>${esc(basis)}${p.basisNote ? '. ' + esc(p.basisNote) : ''} Drag to reorder, rename in place, or describe a change in plain language. Client input outranks your edits, and your edits outrank the engine.</p></div>
    <div class="actions"><button class="btn" data-act="add-sec">${ICON.plus} Add section</button></div></div>
  ${pend ? viewPending(pend) : ''}
  ${c.unmapped.length ? `<div class="banner crit"><span class="grow"><b>${plural(c.unmapped.length, 'mandatory requirement')} not mapped to any section.</b> ${c.unmapped.slice(0, 6).map(r => `<span class="rid" data-act="src" data-t="req" data-id="${r.id}">${r.id}</span>`).join(' ')}${c.unmapped.length > 6 ? ' …' : ''}</span>
    <select class="select" id="map-sec" style="width:auto">${p.sections.map(s => `<option value="${s.id}">${esc(s.num)} ${esc(s.title)}</option>`).join('')}</select><button class="btn sm" data-act="map-unmapped">Map all to this section</button></div>` : ''}
  ${p.risks.length ? `<div class="banner warn"><span class="grow"><b>Compliance risks:</b> you kept your version over ${plural(p.risks.length, 'client-mandated change')}. ${p.risks.slice(0, 3).map(r => esc(r.text)).join('; ')}</span><button class="btn sm" data-act="clear-risks">Clear</button></div>` : ''}
  <div class="grid-main">
    <section class="panel"><div class="panel-h"><h2>Response structure</h2><span class="hint">${p.sections.length} sections${p.formatRules.pageLimit ? ' · overall limit ' + esc(p.formatRules.pageLimit) + ' pages' : ''}</span></div>
      <div class="tree" id="tree">${p.sections.map(secRow).join('')}</div></section>
    <div class="stack">
      <section class="panel"><div class="panel-h"><h2>Change the format</h2></div><div class="panel-b stack-s">
        <textarea class="textarea" id="fmt-instr" placeholder="e.g. Put security in its own volume. The client said 20 pages max on the call."></textarea>
        <div class="row"><button class="btn primary sm" data-act="fmt-change" ${AI.state !== 'on' ? 'disabled' : ''}>${ICON.spark} Propose changes</button><span class="hint">You review each change before it applies.</span></div>
        <p class="hint">New client documents (addenda, Q&amp;A) go on the Inputs step. They are read with client precedence.</p>
      </div></section>
      <section class="panel"><div class="panel-h"><h2>Change log</h2></div><div class="panel-b log"><ul>
        ${p.changeLog.slice(0, 30).map(l => `<li><span class="change-src ${l.source}">${l.source}</span> ${esc(l.text)} <span class="faint">${new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></li>`).join('') || '<li class="hint">No changes yet.</li>'}
      </ul></div></section>
    </div>
  </div>`;
}

function secRow(s) {
  const reqs = s.reqIds.map(reqById).filter(Boolean);
  const m = reqs.filter(r => r.mandatory).length;
  const originLabel = { rfp: 'RFP', criteria: 'Criteria', default: 'Standard', user: 'Added' }[s.origin] || s.origin;
  return `<div class="sec ${s.level === 2 ? 'l2' : ''}" draggable="true" data-sec="${s.id}">
    <span class="grip" aria-hidden="true">${ICON.grip}</span>
    <span class="sec-num">${esc(s.num)}</span>
    <div style="min-width:0"><input class="sec-title" data-sec-title="${s.id}" value="${esc(s.title)}" aria-label="Section title">
      <div class="sec-meta"><span class="pill ${s.origin === 'rfp' ? 'crit' : s.origin === 'criteria' ? 'warn' : ''}">${originLabel}</span>${s.userEdited ? '<span class="pill acc">Edited by you</span>' : ''}
        <span class="hint">${reqs.length} req${reqs.length === 1 ? '' : 's'}${m ? ` (${m} mandatory)` : ''}</span>
        ${reqs.slice(0, 5).map(r => `<span class="rid" data-act="src" data-t="req" data-id="${r.id}">${r.id}</span>`).join('')}${reqs.length > 5 ? '<span class="hint">…</span>' : ''}
        <label class="hint">Pages <input class="input" data-sec-limit="${s.id}" value="${s.pageLimit || ''}" style="width:48px;padding:1px 4px" inputmode="numeric"></label>
        <button class="btn sm ghost" data-act="sec-reqs" data-id="${s.id}">Edit mapping</button>
      </div>
      ${s.guidance ? `<div class="hint" style="padding-left:4px;margin-top:2px">${esc(s.guidance)}</div>` : ''}</div>
    <div class="sec-tools">
      <button class="icon-btn" data-act="sec-level" data-id="${s.id}" title="${s.level === 1 ? 'Indent' : 'Outdent'}" aria-label="${s.level === 1 ? 'Indent' : 'Outdent'}">${s.level === 1 ? ICON.indent : ICON.outdent}</button>
      <button class="icon-btn" data-act="sec-merge" data-id="${s.id}" title="Merge with next" aria-label="Merge with next">${ICON.merge}</button>
      <button class="icon-btn" data-act="sec-add-after" data-id="${s.id}" title="Add section below" aria-label="Add section below">${ICON.plus}</button>
      <button class="icon-btn" data-act="sec-rm" data-id="${s.id}" title="Delete" aria-label="Delete section">${ICON.x}</button>
    </div></div>`;
}

function viewPending(pend) {
  const src = pend.source;
  return `<section class="panel" style="margin-bottom:16px;border-color:var(--accent)"><div class="panel-h"><h2>Review proposed changes</h2><span class="change-src ${src}">${src === 'client' ? 'Client input' : 'Your instruction'}</span></div>
    <div class="panel-b">${pend.summary ? `<p style="margin-bottom:8px">${esc(pend.summary)}</p>` : ''}
    ${pend.ops.map(o => `<div class="change"><input type="checkbox" id="op-${o.key}" data-op="${o.key}" ${o.accept ? 'checked' : ''}>
      <label for="op-${o.key}"><b>${esc(describeOp(o))}</b>${o.reason ? `<div class="hint">${esc(o.reason)}</div>` : ''}
      <div class="row" style="margin-top:4px">${o.overridesUser ? '<span class="pill crit">Overrides your edit</span>' : ''}${o.conflictsWithClient ? '<span class="pill crit">Conflicts with client rule</span>' : ''}${src === 'client' && !o.accept ? '<span class="pill warn">Will be logged as a compliance risk</span>' : ''}</div></label></div>`).join('') || '<p class="hint">No changes needed.</p>'}
    </div><div class="modal-f"><button class="btn" data-act="pend-discard">Discard</button><button class="btn primary" data-act="pend-apply">Apply selected</button></div></section>`;
}
