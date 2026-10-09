// Google Drive is the preferred way in and out: pick client documents, library files, the style guide, pinned
// sources and images from Drive, re-read them when they change, and save exports back to Drive.

const GDRIVE = 'Google Drive';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_EXT = {
  'application/vnd.google-apps.document': 'gdoc', 'application/vnd.google-apps.spreadsheet': 'gsheet', 'application/vnd.google-apps.presentation': 'gslides',
  'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/markdown': 'md', 'text/csv': 'csv',
};
const isImageMime = m => /^image\//.test(m || '');
const isFolder = f => f.mimeType === FOLDER_MIME;

async function dcall(tool, input) {
  if (!KN.mcp) throw new Error('Google Drive works when this page is open on claude.ai with the Google Drive connector.');
  try { return await KN.mcp.callTool(GDRIVE, tool, input, { cache: false }); }
  catch (e) { throw new Error(`Google Drive ${KN_ERRORS[e && e.code] || (e && e.message) || 'request failed.'}`); }
}
function driveFiles(res) { const j = kJson(res) || {}; return (j.files || []).map(normFile); }
function normFile(f) {
  f = f.file || f;
  return { id: f.id, title: f.title || f.name || 'Untitled', mimeType: f.mimeType || '', modified: f.modifiedTime || '', owner: f.owner || '', url: f.viewUrl || f.webViewLink || '' };
}

/* Accepts Docs, Sheets, Slides, Drive file and folder links, or a bare id. */
function parseDriveLink(s) {
  s = String(s || '').trim();
  const m = s.match(/\/(?:d|folders)\/([A-Za-z0-9_-]{15,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{15,})/) || s.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}
const q1 = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function driveRecent() { return driveFiles(await dcall('list_recent_files', { pageSize: 25, excludeContentSnippets: true })); }
async function driveSearch(text) {
  const t = q1(text);
  return driveFiles(await dcall('search_files', { query: `title contains '${t}' or fullText contains '${t}'`, pageSize: 25, excludeContentSnippets: true }));
}
async function driveChildren(folderId) {
  return driveFiles(await dcall('search_files', { query: `parentId = '${q1(folderId)}'`, pageSize: 50, excludeContentSnippets: true }));
}
async function driveMeta(id) { const j = kJson(await dcall('get_file_metadata', { fileId: id, excludeContentSnippets: true })); return j ? normFile(j) : null; }

/* Drive returns Google Docs as Markdown with escaped punctuation; undo the escapes so the text reads normally. */
function unescapeMd(t) { return String(t || '').replace(/\\([\\`*_{}\[\]()#+\-.!&|>~=])/g, '$1').replace(/ /g, ' '); }
async function driveRead(id) {
  const j = kJson(await dcall('read_file_content', { fileId: id })) || {};
  return { text: unescapeMd(j.fileContent || j.content || ''), title: j.title || '', url: j.viewUrl || '' };
}
/* Raw bytes, for images. The connector answers with base64; the field name is not pinned down, so look for it. */
async function driveBytes(id) {
  const res = await dcall('download_file_content', { fileId: id });
  const blockImg = (res.content || []).find(c => c.data && (c.type === 'image' || c.type === 'resource'));
  if (blockImg) return { b64: blockImg.data, mime: blockImg.mimeType };
  const j = kJson(res) || {};
  const b64 = j.content || j.base64Content || j.data || j.fileContent || (j.file && j.file.content);
  if (!b64) throw new Error('Google Drive returned no file content.');
  return { b64, mime: j.mimeType || j.contentMimeType || '' };
}

/* Bring Drive files into the project. Folders bring their direct children. */
async function addDriveFiles(items, role) {
  const p = S.project;
  const queue = [];
  for (const it of items) {
    if (isFolder(it)) { for (const c of await driveChildren(it.id)) if (!isFolder(c)) queue.push(c); }
    else queue.push(it);
  }
  const added = [];
  for (const d of queue.slice(0, 60)) {
    try {
      if (p.files.some(f => f.driveId === d.id) || p.assets.some(a => a.driveId === d.id)) continue;
      toast(`Reading ${d.title} from Drive…`, { sticky: true });
      if (isImageMime(d.mimeType)) {
        const { b64, mime } = await driveBytes(d.id);
        const url = `data:${mime || d.mimeType};base64,${b64}`;
        p.assets.push({ id: 'A-' + String(p.assets.length + 1).padStart(3, '0'), source: 'upload', driveId: d.id, url: d.url, name: d.title, caption: d.title.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), tags: [], dataUrl: url, thumb: url });
        added.push(d.title);
        continue;
      }
      const r = await driveRead(d.id);
      if (!r.text.trim()) throw new Error(`${d.title}: no readable text.`);
      const ext = DRIVE_EXT[d.mimeType] || (d.title.split('.').pop() || 'txt').toLowerCase();
      const f = { id: uid('f'), name: d.title, ext, role, source: 'drive', driveId: d.id, url: r.url || d.url, modified: d.modified, size: r.text.length, text: r.text, pages: [{ n: 1, text: r.text }], addedAt: Date.now(), processed: false, docType: '', reqCount: 0 };
      p.files.push(f);
      if (role === 'library') {
        const blocks = splitLibrary(f, { kind: 'text', text: r.text });
        for (const b of blocks) b.url = f.url, b.updated = f.modified;
        p.library.push(...blocks);
        f.blockCount = blocks.length;
      } else if (p.sections.length) f.isChange = true;
      added.push(d.title);
    } catch (e) { toast(e.message, { err: true }); await sleep(1200); }
  }
  toast(added.length ? `Added ${plural(added.length, 'file')} from Google Drive.` : 'Nothing new was added.');
  if (added.length) logChange('user', `Added ${plural(added.length, 'file')} from Google Drive.`);
  save(); render();
  if (role === 'library' && added.length && AI.sample) tagLibrary().catch(e => toast(e.message, { err: true }));
  if (role === 'rfp' && added.length) autoStart();
  return added.length;
}

/* Keep Drive content current: re-read files that changed since they were added. */
async function refreshDrive() {
  const p = S.project;
  const files = p.files.filter(f => f.source === 'drive');
  if (!files.length) throw new Error('No Google Drive files in this project yet.');
  let changed = 0, clientChanged = 0;
  for (const f of files) {
    toast(`Checking ${f.name}…`, { sticky: true });
    const m = await driveMeta(f.driveId).catch(() => null);
    if (!m) { f.missing = true; continue; }
    f.missing = false;
    if (!m.modified || m.modified <= (f.modified || '')) continue;
    const r = await driveRead(f.driveId);
    f.text = r.text; f.pages = [{ n: 1, text: r.text }]; f.modified = m.modified;
    if (f.role === 'library') {
      // Passages keep their ids when their heading is unchanged, so outlines and drafts still point at them.
      const old = p.library.filter(b => b.fileId === f.id);
      const fresh = splitLibrary(f, { kind: 'text', text: r.text });
      for (const b of fresh) { const o = old.find(x => x.title === b.title && !x._reused); if (o) { b.id = o.id; b.tags = o.tags; o._reused = true; } b.url = f.url; b.updated = f.modified; }
      p.library = p.library.filter(b => b.fileId !== f.id).concat(fresh);
      f.blockCount = fresh.length;
    } else {
      // A changed client document is new client input: read it again and review the format changes.
      p.requirements = p.requirements.filter(r2 => r2.fileId !== f.id || reqSections(r2.id).length);
      f.processed = false; f.isChange = p.sections.length > 0; clientChanged++;
    }
    changed++;
  }
  toast('');
  logChange('engine', changed ? `Re-read ${plural(changed, 'changed Drive file')}.` : 'Checked Google Drive: no changes.');
  save(); render();
  if (clientChanged && AI.sample) await extractRequirements();
  return changed;
}

/* Saving to Drive: Word files become Google Docs, CSV and Excel become Google Sheets. */
function blobToB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
async function saveToDrive(title, data, mime, { convert = true } = {}) {
  const p = S.project;
  const input = { title, contentMimeType: mime };
  if (typeof data === 'string') input.textContent = data;
  else input.base64Content = await blobToB64(data instanceof Blob ? data : new Blob([data]));
  if (!convert) input.disableConversionToGoogleType = true;
  const folder = parseDriveLink(p.exportFolder || '');
  if (folder) input.parentId = folder;
  const j = kJson(await dcall('create_file', input)) || {};
  const f = normFile(j);
  const url = f.url || (f.id ? `https://drive.google.com/open?id=${f.id}` : '');
  p.driveExports = [{ title, url, at: Date.now() }].concat(p.driveExports || []).slice(0, 20);
  logChange('user', `Saved "${title}" to Google Drive.`);
  save();
  return url;
}

/* Drive picker: recent files, search, folders and pasted links, with multi-select. */
const DRIVE_ROLES = {
  rfp: { title: 'Add client documents from Google Drive', multi: true, folders: true },
  library: { title: 'Add library files from Google Drive', multi: true, folders: true },
  image: { title: 'Add images from Google Drive', multi: true, folders: true, images: true },
  styleguide: { title: 'Choose the style guide in Google Drive', multi: false, folders: false },
  project: { title: 'Open a project file from Google Drive', multi: false, folders: false },
  pin: { title: 'Pin team sources from Google Drive', multi: true, folders: true },
};
async function openDrivePicker(role) {
  S.ui.drive = { role, q: '', folder: null, stack: [], files: [], picked: new Map(), loading: true, error: '' };
  renderDrivePicker();
  await loadDrive(() => driveRecent());
}
async function loadDrive(fn) {
  const d = S.ui.drive; if (!d) return;
  d.loading = true; d.error = ''; renderDrivePicker();
  try { d.files = await fn(); } catch (e) { d.files = []; d.error = e.message; }
  d.loading = false; renderDrivePicker();
}
function renderDrivePicker() {
  const d = S.ui.drive; if (!d) return;
  const cfg = DRIVE_ROLES[d.role];
  const rows = d.files.filter(f => cfg.images ? (isImageMime(f.mimeType) || isFolder(f)) : !isImageMime(f.mimeType) || d.role === 'library');
  const crumbs = [{ id: '', title: d.q ? `Search: ${d.q}` : 'Recent' }].concat(d.stack);
  S.ui.modal = {
    title: cfg.title,
    body: `<div class="row" style="margin-bottom:8px;flex-wrap:nowrap"><input class="input" id="drive-q" placeholder="Search Drive, or paste a Drive link" value="${esc(d.qDraft ?? d.q)}" style="flex:1"><button class="btn" data-act="drive-search">Search</button></div>
      <div class="row hint" style="margin-bottom:6px">${crumbs.map((c, i) => i === crumbs.length - 1 ? `<b>${esc(c.title)}</b>` : `<button class="btn sm ghost" data-act="drive-crumb" data-i="${i}">${esc(c.title)}</button> ›`).join(' ')}</div>
      ${d.loading ? '<p class="hint">Loading…</p>' : d.error ? `<p class="hint" style="color:var(--crit)">${esc(d.error)}</p>` : ''}
      ${!d.loading && !rows.length && !d.error ? '<p class="hint">No files here.</p>' : ''}
      ${rows.map(f => `<div class="row" style="flex-wrap:nowrap;align-items:center;padding:6px 0;border-top:1px solid var(--line)">
        <input type="${cfg.multi ? 'checkbox' : 'radio'}" name="drive-pick" data-drivepick="${esc(f.id)}" ${d.picked.has(f.id) ? 'checked' : ''} ${isFolder(f) && !cfg.folders ? 'disabled' : ''} aria-label="Select ${esc(f.title)}">
        <span class="file-ic ${esc(DRIVE_EXT[f.mimeType] || '')}" style="width:26px;height:30px;flex:none">${isFolder(f) ? '▤' : esc((DRIVE_EXT[f.mimeType] || (isImageMime(f.mimeType) ? 'img' : 'file')).toUpperCase().slice(0, 4))}</span>
        <span style="flex:1;min-width:0">${isFolder(f) ? `<button class="btn sm ghost" style="padding:0;font-weight:700" data-act="drive-open" data-id="${esc(f.id)}">${esc(f.title)} ›</button>` : `<b style="overflow-wrap:anywhere">${esc(f.title)}</b>`}
          <br><span class="hint">${isFolder(f) ? 'Folder' + (cfg.folders ? ', select to add every file in it' : '') : ''}${f.modified ? (isFolder(f) ? ' · ' : '') + 'updated ' + esc(f.modified.slice(0, 10)) : ''}${f.owner ? ' · ' + esc(f.owner) : ''}</span></span></div>`).join('')}`,
    foot: `<span class="hint" style="margin-right:auto">${d.picked.size ? plural(d.picked.size, 'item') + ' selected' : ''}</span><button class="btn" data-act="drive-cancel">Cancel</button><button class="btn primary" data-act="drive-add" ${d.picked.size ? '' : 'disabled'}>Add</button>`,
  };
  renderOverlay();
  const q = $('#drive-q'); if (q && document.activeElement !== q && !d.loading && d.focusQ) { q.focus(); d.focusQ = false; }
}
async function driveSearchOrLink() {
  const d = S.ui.drive; if (!d) return;
  const v = ($('#drive-q') || {}).value || '';
  const id = parseDriveLink(v);
  if (id && /drive|docs\.google|^[A-Za-z0-9_-]{20,}$/.test(v)) {
    d.q = ''; d.stack = [];
    await loadDrive(async () => {
      const m = await driveMeta(id);
      if (!m) throw new Error('That link could not be opened. Check that you have access.');
      if (isFolder(m)) { d.stack = [{ id: m.id, title: m.title }]; return driveChildren(m.id); }
      d.picked.set(m.id, m);
      return [m];
    });
    return;
  }
  d.q = v.trim(); d.qDraft = undefined; d.stack = [];
  await loadDrive(() => d.q ? driveSearch(d.q) : driveRecent());
}
async function driveAdd() {
  const d = S.ui.drive; if (!d) return;
  const items = [...d.picked.values()];
  S.ui.drive = null; S.ui.modal = null; renderOverlay();
  if (d.role === 'styleguide') {
    const r = await driveRead(items[0].id);
    if (!r.text.trim()) throw new Error('No text found in that file.');
    await importStyleGuide(r.text);
    sg().sourceUrl = r.url || items[0].url; saveWorkspace();
    toast('Style guide imported from Google Drive. Review the fields.');
    return;
  }
  if (d.role === 'project') {
    const { b64 } = await driveBytes(items[0].id);
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await openProjectFile(new Blob([bytes]));
    return;
  }
  if (d.role === 'pin') {
    for (const it of items) if (!WS.data.sources.pinned.some(x => x.driveId === it.id)) WS.data.sources.pinned.push({ url: it.url, driveId: it.id, folder: isFolder(it), title: it.title, tier: 'approved' });
    saveWorkspace();
    toast(`Pinned ${plural(items.length, 'source')}. Sync to read them.`);
    return;
  }
  await addDriveFiles(items, d.role === 'image' ? 'library' : d.role);
}

/* Pinned Drive sources are read straight from Drive (folders expand to their files); other links go through Glean. */
async function readPinnedFromDrive(pin) {
  const ids = [];
  if (pin.folder) { for (const c of await driveChildren(pin.driveId)) if (!isFolder(c) && !isImageMime(c.mimeType)) ids.push(c); }
  else ids.push({ id: pin.driveId, title: pin.title, url: pin.url });
  const docs = [];
  for (const it of ids.slice(0, 25)) {
    toast(`Reading ${it.title}…`, { sticky: true });
    const r = await driveRead(it.id).catch(() => null);
    if (r && r.text) docs.push({ title: r.title || it.title, url: r.url || it.url, datasource: 'gdrive', updated: it.modified || '', text: r.text });
  }
  return docs;
}
