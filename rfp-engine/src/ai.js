// Claude access through the artifact `sample` capability, plus every prompt the engine uses.

const AI = { sample: null, state: 'connecting', busy: null, ctrl: null };

(async function connectAI() {
  for (let i = 0; i < 40 && !(window.claude && window.claude.use); i++) await sleep(250);
  try { AI.sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch { AI.sample = null; }
  AI.state = AI.sample ? 'on' : 'off';
  if (typeof renderBar === 'function') { renderBar(); renderMain(); }
})();

const AI_ERRORS = {
  not_granted: 'Claude access was declined for this page. Allow it from the page permissions to use AI steps.',
  rate_limited: 'Claude is rate limited right now. Wait a minute, then try again.',
  prompt_too_large: 'That input is too large for one request. Try a smaller file or fewer sections.',
  invalid_json: 'Claude returned a response the engine could not read. Try again.',
  cancelled: 'Stopped.',
  tools_unavailable: 'Guided search is not available here. Try again; the engine will search requirement by requirement.',
};

async function askJSON(prompt, { label = 'Working', tier = 'default', tools } = {}) {
  if (!AI.sample) throw new Error('AI steps need the claude.ai viewer. Open this page on claude.ai to use them.');
  AI.ctrl = new AbortController();
  AI.busy = label;
  renderBar();
  toast(label + '…', { sticky: true, cancel: true });
  try {
    const opts = { modelTier: tier, cache: false, signal: AI.ctrl.signal };
    if (tools) opts.tools = tools;
    return await AI.sample.json(prompt, opts);
  } catch (e) {
    throw new Error(AI_ERRORS[e && e.code] || (e && e.message) || 'Claude request failed.');
  } finally {
    AI.busy = null; AI.ctrl = null;
    renderBar();
    toast('');
  }
}
function cancelAI() { if (AI.ctrl) AI.ctrl.abort(); }

const RULES_NO_FAB = `Never invent facts, numbers, client names, certifications, dates or results. Every factual claim must come from the provided library blocks or the RFP text. When something needed is not in the provided material, write a marker like [NEEDS INPUT: what is missing] instead of guessing.
Source tiers decide how material may be used:
${Object.entries(TIERS).map(([k, t]) => `- ${t.label} (${k}): ${t.use}`).join('\n')}
When sources disagree, prefer the approved library and approved facts, then the most recently updated source, and list the disagreement under "conflicts" when the output format has that field.`;

function typeLabel(p) { return (RESPONSE_TYPES.find(t => t.id === p.type) || RESPONSE_TYPES[0]).label; }
function aType(p) { const l = typeLabel(p); return (/^[aeiou]|^RF|^SOW/i.test(l) && !/^U(?!n)/.test(l) ? 'an ' : 'a ') + l; }
function tierTag(b) { const t = TIERS[b.tier || 'approved']; return `${t ? t.short : 'Approved'}${b.updated ? ', updated ' + String(b.updated).slice(0, 10) : ''}${b.origin === 'glean' || b.origin === 'pinned' ? ', internal source' : ''}`; }

function ctxText(p) {
  const c = p.context;
  return [
    c.client && 'Client: ' + c.client,
    c.bidding && 'What we are bidding on: ' + c.bidding,
    c.winThemes && 'Win themes: ' + c.winThemes,
    'Response type: ' + typeLabel(p),
    c.notes && 'Internal notes on the client (context only, never quote them or name people from them unless the RFP does): ' + c.notes,
    p.objectives.length && 'Client objectives: ' + p.objectives.map((o, i) => (i + 1) + '. ' + o).join(' '),
  ].filter(Boolean).join('\n');
}

/* 1. Requirement extraction, one chunk of one RFP file at a time. */
function promptExtract(file, chunk, ci, cn) {
  return `You are a proposal analyst reading a client's document package for ${aType(S.project)}. Extract every requirement from this excerpt.

File: "${file.name}" (part ${ci + 1} of ${cn})
Excerpt (page markers look like [[PAGE n]], sheet rows look like [[ROW sheet:n]]):
"""
${chunk}
"""

Return JSON with this shape:
{
 "docType": one of "instructions" | "scope" | "technical-requirements" | "functional-requirements" | "requirements-matrix" | "pricing-form" | "required-form" | "addendum" | "qa-responses" | "contract" | "other",
 "requirements": [{
   "text": verbatim requirement text, trimmed to the requirement itself (max 400 chars),
   "page": page number or sheet row reference as a string, or "",
   "section": the RFP's own section or item number if shown, or "",
   "type": one of ${REQ_TYPES.map(t => '"' + t + '"').join(' | ')},
   "mandatory": true when the text says shall, must, required, or is a pass/fail item,
   "weight": evaluation weight or points if stated, else "",
   "responseType": one of ${RESP_TYPES.map(t => '"' + t + '"').join(' | ')}
 }],
 "formatRules": { only keys you actually find: "pageLimit", "fontFamily", "fontSize", "margins", "numbering", "volumes", "fileFormat", "otherRules" (array of strings) },
 "mandatedStructure": [ if the excerpt prescribes the proposal's section order, list it as {"num": "...", "title": "...", "pageLimit": number or null} ; else [] ],
 "evaluationCriteria": [{ "criterion": "...", "weight": "..." }],
 "keyDates": [{ "label": "...", "date": "..." }]
}
Rules:
- "format" is for layout rules (page limits, fonts, section order). "submission" is for how and when to submit. "instruction" is general guidance that needs no answer. "evaluation" is scoring criteria.
- For a requirements spreadsheet, each row that asks something of the vendor is one requirement with responseType "compliance-matrix" and page set to the row reference.
- Do not merge distinct requirements. Do not invent requirements. Keep the client's wording.`;
}

/* 2. Objectives and recommended format. */
function promptFormat(p) {
  const reqs = p.requirements.map(r => `${r.id} | ${r.type} | ${r.mandatory ? 'M' : 'O'} | ${r.section || ''} | ${r.text.slice(0, 220)}`).join('\n');
  const mandated = p.mandated || [];
  const crit = p.criteria || [];
  return `You are a senior proposal manager. Recommend the response format for this RFP.

${ctxText(p) || 'No extra context given.'}

Files: ${p.files.filter(f => f.role === 'rfp').map(f => `${f.name} (${f.docType || 'unclassified'})`).join('; ')}
Format rules found: ${JSON.stringify(p.formatRules)}
Mandated structure found in the RFP: ${mandated.length ? JSON.stringify(mandated) : 'none'}
Evaluation criteria found: ${crit.length ? JSON.stringify(crit) : 'none'}

Requirements (id | type | Mandatory/Optional | RFP section | text):
${reqs}

Decide the structure in this order of precedence:
1. If the RFP mandates a structure, mirror it exactly, including its numbering (put the RFP number in "fixedNum").
2. Else if it gives evaluation criteria, order the sections to match the criteria.
3. Else use the team's template for ${aType(p)} (level 2 lines are indented):
${templateSections(p.type || 'rfp').map(t => (t.level === 2 ? '   ' : '') + t.title).join('\n')}

Map every requirement that needs a response to at least one section (instruction and submission items can stay unmapped). Use level 2 sections for sub-parts. Mark sections that summarize the rest (executive summary, conclusion, cover letter) with "summarizes": true.

Return JSON:
{
 "objectives": [3 to 5 short client objectives in the RFP's own language; only 3 if there are only 3],
 "topics": [3 to 8 short topic tags describing what this RFP is about],
 "formatBasis": "rfp-mandated" | "evaluation-criteria" | "default",
 "basisNote": one sentence explaining why,
 "sections": [{ "title": "...", "level": 1 or 2, "fixedNum": "" or the RFP number, "origin": "rfp" | "criteria" | "default", "reqIds": ["R-001"], "pageLimit": number or null, "guidance": one line on what the section must do, "summarizes": boolean }]
}`;
}

/* 3. Format changes from new client input or a plain-language instruction, returned as ops. */
function promptFormatChange(p, { source, instruction, newReqs }) {
  const secs = p.sections.map(s => `${s.id} | ${s.num} | L${s.level} | ${s.title} | reqs: ${s.reqIds.join(',') || '-'} | pages: ${s.pageLimit || '-'} | ${s.userEdited ? 'USER-EDITED' : 'generated'}`).join('\n');
  return `You maintain the structure of an RFP response. Propose changes as a list of operations.

Current sections (id | number | level | title | mapped requirements | page limit | edit state):
${secs}

Format rules: ${JSON.stringify(p.formatRules)}

${source === 'client'
    ? `New client input (addendum, Q&A or revised instructions). New or changed requirements:\n${newReqs.map(r => `${r.id} | ${r.type} | ${r.mandatory ? 'M' : 'O'} | ${r.text.slice(0, 300)}`).join('\n')}\n${instruction ? 'Extra notes from this input: ' + instruction : ''}`
    : `Instruction from the proposal team: "${instruction}"`}

Order of precedence: client-mandated input beats user edits, and user edits beat engine suggestions.
${source === 'client'
    ? 'This is client input. It may change USER-EDITED sections when the client requires it; set "overridesUser": true on those ops. Map every new requirement that needs a response to a section.'
    : 'This is a user instruction. Apply it. If it conflicts with a client-mandated rule (page limits, mandated order), still return the op but set "conflictsWithClient": true and explain the conflict in "reason".'}

Allowed ops:
{"op":"add","after": sectionId or null for the top,"title","level":1|2,"reqIds":[],"pageLimit":null,"guidance":""}
{"op":"remove","id"}
{"op":"rename","id","title"}
{"op":"move","id","after": sectionId or null}
{"op":"merge","ids":[...],"title"}
{"op":"split","id","into":[{"title","reqIds":[]}]}
{"op":"map","id","reqIds":[...]}   (sets the full list)
{"op":"limit","id","pageLimit": number or null}
{"op":"level","id","level":1|2}
{"op":"rule","key","value"}        (format rules such as pageLimit, fontFamily, fontSize)

Return JSON: {"ops":[{...op fields, "reason": "short why", "overridesUser": boolean, "conflictsWithClient": boolean}], "summary": "one sentence"}
Return only ops that are needed.`;
}

/* 4. Library tagging, in batches. */
function promptTag(blocks, known) {
  return `Tag these content library blocks for retrieval in RFP responses.
Known tags so far (reuse when they fit): ${known.join(', ') || 'none'}

Blocks:
${blocks.map(b => `### ${b.id} | ${b.title}\n${b.text.slice(0, 700)}`).join('\n\n')}

Return JSON: {"blocks":[{"id":"B-001","tags":[2 to 6 short lowercase topic tags],"summary":"one sentence on what the block covers"}]}`;
}
function promptTagImages(assets, known) {
  return `Tag these images from a proposal content library using their names and captions.
Known tags: ${known.join(', ') || 'none'}
${assets.map(a => `${a.id} | ${a.name} | ${a.caption || ''} | from ${a.fileName || 'upload'}`).join('\n')}
Return JSON: {"assets":[{"id":"...","tags":[2 to 5 tags],"caption":"short figure caption, keep the given one if it is good"}]}`;
}

/* 5. Outline: one section at a time, with the retrieved candidates. */
function promptOutline(p, sec, cands, imgs) {
  const reqs = sec.reqIds.map(reqById).filter(Boolean);
  return `You are drafting the outline of one section of an RFP response. Do not write prose yet.

${ctxText(p)}

Section ${sec.num} "${sec.title}"${sec.pageLimit ? ` (page limit ${sec.pageLimit})` : ''}
What it must do: ${sec.guidance || 'n/a'}
Requirements it must answer:
${reqs.map(r => `${r.id} (${r.mandatory ? 'mandatory' : 'optional'}): ${r.text}`).join('\n') || 'none mapped'}

Candidate source blocks (already filtered by topic and matched on requirement text; tier and freshness in brackets):
${cands.map(b => `### ${b.id} | ${b.title} | [${tierTag(b)}] | tags: ${b.tags.join(', ')}\n${b.text.slice(0, 650)}`).join('\n\n') || 'none'}

Candidate images:
${imgs.map(a => `${a.id} | ${a.source === 'figma' ? 'PRODUCT (Figma library)' : a.source === 'example' ? 'example' : 'uploaded, non-product'} | ${a.caption || a.name} | tags: ${(a.tags || []).join(', ')}`).join('\n') || 'none'}
Image rule: product screenshots, UI, product diagrams and product graphics must come only from PRODUCT (Figma library) images. Uploaded images may be used only for non-product visuals such as team photos, maps, org charts or client logos.

${RULES_NO_FAB}

Return JSON:
{
 "keyPoints": [3 to 7 bullets the section should make, each tied to a requirement or objective],
 "blocks": [{"id":"B-...","reason":"one line on why it fits","mode":"verbatim" | "tailored" | "synthesized"}],
 "gaps": [{"text":"what is missing and why it matters","owner":"who likely has it, e.g. pricing lead, SME"}],
 "visuals": [{"assetId":"A-... or null","need":"what the visual shows","reason":"why it helps here"}],
 "tables": [{"kind":"compliance" | "timeline" | "team" | "custom","title":"...","reason":"..."}],
 "conflicts": [{"text":"what disagrees, e.g. customer count 31 in B-001 vs 34 in B-014","sources":["B-..."],"resolution":"which value to use and why"}]
}
Rules: only choose blocks from the candidates. Use "verbatim" only for approved-tier boilerplate that fits as is, never for other tiers, "tailored" when names or objectives need swapping in, "synthesized" when several blocks combine. List a gap only when no candidate covers the point. Suggest a visual only when it adds something; use assetId null when no image fits (that becomes a NEEDS VISUAL marker).`;
}

/* 6. Drafting, one section at a time. */
function promptDraft(p, sec, chosen, verbatim, others) {
  const reqs = sec.reqIds.map(reqById).filter(Boolean);
  const prior = sec.blocks.filter(b => b.type === 'text' || b.type === 'callout').map(b => htmlToText(b.html)).join('\n\n').slice(0, 5000);
  return `Write section ${sec.num} "${sec.title}" of ${aType(p)}.

${ctxText(p)}

Requirements this section must answer:
${reqs.map(r => `${r.id}: ${r.text}`).join('\n') || 'none mapped'}
Key points agreed in the outline:
${sec.keyPoints.map(k => '- ' + k).join('\n') || '- none'}
Known gaps (do not fill these, mark them): ${sec.gaps.map(g => g.text).join('; ') || 'none'}

Source blocks to tailor or synthesize from (cite their ids; tier in brackets decides how each may be used):
${chosen.map(b => `### ${b.id} | ${b.title} | mode: ${b._mode} | [${tierTag(b)}]\n${b.text.slice(0, 2500)}`).join('\n\n') || 'none'}
${(sec.conflicts || []).length ? 'Resolved conflicts to respect: ' + sec.conflicts.map(c => c.text + ' -> ' + c.resolution).join('; ') : ''}

Library blocks that will be inserted word for word (do not repeat their content; you may place them with {"type":"verbatim"}):
${verbatim.map(b => `${b.id} | ${b.title} | ${b.text.slice(0, 200)}`).join('\n') || 'none'}
${others ? `\nThe rest of the response, for summarizing (section: opening text):\n${others}` : ''}
${prior && sec.feedback ? `\nCurrent draft:\n${prior}\n\nReviewer feedback to apply: ${sec.feedback}` : ''}

Target length: about ${wordBudget(sec)} words in total.
Formatting: plain HTML using only <p>, <ul>, <li>, <b>, <i>. No headings, the section title is added separately.
${RULES_NO_FAB}
Address the client by name when known. Answer every listed requirement explicitly.

Return JSON:
{"items":[
  {"type":"text","html":"<p>...</p>","sources":["B-001","R-004"],"mode":"tailored" | "synthesized"},
  {"type":"verbatim","blockId":"B-002"},
  {"type":"callout","html":"<p>short key stat or proof point</p>","sources":["B-003"]}
]}
Every text and callout item must list the block ids and requirement ids it draws on in "sources".`;
}

/* 7. Requirements matrix answers, in batches. */
function promptMatrix(p, rows) {
  return `Answer rows of an RFP requirements compliance matrix using only the vendor's content library.

${ctxText(p)}

${rows.map(r => `=== ${r.req.id}: ${r.req.text}\nCandidate blocks:\n${r.cands.map(b => `${b.id} | ${b.title}: ${b.text.slice(0, 450)}`).join('\n') || 'none'}`).join('\n\n')}

${RULES_NO_FAB}
Return JSON: {"rows":[{"reqId":"R-001","status":"Comply" | "Partial" | "Roadmap" | "Does not comply" | "Needs input","comment":"1 to 3 sentences for the client","sources":["B-..."],"confidence":"high" | "medium" | "low"}]}
Use "Needs input" with low confidence when the candidates do not answer the row.`;
}
