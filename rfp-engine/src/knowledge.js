// Internal knowledge through the viewer's connectors: Glean (company search across Drive, Confluence,
// Slack, email and meeting notes) and Salesforce (opportunity, contacts and activity).

const GLEAN = 'Glean';
const SFDC = 'Salesforce - sobject-reads';
const KN = { mcp: null, state: 'connecting', pinSeq: 0 };

(async function connectKnowledge() {
  for (let i = 0; i < 40 && !(window.claude && window.claude.use); i++) await sleep(250);
  try { KN.mcp = window.claude && window.claude.use ? await window.claude.use('mcp') : null; } catch { KN.mcp = null; }
  KN.state = KN.mcp ? 'on' : 'off';
  if (typeof renderMain === 'function') renderMain();
})();

const KN_ERRORS = {
  server_not_connected: 'is not connected to your Claude account. Connect it in claude.ai settings.',
  needs_reauth: 'needs to be reconnected in claude.ai settings.',
  not_granted: 'access was declined for this page.',
  consent_required: 'needs your permission for this page first.',
  rate_limited: 'is rate limiting requests. Try again in a minute.',
  tool_error: 'could not complete that request.',
};
async function kcall(server, tool, input) {
  if (!KN.mcp) throw new Error('Connected sources work when this page is open on claude.ai.');
  try { return await KN.mcp.callTool(server, tool, input, { cache: false }); }
  catch (e) { const name = server === GLEAN ? 'Glean' : 'Salesforce'; throw new Error(`${name} ${KN_ERRORS[e && e.code] || (e && e.message) || 'request failed.'}`); }
}
function kText(res) {
  if (!res) return '';
  if (typeof res.payload === 'string') return res.payload;
  const t = (res.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  return t || (res.payload ? JSON.stringify(res.payload) : '');
}
function kJson(res) {
  if (res && res.payload && typeof res.payload === 'object') return res.payload;
  try { return JSON.parse(kText(res)); } catch { return null; }
}

/* Glean search results come back as Markdown: "## 1. Title", "**Source:** … • **Updated:** …", "**Link:** url", "> snippet". */
function parseGleanSearch(text) {
  const out = [];
  for (const part of text.split(/\n(?=## \d+\.\s)/)) {
    const m = part.match(/^## \d+\.\s+(.+)/);
    if (!m) continue;
    const link = (part.match(/\*\*Link:\*\*\s*(\S+)/) || [])[1];
    if (!link) continue;
    out.push({
      title: m[1].trim(), url: link,
      datasource: ((part.match(/\*\*Source:\*\*\s*([^•\n]+)/) || [])[1] || '').trim(),
      updated: ((part.match(/\*\*Updated:\*\*\s*([^•\n]+)/) || [])[1] || '').trim(),
      owner: ((part.match(/\*\*Owner:\*\*\s*([^•\n]+)/) || [])[1] || '').trim(),
      snippet: part.split('\n').filter(l => l.startsWith('>')).map(l => l.replace(/^>\s?/, '')).join(' ').slice(0, 400),
    });
  }
  return out;
}

/* Glean read_document returns a YAML-like listing: "  - datasource: …", "snippets[n]: "…"", "title: …", "url: "…"". */
function unq(s) { s = (s || '').trim(); if (s.startsWith('"')) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } } return s; }
function parseGleanDocs(text, payload) {
  if (payload && Array.isArray(payload.documents)) {
    return payload.documents.map(d => ({ title: d.title || '', url: d.url || '', datasource: d.datasource || '', updated: d.updateTime || '', owner: (d.owner && d.owner.name) || '', text: [].concat(d.snippets || []).map(s => typeof s === 'string' ? s : s.text || '').join('\n\n') || (d.richDocumentData && d.richDocumentData.content) || '' }));
  }
  const docs = [];
  for (const seg of text.split(/\n\s*- datasource:\s*/).slice(1)) {
    const datasource = seg.split('\n')[0].trim();
    const field = k => { const m = seg.match(new RegExp('\\n\\s{2,6}' + k + ':\\s*(.*)')); return m ? unq(m[1]) : ''; };
    let body = '';
    const sm = seg.match(/snippets\[\d+\]:\s*("(?:[^"\\]|\\.)*")/);
    if (sm) body = unq(sm[1]);
    else { const lm = seg.match(/snippets\[\d+\]:\s*\n([\s\S]*?)\n\s{4}\w+:/); if (lm) body = lm[1].split(/\n\s*-\s*/).map(unq).join('\n\n'); }
    docs.push({ datasource, title: field('title'), url: field('url'), updated: field('updateTime'), owner: ((seg.match(/owner:\s*\n\s*name:\s*(.*)/) || [])[1] || '').trim(), text: body.replace(/\\n/g, '\n') });
  }
  return docs;
}

async function gleanSearch(query, { n = 8, updated } = {}) {
  const input = { query, _user_goal: 'Find internal sources for an RFP response: ' + query, num_results: n };
  if (updated) input.updated = updated;
  return parseGleanSearch(kText(await kcall(GLEAN, 'search', input)));
}
async function gleanRead(urls) {
  if (!urls.length) return [];
  const res = await kcall(GLEAN, 'read_document', { urls, _user_goal: 'Read internal sources for an RFP response' });
  return parseGleanDocs(kText(res), kJson(res));
}

/* Tier from what the source is: discussions are context only, roadmaps are product thinking, old answers are past responses. */
function guessTier(d) {
  const ds = (d.datasource || '').toLowerCase(), t = (d.title || '').toLowerCase();
  if (/slack|gmail|email|outlook|zoom|gong|meeting|teams|calendar/.test(ds) || /meeting notes|sync|standup|1:1|call notes|transcript/.test(t)) return 'internal';
  if (/roadmap|prd|strategy|vision|product brief|positioning|launch|release notes|pricing strategy/.test(t)) return 'product';
  if (/rfp|rfi|proposal|response|questionnaire|sow\b/.test(t)) return 'past';
  if (/library|lego|boilerplate|approved|messaging/.test(t)) return 'approved';
  return 'reference';
}
function pinnedTier(url) { const p = WS.data.sources.pinned.find(x => x.url === url); return p && p.tier; }

/* Long documents become retrievable blocks, split on headings and paragraphs. */
function docToBlocks(d, tier, origin) {
  const blocks = [];
  const text = (d.text || '').replace(/\r/g, '');
  let title = d.title, buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t.length > 60) blocks.push({ id: origin === 'pinned' ? 'P-' + String(++KN.pinSeq).padStart(3, '0') : nextBlockId(), title: (title || d.title).slice(0, 120), text: t, fileId: null, fileName: d.title, loc: d.datasource || 'internal', tags: [], summary: '', tier, origin, url: d.url, updated: d.updated, owner: d.owner });
    buf = '';
  };
  for (const para of text.split(/\n{2,}/)) {
    const line = para.trim();
    if (!line) continue;
    const isHead = line.length < 90 && !/[.:;,]$/.test(line) && !line.includes('\n') && /^[A-Z0-9#]/.test(line);
    if ((isHead && buf.length > 200) || buf.length > 1600) flush();
    if (isHead && !buf) { title = line.replace(/^#+\s*/, ''); continue; }
    buf += (buf ? '\n\n' : '') + line;
    if (blocks.length > 120) break;
  }
  flush();
  return blocks;
}

/* Pinned sources: documents the team marks as the RFP library, product thinking and so on. Synced into a shared cache. */
async function syncPinned() {
  const pins = WS.data.sources.pinned.filter(p => p.url);
  if (!pins.length) throw new Error('Add at least one pinned document first.');
  const all = [];
  KN.pinSeq = 0;
  for (let i = 0; i < pins.length; i += 4) {
    toast(`Reading pinned sources ${i + 1}–${Math.min(i + 4, pins.length)} of ${pins.length}…`, { sticky: true });
    const batch = pins.slice(i, i + 4);
    // Drive pins are read straight from Drive (folders expand to their files); other links go through Glean.
    const viaDrive = batch.filter(x => x.driveId || parseDriveLink(x.url));
    const docs = [];
    for (const pin of viaDrive) {
      pin.driveId = pin.driveId || parseDriveLink(pin.url);
      const got = await readPinnedFromDrive(pin).catch(e => { toast(e.message, { err: true }); return []; });
      for (const d of got) d._pin = pin;
      docs.push(...got);
    }
    const others = batch.filter(x => !viaDrive.includes(x));
    if (others.length) docs.push(...await gleanRead(others.map(p => p.url)));
    for (const d of docs) {
      const pin = d._pin || pins.find(p => p.url === d.url) || pins[i];
      if (pin && !pin.title) pin.title = d.title;
      if (pin) pin.syncedAt = Date.now(), pin.updated = d.updated;
      all.push(...docToBlocks(d, (pin && pin.tier) || guessTier(d), 'pinned'));
    }
  }
  toast('');
  WS.pinnedBlocks = all;
  idbSet('pinnedBlocks', JSON.stringify(all));
  saveWorkspace();
  return all.length;
}

/* Research: find the best internal sources for one section, read them, and add their passages to the project library.
   With tool use, Claude searches iteratively; otherwise the engine runs one search per requirement. */
async function researchSection(sec) {
  const p = S.project;
  const reqs = sec.reqIds.map(reqById).filter(Boolean);
  const months = WS.data.sources.glean.recencyMonths || 18;
  const since = new Date(Date.now() - months * 30 * 864e5).toISOString().slice(0, 10);
  let picks = [];
  const caps = AI.sample && AI.sample.limits ? await AI.sample.limits().catch(() => null) : null;
  if (caps && caps.tools) {
    const seen = new Map();
    const tools = [{
      name: 'search_company',
      description: 'Search the company\'s internal knowledge (Drive, Confluence, Slack, email, meeting notes) and return up to 8 results with title, url, source system, last updated date and a snippet. Use short keyword queries.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: async input => {
        const r = await gleanSearch(String(input.query || ''), { n: 8 });
        r.forEach(x => seen.set(x.url, x));
        return r.map(x => ({ title: x.title, url: x.url, source: x.datasource, updated: x.updated, snippet: x.snippet }));
      },
    }];
    const res = await askJSON(promptResearch(p, sec, reqs, since), { label: `Researching sources for ${sec.num} ${sec.title}`, tools });
    picks = ((res && res.sources) || []).filter(s => s.url && seen.has(s.url)).slice(0, 5).map(s => Object.assign({}, seen.get(s.url), { tier: TIERS[s.tier] ? s.tier : guessTier(seen.get(s.url)), why: s.why || '' }));
  } else {
    const queries = [sec.title + ' ' + (p.topics || []).slice(0, 2).join(' ')].concat(reqs.filter(r => r.mandatory).slice(0, 3).map(r => tokens(r.text).slice(0, 7).join(' ')));
    const hits = new Map();
    for (const q of queries) {
      toast(`Searching internal sources: ${q.slice(0, 50)}…`, { sticky: true });
      for (const [i, h] of (await gleanSearch(q, { n: 6 })).entries()) {
        const prev = hits.get(h.url);
        const score = (prev ? prev.score : 0) + (6 - i) + (TIERS[pinnedTier(h.url) || guessTier(h)].rank) + (h.updated >= since ? 2 : 0);
        hits.set(h.url, Object.assign(h, { score }));
      }
    }
    toast('');
    picks = [...hits.values()].sort((a, b) => b.score - a.score).slice(0, 4).map(h => Object.assign(h, { tier: pinnedTier(h.url) || guessTier(h) }));
  }
  const known = new Set(p.library.map(b => b.url).filter(Boolean));
  const fresh = picks.filter(x => !known.has(x.url));
  if (fresh.length) {
    const docs = await gleanRead(fresh.map(x => x.url));
    for (const d of docs) {
      const pick = fresh.find(x => x.url === d.url) || {};
      const blocks = docToBlocks(Object.assign({}, pick, d), pick.tier || guessTier(d), 'glean');
      p.library.push(...blocks);
    }
  }
  sec.research = { at: Date.now(), sources: picks.map(x => ({ title: x.title, url: x.url, tier: x.tier, updated: x.updated, why: x.why || '' })) };
  logChange('engine', `Found ${plural(picks.length, 'internal source')} for ${sec.num} ${sec.title}.`);
  save();
}

function promptResearch(p, sec, reqs, since) {
  return `Find the best internal company sources for one section of ${aType(p)}.
${ctxText(p)}
Section: ${sec.title}${sec.guidance ? ' (' + sec.guidance + ')' : ''}
Requirements it answers:
${reqs.map(r => '- ' + r.text).join('\n') || '- none mapped'}
${WS.data.sources.glean.hints ? 'Where the team keeps things: ' + WS.data.sources.glean.hints : ''}
Pinned team sources (prefer these): ${WS.data.sources.pinned.map(x => `${x.title || x.url} [${x.tier}]`).join('; ') || 'none'}

Use search_company two to four times with different short queries. Prefer, in order: approved library or boilerplate, the latest product thinking (roadmaps, PRDs) updated after ${since}, past responses to similar clients, then other internal docs. Use Slack, email or meeting notes only for client-specific context.
Return JSON: {"sources":[{"url":"exact url from a search result","title":"...","tier":"approved" | "product" | "past" | "reference" | "internal","why":"one line"}]}  (at most 5, best first)`;
}

/* Bid context from Salesforce and internal notes. */
function soqlStr(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
async function findOpportunities(client) {
  const q = `SELECT Id, Name, StageName, Amount, CloseDate, Type, Account.Name, LastModifiedDate FROM Opportunity WHERE Account.Name LIKE '%${soqlStr(client)}%' OR Name LIKE '%${soqlStr(client)}%' ORDER BY LastModifiedDate DESC LIMIT 8`;
  const j = kJson(await kcall(SFDC, 'soqlQuery', { q }));
  return ((j && j.records) || []).map(r => ({ id: r.Id, name: r.Name, stage: r.StageName, amount: r.Amount, close: r.CloseDate, type: r.Type, account: r.Account && r.Account.Name }));
}
async function opportunityDetail(id) {
  const safe = soqlStr(id);
  const one = async q => { try { return (kJson(await kcall(SFDC, 'soqlQuery', { q })) || {}).records || []; } catch { return []; } };
  const [opp] = await one(`SELECT Id, Name, StageName, Amount, CloseDate, Type, Description, NextStep, LeadSource, Account.Name, Account.Industry, Account.Description, Owner.Name FROM Opportunity WHERE Id = '${safe}' LIMIT 1`);
  const contacts = await one(`SELECT Role, IsPrimary, Contact.Name, Contact.Title FROM OpportunityContactRole WHERE OpportunityId = '${safe}' LIMIT 25`);
  const tasks = await one(`SELECT Subject, Description, ActivityDate, Status FROM Task WHERE WhatId = '${safe}' ORDER BY ActivityDate DESC LIMIT 20`);
  const events = await one(`SELECT Subject, Description, ActivityDate FROM Event WHERE WhatId = '${safe}' ORDER BY ActivityDate DESC LIMIT 20`);
  return { opp, contacts, activity: tasks.concat(events) };
}

async function pullBidContext(oppId) {
  const p = S.project;
  const client = (p.context.client || '').trim();
  if (!client && !oppId) throw new Error('Enter the client name first.');
  const sources = [];
  let sf = null;
  if (oppId) {
    toast('Reading the Salesforce opportunity…', { sticky: true });
    sf = await opportunityDetail(oppId);
    if (sf.opp) sources.push({ kind: 'salesforce', title: 'Salesforce: ' + sf.opp.Name, id: sf.opp.Id });
  }
  const name = client || (sf && sf.opp && sf.opp.Account && sf.opp.Account.Name) || '';
  toast('Searching meeting notes and internal docs…', { sticky: true });
  const hits = new Map();
  for (const q of [`${name} meeting notes`, `${name} RFP`, `${name} call`, name]) {
    try { for (const h of await gleanSearch(q, { n: 6, updated: 'past_year' })) if (!hits.has(h.url)) hits.set(h.url, h); } catch (e) { if (!hits.size && q === name) throw e; }
  }
  const top = [...hits.values()].sort((a, b) => (b.updated || '').localeCompare(a.updated || '')).slice(0, 6);
  const docs = top.length ? await gleanRead(top.map(h => h.url)).catch(() => []) : [];
  for (const d of docs) sources.push({ kind: 'glean', title: d.title, url: d.url, updated: d.updated, datasource: d.datasource });
  toast('');
  const res = await askJSON(promptContext(p, name, sf, docs), { label: 'Summarizing the bid context', tier: 'complex' });
  return { res: res || {}, sources };
}

function promptContext(p, client, sf, docs) {
  return `Build the internal bid context for a response to ${client}. This is for our proposal team only and is never sent to the client.

${sf && sf.opp ? `Salesforce opportunity:\n${JSON.stringify(sf.opp).slice(0, 6000)}\nContacts:\n${JSON.stringify(sf.contacts).slice(0, 4000)}\nRecent activity:\n${JSON.stringify(sf.activity).slice(0, 12000)}` : 'No Salesforce opportunity selected.'}

Internal documents and notes (newest first):
${docs.map(d => `### ${d.title} (${d.datasource}, updated ${d.updated})\n${(d.text || '').slice(0, 9000)}`).join('\n\n') || 'none found'}

Current fields (keep anything still accurate):
${JSON.stringify(p.context)}

Return JSON:
{
 "client": "client's proper name",
 "bidding": "1 to 3 sentences on what we are bidding on: products, scope, size",
 "winThemes": "2 to 4 win themes, one per line, each tied to something the client said or cares about",
 "notes": "short lines covering: decision makers and their priorities, incumbent and how they are performing, budget and timeline, competitors, concerns and objections heard, open questions. Say where each point came from in brackets, e.g. [Salesforce] or [meeting notes, Sep 12]. Skip anything not supported by the material.",
 "stakeholders": [{"name":"...","title":"...","role":"decision maker | influencer | evaluator | champion | unknown"}]
}
Only use what is in the material. Do not invent names, numbers or dates.`;
}

/* Content library panel: search the tools the user picked, guided by their description of where things live. */
async function findSourcesFromPlan() {
  const p = S.project;
  const plan = p.sourcePlan;
  if (!plan.glean) throw new Error('Turn on company search (Glean) to look through internal tools.');
  if (p.sections.length) {
    for (const s of p.sections) { await researchSection(s); renderMain(); }
    return;
  }
  const hintLines = (plan.hints + '\n' + WS.data.sources.glean.hints).split(/\n|;/).map(s => s.trim()).filter(Boolean);
  const queries = hintLines.slice(0, 4).map(h => h.replace(/^(look in|check|search|use)\s+/i, '').slice(0, 80))
    .concat([p.context.client && p.context.bidding ? p.context.bidding.split(/[.,]/)[0] : '', (p.topics || []).slice(0, 3).join(' ')]).filter(Boolean);
  if (!queries.length) throw new Error('Describe where to look, or add bid context first.');
  const hits = new Map();
  for (const q of queries) {
    toast(`Searching: ${q.slice(0, 50)}…`, { sticky: true });
    for (const h of await gleanSearch(q, { n: 6 })) if (!hits.has(h.url)) hits.set(h.url, Object.assign(h, { tier: pinnedTier(h.url) || guessTier(h) }));
  }
  toast('');
  const known = new Set(p.library.map(b => b.url).filter(Boolean));
  const top = [...hits.values()].filter(h => !known.has(h.url)).sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || (b.updated || '').localeCompare(a.updated || '')).slice(0, 6);
  const docs = await gleanRead(top.map(h => h.url));
  for (const d of docs) { const h = top.find(x => x.url === d.url) || {}; p.library.push(...docToBlocks(Object.assign({}, h, d), h.tier || guessTier(d), 'glean')); }
  logChange('engine', `Added ${plural(docs.length, 'internal document')} to the library from company search.`);
  save();
}
