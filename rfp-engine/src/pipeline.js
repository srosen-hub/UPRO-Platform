// The engine's steps: ingest, extract, recommend format, apply format ops, outline, draft, matrix.

async function addFiles(fileList, role) {
  const p = S.project;
  const added = [];
  for (const file of fileList) {
    try {
      toast(`Reading ${file.name}…`, { sticky: true });
      const parsed = await readAny(file);
      if (parsed.kind === 'image') {
        // Uploaded images are allowed for non-product visuals (photos, maps, org charts).
        p.assets.push({ id: 'A-' + String(p.assets.length + 1).padStart(3, '0'), source: 'upload', name: file.name, caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), tags: [], dataUrl: parsed.dataUrl, thumb: parsed.dataUrl });
        added.push(file.name);
        continue;
      }
      const f = { id: uid('f'), name: file.name, ext: parsed.ext, role, size: file.size, text: parsed.text, pages: parsed.pages.map(pg => ({ n: pg.n, text: pg.text })), addedAt: Date.now(), processed: false, docType: '', reqCount: 0 };
      if (parsed.sheets) f.sheets = parsed.sheets.map(s => ({ name: s.name, rows: s.rows.slice(0, 2000) }));
      p.files.push(f);
      if (parsed.ext === 'pdf') await keepBytes(f.id, parsed.buf);
      if (role === 'library') {
        const blocks = splitLibrary(f, parsed);
        p.library.push(...blocks);
        f.blockCount = blocks.length;
        for (const im of parsed.images || []) {
          p.assets.push({ id: 'A-' + String(p.assets.length + 1).padStart(3, '0'), source: 'upload', name: `${file.name} image ${im.idx + 1}`, caption: im.alt || im.heading || file.name, tags: [], dataUrl: im.dataUrl, thumb: im.dataUrl, fileName: file.name });
        }
      } else if (p.sections.length) {
        f.isChange = true; // new client input after the format exists
      }
      added.push(file.name);
    } catch (e) {
      toast(e.message, { err: true });
      await sleep(1500);
    }
  }
  toast(added.length ? `Added ${plural(added.length, 'file')}.` : '');
  save();
  render();
  if (role === 'library' && added.length && AI.sample) tagLibrary().catch(e => toast(e.message, { err: true }));
}

async function tagLibrary() {
  const p = S.project;
  const todo = p.library.filter(b => !b.tags.length);
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const known = [...new Set(p.library.flatMap(b => b.tags))].slice(0, 80);
    const res = await askJSON(promptTag(batch, known), { label: `Tagging library blocks ${i + 1}–${Math.min(i + 20, todo.length)} of ${todo.length}`, tier: 'quick' });
    for (const r of (res && res.blocks) || []) {
      const b = blockById(r.id);
      if (b) { b.tags = (r.tags || []).map(t => String(t).toLowerCase()).slice(0, 6); b.summary = r.summary || ''; }
    }
    save(); renderMain();
  }
  const imgs = p.assets.filter(a => !(a.tags || []).length);
  if (imgs.length) {
    const known = [...new Set(p.library.flatMap(b => b.tags))].slice(0, 80);
    const res = await askJSON(promptTagImages(imgs.slice(0, 60), known), { label: 'Tagging images', tier: 'quick' });
    for (const r of (res && res.assets) || []) { const a = assetById(r.id); if (a) { a.tags = r.tags || []; if (r.caption && a.source === 'upload') a.caption = r.caption; } }
    save(); renderMain();
  }
}

async function extractRequirements() {
  const p = S.project;
  const files = p.files.filter(f => f.role === 'rfp' && !f.processed);
  if (!files.length) { toast('All RFP files are already processed.'); return; }
  const newReqs = [];
  p.mandated = p.mandated || []; p.criteria = p.criteria || []; p.keyDates = p.keyDates || [];
  for (const f of files) {
    const chunks = chunkText(f.text);
    for (let ci = 0; ci < chunks.length; ci++) {
      const res = await askJSON(promptExtract(f, chunks[ci], ci, chunks.length), { label: `Reading ${f.name}${chunks.length > 1 ? ` (part ${ci + 1} of ${chunks.length})` : ''}` });
      if (!res) continue;
      if (res.docType && !f.docType) f.docType = res.docType;
      for (const r of res.requirements || []) {
        if (!r.text) continue;
        const req = {
          id: nextReqId(), text: String(r.text).trim(), fileId: f.id, fileName: f.name, page: String(r.page || ''), section: String(r.section || ''),
          type: REQ_TYPES.includes(r.type) ? r.type : 'functional', mandatory: !!r.mandatory, weight: String(r.weight || ''),
          responseType: RESP_TYPES.includes(r.responseType) ? r.responseType : 'narrative', fromChange: !!f.isChange,
        };
        p.requirements.push(req); newReqs.push(req);
      }
      Object.assign(p.formatRules, res.formatRules || {});
      if ((res.mandatedStructure || []).length) p.mandated.push(...res.mandatedStructure);
      if ((res.evaluationCriteria || []).length) p.criteria.push(...res.evaluationCriteria);
      if ((res.keyDates || []).length) p.keyDates.push(...res.keyDates);
      save(); renderMain();
    }
    f.processed = true;
    f.reqCount = p.requirements.filter(r => r.fileId === f.id).length;
  }
  logChange('engine', `Extracted ${newReqs.length} requirements from ${plural(files.length, 'file')}.`);
  save();
  // New client input after the format exists goes through the change review, with client precedence.
  const changed = newReqs.filter(r => r.fromChange);
  if (changed.length && p.sections.length) {
    toast(`${plural(changed.length, 'new requirement')} from client input. Review the format changes.`);
    S.ui.step = 'format';
    render();
    await proposeFormatChange({ source: 'client', newReqs: changed, instruction: files.filter(f => f.isChange).map(f => f.name).join(', ') });
  }
}

async function recommendFormat() {
  const p = S.project;
  if (!p.requirements.length) throw new Error('Extract requirements first.');
  const res = await askJSON(promptFormat(p), { label: 'Recommending the response format', tier: 'complex' });
  if (!res || !Array.isArray(res.sections)) throw new Error('No format came back. Try again.');
  p.objectives = (res.objectives || []).slice(0, 5);
  p.topics = res.topics || [];
  p.formatBasis = res.formatBasis || 'default';
  p.basisNote = res.basisNote || '';
  // Keep the user's own sections and edits when re-recommending: generated sections are replaced, user ones stay.
  const userSecs = p.sections.filter(s => s.userEdited);
  const fresh = res.sections.map(s => newSection({ title: s.title, level: s.level, origin: s.origin || 'default', reqIds: (s.reqIds || []).filter(reqById), pageLimit: s.pageLimit, guidance: s.guidance, summarizes: s.summarizes, fixedNum: s.fixedNum }));
  for (const s of fresh) s.userEdited = false;
  p.sections = fresh.concat(userSecs.filter(u => !fresh.some(f => f.title.toLowerCase() === u.title.toLowerCase())));
  numberSections();
  logChange('engine', `Recommended a ${p.sections.length}-section format (${p.formatBasis.replace('-', ' ')}).`);
  save();
}

async function proposeFormatChange({ source, instruction = '', newReqs = [] }) {
  const p = S.project;
  numberSections();
  const res = await askJSON(promptFormatChange(p, { source, instruction, newReqs }), { label: source === 'client' ? 'Working out format changes from client input' : 'Working out the format change' });
  const ops = ((res && res.ops) || []).map(o => Object.assign({ key: uid('op'), source, accept: true }, o));
  // Engine-sourced ops never touch user-edited sections. Client ops may, and say so.
  for (const o of ops) {
    const target = o.id && secById(o.id);
    if (source === 'client' && target && target.userEdited) o.overridesUser = true;
  }
  p.pending = { source, summary: (res && res.summary) || '', ops, instruction, at: Date.now() };
  save();
  render();
}

function describeOp(o) {
  const t = id => { const s = secById(id); return s ? `${s.num} ${s.title}` : id; };
  switch (o.op) {
    case 'add': return `Add "${o.title}"${o.after ? ' after ' + t(o.after) : ' at the top'}${(o.reqIds || []).length ? ', mapped to ' + o.reqIds.join(', ') : ''}`;
    case 'remove': return `Remove ${t(o.id)}`;
    case 'rename': return `Rename ${t(o.id)} to "${o.title}"`;
    case 'move': return `Move ${t(o.id)}${o.after ? ' after ' + t(o.after) : ' to the top'}`;
    case 'merge': return `Merge ${(o.ids || []).map(t).join(' + ')} into "${o.title}"`;
    case 'split': return `Split ${t(o.id)} into ${(o.into || []).map(x => '"' + x.title + '"').join(', ')}`;
    case 'map': return `Map ${(o.reqIds || []).join(', ') || 'no requirements'} to ${t(o.id)}`;
    case 'limit': return `Set page limit of ${t(o.id)} to ${o.pageLimit || 'none'}`;
    case 'level': return `Make ${t(o.id)} a level ${o.level} section`;
    case 'rule': return `Set format rule ${o.key} to ${JSON.stringify(o.value)}`;
    default: return JSON.stringify(o);
  }
}

function applyOp(o) {
  const p = S.project;
  const idx = id => p.sections.findIndex(s => s.id === id);
  const insertAfter = (sec, after) => { const i = after ? idx(after) : -1; p.sections.splice(i + 1, 0, sec); };
  const mark = s => { if (s && o.source === 'user') s.userEdited = true; };
  switch (o.op) {
    case 'add': { const s = newSection({ title: o.title, level: o.level, origin: o.source === 'client' ? 'rfp' : 'user', reqIds: (o.reqIds || []).filter(reqById), pageLimit: o.pageLimit, guidance: o.guidance }); s.userEdited = o.source === 'user'; insertAfter(s, o.after); break; }
    case 'remove': { const i = idx(o.id); if (i >= 0) p.sections.splice(i, 1); break; }
    case 'rename': { const s = secById(o.id); if (s) { s.title = o.title; mark(s); } break; }
    case 'move': { const i = idx(o.id); if (i >= 0) { const [s] = p.sections.splice(i, 1); insertAfter(s, o.after); mark(s); } break; }
    case 'merge': {
      const secs = (o.ids || []).map(secById).filter(Boolean);
      if (secs.length < 2) break;
      const keep = secs[0];
      keep.title = o.title || keep.title;
      for (const s of secs.slice(1)) { keep.reqIds = [...new Set(keep.reqIds.concat(s.reqIds))]; keep.blocks = keep.blocks.concat(s.blocks); keep.keyPoints = keep.keyPoints.concat(s.keyPoints); p.sections.splice(idx(s.id), 1); }
      mark(keep); break;
    }
    case 'split': {
      const s = secById(o.id); if (!s) break;
      let after = s.id;
      (o.into || []).forEach((part, i) => {
        if (i === 0) { s.title = part.title; s.reqIds = (part.reqIds || s.reqIds).filter(reqById); mark(s); return; }
        const n = newSection({ title: part.title, level: s.level, origin: s.origin, reqIds: (part.reqIds || []).filter(reqById) });
        n.userEdited = o.source === 'user';
        insertAfter(n, after); after = n.id;
      });
      break;
    }
    case 'map': { const s = secById(o.id); if (s) { s.reqIds = (o.reqIds || []).filter(reqById); mark(s); } break; }
    case 'limit': { const s = secById(o.id); if (s) { s.pageLimit = o.pageLimit || null; mark(s); } break; }
    case 'level': { const s = secById(o.id); if (s) { s.level = o.level === 2 ? 2 : 1; mark(s); } break; }
    case 'rule': { if (o.key) p.formatRules[o.key] = o.value; break; }
  }
}

function applyPending() {
  const p = S.project;
  const pend = p.pending;
  if (!pend) return;
  const descs = pend.ops.map(o => ({ o, d: describeOp(o) }));
  for (const { o, d } of descs) {
    if (o.accept) {
      applyOp(o);
      logChange(o.source, d + (o.overridesUser ? ' (overrides your earlier edit)' : '') + (o.reason ? `. ${o.reason}` : ''));
    } else if (o.source === 'client') {
      // A rejected client-mandated change stays visible as a compliance risk.
      p.risks.unshift({ id: uid('risk'), text: d, reason: o.reason || '', at: Date.now() });
      logChange('user', `Kept your version instead of: ${d}. Flagged as a compliance risk.`);
    }
  }
  p.pending = null;
  for (const f of p.files) f.isChange = false;
  numberSections();
  save();
}

/* Outline */
async function outlineSection(sec) {
  const p = S.project;
  const q = sectionQuery(sec) + ' ' + p.topics.join(' ');
  const cands = retrieve(q, { k: 10, tags: p.topics });
  const imgs = retrieveImages(q, 8);
  if (imgs.length < 4) for (const a of p.assets) { if (imgs.length >= 8) break; if (!imgs.includes(a)) imgs.push(a); }
  const res = await askJSON(promptOutline(p, sec, cands, imgs), { label: `Outlining ${sec.num} ${sec.title}` });
  if (!res) return;
  sec.keyPoints = res.keyPoints || [];
  sec.blockRefs = (res.blocks || []).filter(b => blockById(b.id)).map(b => ({ id: b.id, reason: b.reason || '', mode: MODES.includes(b.mode) ? b.mode : 'tailored' }));
  sec.gaps = (res.gaps || []).map(g => ({ text: g.text || String(g), owner: g.owner || '' }));
  sec.visuals = (res.visuals || []).map(v => ({ assetId: v.assetId && assetById(v.assetId) ? v.assetId : null, need: v.need || '', reason: v.reason || '' }));
  sec.tables = (res.tables || []).map(t => ({ kind: t.kind || 'custom', title: t.title || 'Table', reason: t.reason || '' }));
  if (sec.status === 'empty') sec.status = 'outlined';
  save();
}

async function outlineAll() {
  for (const s of S.project.sections) {
    await outlineSection(s);
    renderMain();
  }
}

/* Drafting */
function draftOrder() {
  const secs = S.project.sections;
  return secs.filter(s => !s.summarizes).concat(secs.filter(s => s.summarizes));
}

async function draftSection(sec) {
  const p = S.project;
  if (!sec.keyPoints.length && !sec.blockRefs.length) await outlineSection(sec);
  const chosen = [], verbatim = [];
  for (const r of sec.blockRefs) {
    const b = blockById(r.id); if (!b) continue;
    if (r.mode === 'verbatim') verbatim.push(b); else chosen.push(Object.assign({}, b, { _mode: r.mode }));
  }
  let others = '';
  if (sec.summarizes) {
    others = p.sections.filter(s => s !== sec && s.blocks.length)
      .map(s => `${s.num} ${s.title}: ${s.blocks.filter(b => b.type === 'text').map(b => htmlToText(b.html)).join(' ').slice(0, 450)}`).join('\n');
  }
  const prompt = promptDraft(p, sec, chosen, verbatim, others) + '\n\n' + styleRulesText(p);
  const res = await askJSON(prompt, { label: `Drafting ${sec.num} ${sec.title}`, tier: 'complex' });
  const items = (res && res.items) || [];
  const fresh = [];
  const usedVerbatim = new Set();
  for (const it of items) {
    if (it.type === 'verbatim') {
      const b = blockById(it.blockId); if (!b || usedVerbatim.has(b.id)) continue;
      usedVerbatim.add(b.id);
      fresh.push(newBlock({ type: 'text', html: textToHtml(b.text), mode: 'verbatim', sources: [{ t: 'lib', id: b.id }] }));
    } else if (it.html) {
      const srcs = (it.sources || []).map(id => /^R-/.test(id) ? (reqById(id) && { t: 'req', id }) : (blockById(id) && { t: 'lib', id })).filter(Boolean);
      fresh.push(newBlock({ type: it.type === 'callout' ? 'callout' : 'text', html: autoFixText(sanitize(it.html)), mode: MODES.includes(it.mode) ? it.mode : 'synthesized', sources: srcs }));
    }
  }
  for (const b of verbatim) if (!usedVerbatim.has(b.id)) fresh.push(newBlock({ type: 'text', html: textToHtml(b.text), mode: 'verbatim', sources: [{ t: 'lib', id: b.id }] }));
  // Visuals and tables agreed in the outline.
  for (const v of sec.visuals) {
    const a = v.assetId && assetById(v.assetId);
    fresh.push(newBlock({ type: 'image', assetId: a ? a.id : null, caption: a ? (a.caption || a.name) : v.need, need: a ? '' : v.need, sources: [] }));
  }
  for (const t of sec.tables) fresh.push(makeTable(t.kind, sec, t.title));
  // Locked blocks keep their place; everything else is replaced.
  const locked = sec.blocks.filter(b => b.locked);
  sec.blocks = locked.length ? mergeLocked(sec.blocks, fresh) : fresh;
  sec.status = 'drafted';
  sec.feedback = '';
  save();
}
function mergeLocked(old, fresh) {
  const out = [];
  let fi = 0;
  for (const b of old) {
    if (b.locked) out.push(b);
    else if (fi < fresh.length) out.push(fresh[fi++]);
  }
  while (fi < fresh.length) out.push(fresh[fi++]);
  return out;
}

async function draftAll() {
  for (const s of draftOrder()) {
    await draftSection(s);
    renderMain();
  }
}

function makeTable(kind, sec, title) {
  if (kind === 'compliance') {
    const reqs = (sec && sec.reqIds.length ? sec.reqIds.map(reqById) : S.project.requirements.filter(r => r.mandatory)).filter(Boolean);
    return newBlock({
      type: 'table', caption: title || 'Requirements compliance', mode: 'manual',
      rows: [['Ref', 'Requirement', 'Response section']].concat(reqs.map(r => [r.section || r.id, r.text.slice(0, 160), reqSections(r.id).map(s => s.num + ' ' + s.title).join('; ') || '[NEEDS INPUT: map this requirement]'])),
      sources: reqs.map(r => ({ t: 'req', id: r.id })),
    });
  }
  if (kind === 'timeline') return newBlock({ type: 'table', caption: title || 'Implementation timeline', mode: 'manual', rows: [['Phase', 'Activities', 'Duration'], ['Discovery', '[NEEDS INPUT: activities]', '[NEEDS INPUT]'], ['Build and configure', '', ''], ['Testing', '', ''], ['Launch', '', '']] });
  if (kind === 'team') return newBlock({ type: 'table', caption: title || 'Project team', mode: 'manual', rows: [['Role', 'Name', 'Responsibilities'], ['Project lead', '[NEEDS INPUT: name]', ''], ['Technical lead', '', ''], ['Account lead', '', '']] });
  return newBlock({ type: 'table', caption: title || 'Table', mode: 'manual', rows: [['Column 1', 'Column 2'], ['', '']] });
}

/* Compliance matrix track */
async function answerMatrix() {
  const p = S.project;
  const rows = p.requirements.filter(r => r.responseType === 'compliance-matrix' || r.responseType === 'yes/no');
  if (!rows.length) throw new Error('No matrix-style requirements found. Set a requirement\'s response type to compliance-matrix to include it.');
  for (let i = 0; i < rows.length; i += 12) {
    const batch = rows.slice(i, i + 12).map(req => ({ req, cands: retrieve(req.text, { k: 5, tags: p.topics }) }));
    const res = await askJSON(promptMatrix(p, batch) + '\n\n' + styleRulesText(p), { label: `Answering matrix rows ${i + 1}–${Math.min(i + 12, rows.length)} of ${rows.length}` });
    for (const r of (res && res.rows) || []) {
      const existing = p.matrix.find(m => m.reqId === r.reqId);
      const row = { reqId: r.reqId, status: r.status || 'Needs input', comment: autoFixText(r.comment || ''), sources: (r.sources || []).filter(blockById), confidence: r.confidence || 'low' };
      if (existing) { if (!existing.locked) Object.assign(existing, row); } else p.matrix.push(row);
    }
    save(); renderMain();
  }
}
