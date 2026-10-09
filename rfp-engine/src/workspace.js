// Team workspace: the style guide, knowledge sources and response templates every project uses.
// Shared through the artifact's database when available (editors change it, everyone reads it),
// otherwise kept in this browser.

const RESPONSE_TYPES = [
  { id: 'rfp', label: 'RFP response' },
  { id: 'rfi', label: 'RFI response' },
  { id: 'security', label: 'Security questionnaire' },
  { id: 'proposal', label: 'Unsolicited proposal' },
  { id: 'sow', label: 'Statement of work' },
  { id: 'other', label: 'Other response' },
];

/* Trust tiers decide how a source may be used in a draft. */
const TIERS = {
  approved: { label: 'Approved library', short: 'Approved', rank: 4, use: 'Approved boilerplate. May be used word for word.' },
  product: { label: 'Latest product thinking', short: 'Product', rank: 3, use: 'Current roadmap and positioning. Use for direction; anything not yet shipped is written as planned and marked [CONFIRM: ...] for the product owner.' },
  past: { label: 'Past responses', short: 'Past response', rank: 2, use: 'Earlier submitted answers. Reuse and tailor; check facts against newer sources.' },
  reference: { label: 'Internal reference', short: 'Reference', rank: 2, use: 'Internal documentation. Tailor; do not copy internal wording.' },
  internal: { label: 'Internal discussion', short: 'Discussion', rank: 1, use: 'Slack, email and meeting notes. Context only. Never quote; any fact taken from it is marked [CONFIRM: ...].' },
};

const DEFAULT_TEMPLATES = {
  rfp: '1 Executive Summary\n2 Understanding of Needs\n3 Proposed Solution\n  3.1 Capabilities\n  3.2 Integration and Security\n4 Approach and Implementation Plan\n5 Project Team\n6 Relevant Experience and References\n7 Pricing\n8 Appendices',
  rfi: '1 Company Overview\n2 Understanding of Needs\n3 Solution Overview\n4 Relevant Experience\n5 Responses to Questions\n6 Next Steps',
  security: '1 Security Program Overview\n2 Certifications and Audits\n3 Data Protection\n4 Access Control\n5 Incident Response\n6 Questionnaire Responses',
  proposal: '1 Executive Summary\n2 The Opportunity\n3 Proposed Approach\n4 Outcomes and Measures\n5 Timeline\n6 Investment\n7 Why Us',
  sow: '1 Background and Objectives\n2 Scope of Work\n3 Deliverables\n4 Timeline and Milestones\n5 Roles and Responsibilities\n6 Assumptions\n7 Acceptance Criteria\n8 Fees and Payment',
  other: '1 Introduction\n2 Response\n3 Supporting Information',
};

const DEFAULT_STYLE_GUIDE = {
  tone: 'Confident, plain and specific. Write like an experienced proposal manager who knows the client. Warm but not salesy.',
  rules: [
    'Use the client\'s name and their own terms from the RFP.',
    'Lead with the answer, then the evidence. Short paragraphs of 2 to 4 sentences.',
    'Vary sentence length. Mix short sentences with longer ones.',
    'Prefer concrete facts, numbers and named examples over adjectives.',
    'Use active voice and "we" for our company, "you" or the client name for the client.',
    'No em dashes or en dashes. Use commas, periods, colons or parentheses.',
    'No rhetorical questions, no exclamation marks, no emoji.',
    'Do not open with scene-setting such as "In today\'s rapidly evolving landscape".',
    'Avoid stacked groups of three adjectives and "not only X but also Y" framing.',
    'Do not end paragraphs with a summarizing moral or a restatement of the point.',
    'Bullets only for lists of parallel items, never for the whole section.',
  ].join('\n'),
  formatting: [
    'Headings in title case.',
    'Spell out numbers one to nine; use numerals for 10 and above, percentages and money.',
    'Dates as "October 30, 2026".',
    'Use the Oxford comma.',
  ].join('\n'),
  terminology: [
    'customers | users, end users',
    'utility | utility company',
  ].join('\n'),
  facts: '',
  banned: [
    'delve', 'delving', 'tapestry', 'seamless', 'seamlessly', 'leverage', 'leveraging', 'robust', 'cutting-edge',
    'state-of-the-art', 'game-changer', 'game-changing', 'revolutionize', 'unlock', 'unleash', 'empower', 'elevate',
    'holistic', 'synergy', 'synergies', 'paradigm', 'landscape', 'ever-evolving', 'rapidly evolving', 'in today\'s',
    'navigate the complexities', 'it is worth noting', 'it\'s worth noting', 'it is important to note', 'furthermore',
    'moreover', 'in conclusion', 'in summary', 'at the end of the day', 'testament to', 'plays a crucial role',
    'pivotal', 'myriad', 'plethora', 'embark', 'journey', 'realm', 'foster', 'meticulous', 'meticulously',
    'best-in-class', 'world-class', 'unparalleled', 'look no further', 'rest assured', 'we are thrilled',
    'as an ai', 'language model', 'i hope this helps', 'certainly!', 'absolutely!',
  ].join(', '),
  voiceSample: '',
};

function defaultWorkspace() {
  return {
    v: 1,
    styleGuide: JSON.parse(JSON.stringify(DEFAULT_STYLE_GUIDE)),
    sources: {
      glean: { enabled: true, recencyMonths: 18, hints: '' },
      pinned: [],
    },
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    updatedAt: 0,
  };
}

const WS = { data: defaultWorkspace(), db: null, mode: 'local', canEdit: true, unsub: null, pinnedBlocks: [] };
const WS_DOC = 'workspace/settings';

async function loadWorkspace() {
  // Local copy first so the page renders at once.
  try { const raw = await idbGet('workspace'); if (raw) WS.data = Object.assign(defaultWorkspace(), JSON.parse(raw)); } catch { }
  try { const raw = await idbGet('pinnedBlocks'); if (raw) WS.pinnedBlocks = JSON.parse(raw); } catch { }
  for (let i = 0; i < 40 && !(window.claude && window.claude.use); i++) await sleep(250);
  let db = null, user = null;
  try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch { db = null; }
  try { user = window.claude && window.claude.use ? await window.claude.use('user') : null; } catch { user = null; }
  if (!db) { WS.mode = 'local'; renderMain(); return; }
  WS.db = db;
  WS.mode = 'shared';
  WS.canEdit = user ? (user.isOwner() || user.canEdit()) : false;
  try {
    WS.unsub = db.doc(WS_DOC).onSnapshot(snap => {
      const d = snap && (typeof snap.data === 'function' ? snap.data() : snap.data);
      if (d && d.styleGuide) {
        WS.data = Object.assign(defaultWorkspace(), d);
        idbSet('workspace', JSON.stringify(WS.data));
        if (!isTyping()) renderMain();
      } else if (WS.canEdit && WS.data.updatedAt) {
        saveWorkspace(); // first editor seeds the shared copy from their local one
      }
    }, () => { WS.mode = 'local'; renderMain(); });
  } catch { WS.mode = 'local'; }
  renderMain();
}
function isTyping() { const a = document.activeElement; return a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable); }

let wsTimer = null;
function saveWorkspace() {
  WS.data.updatedAt = Date.now();
  idbSet('workspace', JSON.stringify(WS.data));
  clearTimeout(wsTimer);
  wsTimer = setTimeout(async () => {
    if (WS.mode !== 'shared' || !WS.db || !WS.canEdit) return;
    try { await WS.db.doc(WS_DOC).set(JSON.parse(JSON.stringify(WS.data))); }
    catch (e) { toast(e && e.code === 'not_granted' ? 'Only editors of this page can change the team settings.' : 'Team settings could not be saved. Your changes are kept in this browser.', { err: true }); }
  }, 800);
}

function sg() { return WS.data.styleGuide; }
function wsEditable() { return WS.mode === 'local' || WS.canEdit; }

function templateSections(type) {
  const t = WS.data.templates[type] || WS.data.templates.rfp || '';
  return t.split('\n').filter(l => l.trim()).map(l => {
    const level = /^\s{2,}|\t/.test(l) ? 2 : 1;
    return { title: l.trim().replace(/^[\d.]+\s+/, ''), level };
  });
}

function terminologyPairs() {
  return sg().terminology.split('\n').map(l => l.split('|').map(s => s.trim())).filter(x => x[0] && x[1])
    .map(([use, avoid]) => ({ use, avoid: avoid.split(',').map(s => s.trim()).filter(Boolean) }));
}

/* Import a style guide from a document: Claude maps it onto the guide's fields. */
function promptStyleImport(text) {
  return `Turn this company writing style guide into structured fields. Keep the company's own wording where possible.

"""
${text.slice(0, 60000)}
"""

Return JSON:
{"tone":"2 to 3 sentences","rules":"one rule per line","formatting":"one convention per line (headings, numbers, dates, punctuation, units)","terminology":"one per line as: preferred term | terms to avoid, comma separated","banned":"comma separated words and phrases to never use","facts":"approved company facts and figures, one per line, only if the guide lists them"}
Leave a field as "" when the guide says nothing about it.`;
}
async function importStyleGuide(text) {
  const res = await askJSON(promptStyleImport(text), { label: 'Reading the style guide' });
  if (!res) return;
  const g = sg();
  for (const k of ['tone', 'rules', 'formatting', 'terminology', 'facts']) if (res[k]) g[k] = res[k];
  if (res.banned) g.banned = [...new Set(g.banned.split(',').map(s => s.trim()).concat(res.banned.split(',').map(s => s.trim())).filter(Boolean))].join(', ');
  saveWorkspace();
}
