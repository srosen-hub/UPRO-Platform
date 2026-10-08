// Export: customer .docx (clean), internal source map (.csv), matrix answers (.xlsx), project file (.json).

const DL = { api: null, state: 'connecting' };
(async function connectDownloads() {
  for (let i = 0; i < 40 && !(window.claude && window.claude.use); i++) await sleep(250);
  try { DL.api = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch { DL.api = null; }
  DL.state = DL.api ? 'on' : 'off';
  if (typeof renderMain === 'function' && S.ui.step === 'export') renderMain();
})();

async function saveFile(filename, data) {
  if (!DL.api) throw new Error('Downloads work when this page is open on claude.ai.');
  try { await DL.api.save({ filename, data }); }
  catch (e) {
    if (e && e.code === 'cancelled') return;
    throw new Error(e && e.code === 'too_large' ? 'That file is too large to save from here.' : (e && e.message) || 'The file could not be saved.');
  }
}
function safeName(s) { return String(s || 'response').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'response'; }

/* Images go into Word as PNG, sized to the text width (6.5 in) or half of it. */
function imageToPng(dataUrl, maxW) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || 800, h0 = img.naturalHeight || 500;
      const scale = Math.min(1, 1600 / w0);
      const cv = document.createElement('canvas');
      cv.width = Math.round(w0 * scale); cv.height = Math.round(h0 * scale);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(async b => {
        if (!b) return rej(new Error('Image conversion failed.'));
        const w = Math.min(maxW, w0), h = Math.round(w * h0 / w0);
        res({ data: new Uint8Array(await b.arrayBuffer()), width: w, height: h });
      }, 'image/png');
    };
    img.onerror = () => rej(new Error('An image could not be read.'));
    img.src = dataUrl;
  });
}

function htmlToDocx(html, D) {
  const out = [];
  const d = document.createElement('div');
  d.innerHTML = html || '';
  const runs = (node, fmt = {}) => {
    const r = [];
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { if (c.textContent) r.push(new D.TextRun(Object.assign({ text: c.textContent }, fmt))); }
      else if (c.nodeType === 1) {
        if (c.tagName === 'BR') { r.push(new D.TextRun({ text: '', break: 1 })); continue; }
        const f = Object.assign({}, fmt);
        if (c.tagName === 'B' || c.tagName === 'STRONG') f.bold = true;
        if (c.tagName === 'I' || c.tagName === 'EM') f.italics = true;
        if (c.tagName === 'U') f.underline = {};
        r.push(...runs(c, f));
      }
    }
    return r;
  };
  const blocks = Array.from(d.childNodes);
  for (const n of blocks) {
    if (n.nodeType === 3) { if (n.textContent.trim()) out.push(new D.Paragraph({ children: [new D.TextRun(n.textContent)], spacing: { after: 120 } })); continue; }
    if (n.nodeType !== 1) continue;
    if (n.tagName === 'UL' || n.tagName === 'OL') {
      for (const li of n.querySelectorAll(':scope > li')) out.push(new D.Paragraph(Object.assign({ children: runs(li), spacing: { after: 60 } }, n.tagName === 'OL' ? { numbering: { reference: 'num', level: 0 } } : { bullet: { level: 0 } })));
    } else if (n.tagName === 'H4') out.push(new D.Paragraph({ children: runs(n, { bold: true }), spacing: { before: 120, after: 60 } }));
    else out.push(new D.Paragraph({ children: runs(n), spacing: { after: 120 } }));
  }
  return out;
}

async function blockToDocx(b, label, D, maxW) {
  if (b.type === 'text') return htmlToDocx(b.html, D);
  if (b.type === 'callout') {
    return [new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      borders: { top: { style: D.BorderStyle.NONE }, bottom: { style: D.BorderStyle.NONE }, right: { style: D.BorderStyle.NONE }, left: { style: D.BorderStyle.SINGLE, size: 18, color: '1D5C8C' }, insideHorizontal: { style: D.BorderStyle.NONE }, insideVertical: { style: D.BorderStyle.NONE } },
      rows: [new D.TableRow({ children: [new D.TableCell({ children: htmlToDocx(b.html, D), shading: { fill: 'EEF4F9', type: D.ShadingType.CLEAR, color: 'auto' }, margins: { top: 100, bottom: 100, left: 180, right: 180 } })] })],
    }), new D.Paragraph({ children: [] })];
  }
  if (b.type === 'image') {
    const a = assetById(b.assetId);
    const cap = new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 160 }, children: [new D.TextRun({ text: label + ': ', bold: true, size: 18 }), new D.TextRun({ text: b.caption || (a && a.caption) || '', size: 18 })] });
    if (!a) return [new D.Paragraph({ children: [new D.TextRun({ text: `[NEEDS VISUAL: ${b.need || b.caption || ''}]`, highlight: 'yellow' })] }), cap];
    const png = await imageToPng(a.dataUrl || a.thumb, maxW);
    return [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ data: png.data, transformation: { width: png.width, height: png.height } })] }), cap];
  }
  if (b.type === 'table') {
    const rows = (b.rows || []).map((r, ri) => new D.TableRow({
      tableHeader: ri === 0,
      children: r.map(c => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: String(c), bold: ri === 0, size: 19 })] })], shading: ri === 0 ? { fill: 'E6EDF4', type: D.ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 } })),
    }));
    return [
      new D.Paragraph({ spacing: { before: 120, after: 60 }, children: [new D.TextRun({ text: label + ': ', bold: true, size: 18 }), new D.TextRun({ text: b.caption || '', size: 18 })] }),
      new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows }),
      new D.Paragraph({ children: [] }),
    ];
  }
  return [];
}

async function buildDocx() {
  const D = window.docx;
  if (!D) throw new Error('The Word writer did not load. Reload the page and try again.');
  const p = S.project;
  numberSections();
  const rules = p.formatRules || {};
  const font = rules.fontFamily ? String(rules.fontFamily).split(',')[0].replace(/["']/g, '').trim() : 'Calibri';
  const sizePt = parseFloat(rules.fontSize) || 11;
  const children = [];
  // Cover
  children.push(new D.Paragraph({ spacing: { before: 2400, after: 240 }, children: [new D.TextRun({ text: p.name, bold: true, size: 48 })] }));
  if (p.context.client) children.push(new D.Paragraph({ spacing: { after: 120 }, children: [new D.TextRun({ text: 'Prepared for ' + p.context.client, size: 28 })] }));
  if (p.exportAuthor) children.push(new D.Paragraph({ spacing: { after: 120 }, children: [new D.TextRun({ text: 'Submitted by ' + p.exportAuthor, size: 24 })] }));
  children.push(new D.Paragraph({ children: [new D.TextRun({ text: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), size: 22 })] }));
  children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
  let fig = 0, tab = 0;
  for (const s of p.sections) {
    children.push(new D.Paragraph({ heading: s.level === 2 ? D.HeadingLevel.HEADING_2 : D.HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new D.TextRun(`${s.num}  ${s.title}`)] }));
    for (let i = 0; i < s.blocks.length; i++) {
      const b = s.blocks[i];
      const label = b => b.type === 'image' ? 'Figure ' + (++fig) : b.type === 'table' ? 'Table ' + (++tab) : '';
      const nb = s.blocks[i + 1];
      if (b.width === 'half' && nb && nb.width === 'half') {
        // Two half-width blocks sit side by side in a borderless two-column table.
        const left = await blockToDocx(b, label(b), D, 300), right = await blockToDocx(nb, label(nb), D, 300);
        const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        children.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
          rows: [new D.TableRow({ children: [new D.TableCell({ width: { size: 50, type: D.WidthType.PERCENTAGE }, children: left.length ? left : [new D.Paragraph('')], margins: { right: 160 } }), new D.TableCell({ width: { size: 50, type: D.WidthType.PERCENTAGE }, children: right.length ? right : [new D.Paragraph('')], margins: { left: 160 } })] })],
        }));
        children.push(new D.Paragraph({ children: [] }));
        i++;
        continue;
      }
      children.push(...await blockToDocx(b, label(b), D, 600));
    }
  }
  const author = (p.exportAuthor || '').trim();
  const doc = new D.Document({
    creator: author || ' ', lastModifiedBy: author || ' ', title: p.name, description: '', subject: p.context.client || '', keywords: '',
    styles: {
      default: { document: { run: { font, size: Math.round(sizePt * 2) }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font, size: 32, bold: true, color: '102A43' } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font, size: 26, bold: true, color: '102A43' } },
      ],
    },
    numbering: { config: [{ reference: 'num', levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: '%1.', alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 540, hanging: 260 } } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ children: [D.PageNumber.CURRENT], size: 18 })] })] }) },
      children,
    }],
  });
  return D.Packer.toBlob(doc);
}

async function exportDocx(force) {
  const blockers = exportChecks().filter(c => !c.ok && c.sev === 'crit');
  if (blockers.length && !force) { modalExportBlockers(blockers); return; }
  S.ui.modal = null; renderOverlay();
  if (FIG.mcp) { try { await refreshCanvasImages(); } catch (e) { toast(e.message, { err: true }); await sleep(1200); } }
  toast('Building the Word file…', { sticky: true });
  try {
    const blob = await buildDocx();
    toast('');
    await saveFile(safeName(S.project.name) + '.docx', blob);
    logChange('user', 'Exported the customer response (.docx).');
    save();
  } catch (e) { toast(e.message, { err: true }); }
}

function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
async function exportSourceMap() {
  const p = S.project;
  numberSections();
  const rows = [['Section', 'Block', 'Type', 'Mode', 'Excerpt', 'Source id', 'Source kind', 'Source file', 'Location', 'Source text']];
  for (const s of p.sections) s.blocks.forEach((b, i) => {
    const ex = blockText(b).slice(0, 160);
    const srcs = (b.sources || []).length ? b.sources : [null];
    for (const src of srcs) {
      if (!src) { rows.push([s.num + ' ' + s.title, i + 1, b.type, b.mode, ex, '', b.type === 'image' && assetById(b.assetId) ? (assetById(b.assetId).source === 'figma' ? 'Figma frame' : 'Uploaded image') : 'No source', b.type === 'image' && assetById(b.assetId) ? assetById(b.assetId).name : '', b.type === 'image' && assetById(b.assetId) && assetById(b.assetId).source === 'figma' ? figmaFrameUrl(assetById(b.assetId)) : '', '']); continue; }
      if (src.t === 'req') { const r = reqById(src.id); rows.push([s.num + ' ' + s.title, i + 1, b.type, b.mode, ex, src.id, 'RFP requirement', r && r.fileName, r && [r.page && 'p. ' + r.page, r.section && '§' + r.section].filter(Boolean).join(' '), r && r.text]); }
      else { const lb = blockById(src.id); rows.push([s.num + ' ' + s.title, i + 1, b.type, b.mode, ex, src.id, 'Library block', lb && lb.fileName, lb && lb.loc, lb && lb.text.slice(0, 500)]); }
    }
  });
  await saveFile(safeName(p.name) + '-source-map-INTERNAL.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'));
}

async function exportMatrix() {
  if (!window.XLSX) throw new Error('The spreadsheet writer did not load.');
  const p = S.project;
  const rows = [['Ref', 'RFP section', 'Requirement', 'Status', 'Response']];
  for (const m of p.matrix) { const r = reqById(m.reqId); if (r) rows.push([r.page || r.id, r.section, r.text, m.status, m.comment]); }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 70 }, { wch: 16 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Compliance');
  wb.Props = { Author: p.exportAuthor || '', Title: p.name };
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  await saveFile(safeName(p.name) + '-compliance-matrix.xlsx', new Uint8Array(buf));
}

async function saveProjectFile() {
  await saveFile(safeName(S.project.name) + '.rfp.json', JSON.stringify(S.project));
}
async function openProjectFile(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.sections) || !Array.isArray(data.requirements)) throw new Error('bad');
    S.project = data;
    S.ui.step = 'inputs';
    save(); render();
    toast('Project opened.');
  } catch { toast('That file is not an RFP Engine project.', { err: true }); }
}
