// Visual library: images come only from the linked Figma file, through the viewer's Figma connector.
// get_metadata lists the frames on the library page; get_screenshot renders one frame as a PNG.

const FIG = { mcp: null, state: 'connecting' };
const FIGMA_SERVER = 'Figma';

(async function connectFigma() {
  for (let i = 0; i < 40 && !(window.claude && window.claude.use); i++) await sleep(250);
  try { FIG.mcp = window.claude && window.claude.use ? await window.claude.use('mcp') : null; } catch { FIG.mcp = null; }
  FIG.state = FIG.mcp ? 'on' : 'off';
  if (typeof renderMain === 'function') renderMain();
})();

const FIG_ERRORS = {
  server_not_connected: 'Figma is not connected to your Claude account. Connect it in claude.ai settings, then try again.',
  needs_reauth: 'Your Figma connection needs to be renewed in claude.ai settings.',
  not_granted: 'Figma access was declined for this page.',
  consent_required: 'Allow this page to use your Figma connector, then try again.',
  rate_limited: 'Figma is rate limiting requests. Wait a minute and try again.',
  tool_error: 'Figma could not read that file or frame. Check the link and that you have access.',
};
function figErr(e) { return FIG_ERRORS[e && e.code] || (e && e.message) || 'Figma request failed.'; }

/* Accepts figma.com/design/<key>/<name>?node-id=1-2 (and /file/, and branch links). */
function parseFigmaUrl(url) {
  const m = String(url).match(/figma\.com\/(?:design|file)\/([0-9a-zA-Z]{22,128})(?:\/branch\/([0-9a-zA-Z]{22,128}))?/);
  if (!m) return null;
  const node = (String(url).match(/node-id=([0-9]+[-:][0-9]+)/) || [])[1];
  return { fileKey: m[2] || m[1], nodeId: node ? node.replace('-', ':') : null };
}

function resultText(res) {
  if (!res) return '';
  if (typeof res.payload === 'string') return res.payload;
  const t = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  return t || (res.payload ? JSON.stringify(res.payload) : '');
}
function resultImage(res) {
  const img = (res && res.content || []).find(c => c.type === 'image' && c.data);
  return img ? `data:${img.mimeType || 'image/png'};base64,${img.data}` : null;
}

/* Frames to use as library images: the direct children of the given node (a page or section). */
function parseFrames(xml) {
  const out = [];
  const doc = new DOMParser().parseFromString('<root>' + xml.replace(/^[\s\S]*?(<[a-z])/i, '$1') + '</root>', 'text/xml');
  const root = doc.documentElement;
  if (root.querySelector('parsererror')) {
    // Fall back to a flat scan of id and name attributes.
    for (const m of xml.matchAll(/<(frame|component|component-set|instance|section|group|rectangle)\b[^>]*\bid="([^"]+)"[^>]*\bname="([^"]*)"/gi)) out.push({ nodeId: m[2], name: m[3], type: m[1] });
    return out;
  }
  let top = Array.from(root.children);
  // A single wrapper (the page or section itself) means its children are the library items.
  while (top.length === 1 && top[0].children.length) top = Array.from(top[0].children);
  for (const el of top) {
    const id = el.getAttribute('id'), name = el.getAttribute('name');
    if (id && name) out.push({ nodeId: id, name, type: el.tagName.toLowerCase(), w: +el.getAttribute('width') || null, h: +el.getAttribute('height') || null });
  }
  return out;
}
function parsePages(text) {
  const pages = [];
  for (const m of text.matchAll(/(?:id|guid)["=:\s]+"?([0-9]+:[0-9]+)"?[^\n]*?name["=:\s]+"([^"]+)"/gi)) pages.push({ nodeId: m[1], name: m[2] });
  if (!pages.length) for (const m of text.matchAll(/([0-9]+:[0-9]+)\s*[|,:-]\s*([^\n]+)/g)) pages.push({ nodeId: m[1], name: m[2].trim() });
  return pages;
}

async function figmaCall(tool, input) {
  if (!FIG.mcp) throw new Error('The Figma connector is only available when this page is open on claude.ai.');
  try { return await FIG.mcp.callTool(FIGMA_SERVER, tool, input, { cache: false }); }
  catch (e) { throw new Error(figErr(e)); }
}

/* Sync: list frames on the linked page, keep ids stable, drop frames that no longer exist. */
async function syncFigmaLibrary() {
  const p = S.project;
  const link = p.figma && parseFigmaUrl(p.figma.url);
  if (!link) throw new Error('Paste a Figma design link first.');
  let nodeId = link.nodeId;
  toast('Reading the Figma library…', { sticky: true });
  try {
    if (!nodeId) {
      const pagesRes = await figmaCall('get_metadata', { fileKey: link.fileKey });
      const pages = parsePages(resultText(pagesRes));
      if (!pages.length) throw new Error('Could not find pages in that file. Link to the library page or section instead (copy link to selection in Figma).');
      p.figma.pages = pages;
      nodeId = (pages.find(pg => /librar|asset|visual|image|figure/i.test(pg.name)) || pages[0]).nodeId;
    }
    const meta = await figmaCall('get_metadata', { fileKey: link.fileKey, nodeId });
    const frames = parseFrames(resultText(meta));
    if (!frames.length) throw new Error('No frames found on that page. Put each library image in its own top-level frame.');
    const keep = new Set();
    for (const f of frames) {
      let a = p.assets.find(x => x.source === 'figma' && x.figma.nodeId === f.nodeId && x.figma.fileKey === link.fileKey);
      if (!a) { a = { id: 'A-' + String(p.assets.length + 1).padStart(3, '0'), source: 'figma', name: f.name, caption: f.name, tags: [], dataUrl: '', figma: { fileKey: link.fileKey, nodeId: f.nodeId } }; p.assets.push(a); }
      a.name = f.name; a.figma.w = f.w; a.figma.h = f.h; a.stale = false;
      keep.add(a.id);
    }
    // Frames that left the library stay on the canvas but are flagged so nobody exports an outdated image.
    for (const a of p.assets) if (a.source === 'figma' && !keep.has(a.id)) a.stale = true;
    p.figma.nodeId = nodeId; p.figma.syncedAt = Date.now();
    logChange('engine', `Synced ${frames.length} images from the Figma library.`);
    save();
    renderMain();
    await loadThumbs(p.assets.filter(a => a.source === 'figma' && !a.stale && !a.thumb).slice(0, 24));
  } finally { toast(''); }
}

async function loadThumbs(list) {
  for (const a of list) {
    try {
      const res = await figmaCall('get_screenshot', { fileKey: a.figma.fileKey, nodeId: a.figma.nodeId, maxDimension: 320, enableBase64Response: true });
      a.thumb = resultImage(res) || a.thumb;
    } catch { /* keep going, a thumbnail is optional */ }
    save();
    renderMain();
  }
}

/* Full render for placing on the canvas and for export. Always pulls the latest from Figma. */
async function fetchFigmaImage(a, maxDimension = 1600) {
  const res = await figmaCall('get_screenshot', { fileKey: a.figma.fileKey, nodeId: a.figma.nodeId, maxDimension, enableBase64Response: true });
  const url = resultImage(res);
  if (!url) throw new Error(`Figma returned no image for "${a.name}".`);
  a.dataUrl = url; a.fetchedAt = Date.now();
  if (!a.thumb) a.thumb = url;
  return url;
}

/* Before export, re-pull every image used on the canvas so the document carries the latest versions. */
async function refreshCanvasImages() {
  const used = new Set();
  for (const s of S.project.sections) for (const b of s.blocks) if (b.type === 'image' && b.assetId) used.add(b.assetId);
  const list = [...used].map(assetById).filter(a => a && a.source === 'figma' && !a.stale);
  let n = 0;
  for (const a of list) { toast(`Pulling latest images from Figma (${++n}/${list.length})…`, { sticky: true }); await fetchFigmaImage(a); }
  toast('');
  save();
  return list.length;
}

function figmaFrameUrl(a) {
  return `https://www.figma.com/design/${a.figma.fileKey}/?node-id=${a.figma.nodeId.replace(':', '-')}`;
}
