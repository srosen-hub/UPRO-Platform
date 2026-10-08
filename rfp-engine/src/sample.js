// Example project: a made-up utility RFP and a made-up vendor library, so every step shows real-looking work.

function svgData(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

const EX_ARCH = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="460" viewBox="0 0 960 460" font-family="Arial, sans-serif">
<rect width="960" height="460" fill="#ffffff"/>
<text x="30" y="40" font-size="20" font-weight="700" fill="#102a43">Platform architecture (example)</text>
<g font-size="14" fill="#102a43">
<rect x="30" y="70" width="200" height="340" rx="8" fill="#eef4f9" stroke="#1d5c8c"/><text x="50" y="100" font-weight="700">Utility systems</text>
<text x="50" y="140">Meter data (AMI)</text><text x="50" y="175">Billing / CIS</text><text x="50" y="210">Outage system</text><text x="50" y="245">Program data</text>
<rect x="300" y="70" width="330" height="340" rx="8" fill="#f6f8fa" stroke="#7a8494"/><text x="320" y="100" font-weight="700">Northbeam platform</text>
<rect x="320" y="120" width="290" height="70" rx="6" fill="#fff" stroke="#b9c0cb"/><text x="335" y="150">Secure data intake</text><text x="335" y="172" font-size="12" fill="#5b6573">SFTP and API, encrypted at rest</text>
<rect x="320" y="205" width="290" height="70" rx="6" fill="#fff" stroke="#b9c0cb"/><text x="335" y="235">Usage analytics</text><text x="335" y="257" font-size="12" fill="#5b6573">Bill forecasts, appliance estimates</text>
<rect x="320" y="290" width="290" height="70" rx="6" fill="#fff" stroke="#b9c0cb"/><text x="335" y="320">Engagement engine</text><text x="335" y="342" font-size="12" fill="#5b6573">Targeting, scheduling, A/B tests</text>
<rect x="700" y="70" width="230" height="340" rx="8" fill="#eef4f9" stroke="#1d5c8c"/><text x="720" y="100" font-weight="700">Customer channels</text>
<text x="720" y="140">Web portal widgets</text><text x="720" y="175">Email and SMS alerts</text><text x="720" y="210">Mobile app SDK</text><text x="720" y="245">Contact center view</text>
</g><g stroke="#1d5c8c" stroke-width="2" fill="none"><path d="M230 240 H300"/><path d="M630 240 H700"/></g>
<path d="M292 234 l8 6 -8 6z M692 234 l8 6 -8 6z" fill="#1d5c8c"/></svg>`);

const EX_PORTAL = svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440" viewBox="0 0 720 440" font-family="Arial, sans-serif">
<rect width="720" height="440" fill="#f4f6f8"/><rect x="20" y="20" width="680" height="400" rx="10" fill="#fff" stroke="#d8dce3"/>
<rect x="20" y="20" width="680" height="48" rx="10" fill="#1d5c8c"/><text x="40" y="50" fill="#fff" font-size="16" font-weight="700">My Energy (example screen)</text>
<text x="40" y="100" font-size="13" fill="#5b6573">Projected bill this month</text><text x="40" y="135" font-size="30" font-weight="700" fill="#102a43">$142</text>
<text x="40" y="160" font-size="12" fill="#b3261e">$18 higher than last month, mostly cooling</text>
<g transform="translate(40 190)"><rect width="300" height="200" fill="#f8fafc" stroke="#e3e7ec"/>
<g fill="#1d5c8c"><rect x="20" y="120" width="26" height="70"/><rect x="60" y="100" width="26" height="90"/><rect x="100" y="80" width="26" height="110"/><rect x="140" y="60" width="26" height="130"/><rect x="180" y="40" width="26" height="150"/></g>
<rect x="220" y="30" width="26" height="160" fill="#9fc3df"/><text x="20" y="20" font-size="12" fill="#5b6573">Monthly use, kWh</text></g>
<g transform="translate(370 190)"><rect width="300" height="200" fill="#f8fafc" stroke="#e3e7ec"/><text x="16" y="24" font-size="12" fill="#5b6573">Where your energy went</text>
<circle cx="90" cy="115" r="62" fill="none" stroke="#1d5c8c" stroke-width="28" stroke-dasharray="170 400"/><circle cx="90" cy="115" r="62" fill="none" stroke="#6fb0e3" stroke-width="28" stroke-dasharray="90 400" stroke-dashoffset="-170"/><circle cx="90" cy="115" r="62" fill="none" stroke="#c9d6e2" stroke-width="28" stroke-dasharray="130 400" stroke-dashoffset="-260"/>
<g font-size="12" fill="#102a43"><rect x="180" y="80" width="10" height="10" fill="#1d5c8c"/><text x="196" y="89">Cooling 44%</text><rect x="180" y="105" width="10" height="10" fill="#6fb0e3"/><text x="196" y="114">Water heat 23%</text><rect x="180" y="130" width="10" height="10" fill="#c9d6e2"/><text x="196" y="139">Other 33%</text></g></g></svg>`);

function exampleProject() {
  const p = newProject('HCU 2026-014 Customer Engagement Platform');
  p.example = true;
  p.exportAuthor = 'Northbeam Energy Software';
  p.context = {
    client: 'Harbor City Utilities',
    bidding: 'Customer web portal widgets, proactive bill alerts, and contact center tools for 410,000 residential electric customers.',
    winThemes: 'Fewer high-bill calls in the first year. Live in 9 months, not 18. Proven at two other municipal utilities.',
    notes: 'Pre-bid call: they care most about high-bill calls in summer, and their IT team is small. Incumbent portal contract ends June 2027.',
  };
  p.style = JSON.parse(JSON.stringify(DEFAULT_STYLE));
  const f1 = { id: 'f-ex1', name: 'HCU-RFP-2026-014 Instructions.pdf', ext: 'pdf', role: 'rfp', processed: true, docType: 'instructions', reqCount: 5, pages: [
    { n: 3, text: 'Section 4. Proposal Format\n\n4.1 Proposals shall not exceed 30 pages, excluding appendices and required forms.\n\n4.2 Proposals shall use a font no smaller than 11 point.\n\n4.3 Proposals shall be organized in the following order: (1) Executive Summary, (2) Understanding of Requirements, (3) Technical Approach, (4) Implementation Plan, (5) Experience and References, (6) Pricing, submitted as a separate file.' },
    { n: 4, text: 'Section 5. Evaluation\n\nTechnical Approach 35 points. Implementation Plan 20 points. Experience and References 20 points. Pricing 25 points.\n\nSection 6. Submission\n\n6.1 Proposals are due October 30, 2026 at 2:00 PM Pacific through the HCU supplier portal.' },
  ], text: '' };
  f1.text = f1.pages.map(pg => `[[PAGE ${pg.n}]]\n${pg.text}`).join('\n\n');
  const f2 = { id: 'f-ex2', name: 'Attachment B - Scope and Requirements.docx', ext: 'docx', role: 'rfp', processed: true, docType: 'technical-requirements', reqCount: 8, pages: [{ n: 1, text: 'B.1 The solution must provide customers with a projected bill for the current billing cycle, updated at least daily.\nB.2 The solution must send proactive alerts by email and SMS when a customer is projected to exceed their typical bill.\nB.3 The solution shall integrate with HCU\'s Oracle CC&B billing system and its AMI head-end.\nB.4 The solution shall give contact center agents a single view of a customer\'s usage, bills and alerts.\nB.5 Describe your approach to data security, including SOC 2 Type II status and encryption.\nB.6 The solution shall meet WCAG 2.1 AA accessibility standards.\nB.7 Provide an implementation plan with milestones from contract signature to launch.\nB.8 Provide three references from utilities of similar size.' }], text: '' };
  f2.text = f2.pages[0].text;
  const lib1 = { id: 'f-ex3', name: 'Northbeam Capabilities Library.docx', ext: 'docx', role: 'library', blockCount: 7, pages: [], text: '' };
  const lib2 = { id: 'f-ex4', name: 'Case Studies 2026.pdf', ext: 'pdf', role: 'library', blockCount: 2, pages: [], text: '' };
  p.files = [f1, f2, lib1, lib2];

  const R = (id, text, f, page, section, type, mandatory, responseType, weight = '') => ({ id, text, fileId: f.id, fileName: f.name, page, section, type, mandatory, weight, responseType });
  p.requirements = [
    R('R-001', 'Proposals shall not exceed 30 pages, excluding appendices and required forms.', f1, '3', '4.1', 'format', true, 'narrative'),
    R('R-002', 'Proposals shall use a font no smaller than 11 point.', f1, '3', '4.2', 'format', true, 'narrative'),
    R('R-003', 'Proposals shall be organized in the following order: Executive Summary, Understanding of Requirements, Technical Approach, Implementation Plan, Experience and References, Pricing (separate file).', f1, '3', '4.3', 'format', true, 'narrative'),
    R('R-004', 'Proposals are due October 30, 2026 at 2:00 PM Pacific through the HCU supplier portal.', f1, '4', '6.1', 'submission', true, 'narrative'),
    R('R-005', 'Technical Approach 35 points. Implementation Plan 20 points. Experience and References 20 points. Pricing 25 points.', f1, '4', '5', 'evaluation', false, 'narrative'),
    R('R-006', 'The solution must provide customers with a projected bill for the current billing cycle, updated at least daily.', f2, '', 'B.1', 'functional', true, 'narrative'),
    R('R-007', 'The solution must send proactive alerts by email and SMS when a customer is projected to exceed their typical bill.', f2, '', 'B.2', 'functional', true, 'narrative'),
    R('R-008', 'The solution shall integrate with HCU\'s Oracle CC&B billing system and its AMI head-end.', f2, '', 'B.3', 'technical', true, 'narrative'),
    R('R-009', 'The solution shall give contact center agents a single view of a customer\'s usage, bills and alerts.', f2, '', 'B.4', 'functional', true, 'narrative'),
    R('R-010', 'Describe your approach to data security, including SOC 2 Type II status and encryption.', f2, '', 'B.5', 'technical', true, 'narrative'),
    R('R-011', 'The solution shall meet WCAG 2.1 AA accessibility standards.', f2, '', 'B.6', 'technical', true, 'yes/no'),
    R('R-012', 'Provide an implementation plan with milestones from contract signature to launch.', f2, '', 'B.7', 'functional', true, 'narrative'),
    R('R-013', 'Provide three references from utilities of similar size.', f2, '', 'B.8', 'commercial', true, 'narrative'),
  ];
  p.reqSeq = 13;
  p.objectives = ['Reduce high-bill calls and complaints', 'Give customers a daily view of where their bill is heading', 'Equip contact center agents with one view of the customer'];
  p.topics = ['bill alerts', 'customer portal', 'contact center', 'integration', 'security', 'implementation'];
  p.formatRules = { pageLimit: 30, fontSize: '11pt', otherRules: ['Pricing submitted as a separate file'] };
  p.keyDates = [{ label: 'Proposal due', date: 'October 30, 2026, 2:00 PM Pacific' }];
  p.formatBasis = 'rfp-mandated';
  p.basisNote = 'Section 4.3 of the instructions sets the order, so the response follows it exactly.';

  const B = (id, title, text, f, loc, tags, summary) => ({ id, title, text, fileId: f.id, fileName: f.name, loc, tags, summary });
  p.library = [
    B('B-001', 'Company overview', 'Northbeam Energy Software builds customer engagement tools for electric and gas utilities. We have worked only with utilities since 2014 and today support 31 utilities and 6.2 million meters across North America. Our team of 140 includes former utility customer service and IT leaders.', lib1, 'About Northbeam', ['company', 'overview'], 'Who Northbeam is, size and focus.'),
    B('B-002', 'Bill projection', 'Every customer with an AMI meter gets a projected bill for the current cycle, refreshed each night from the previous day\'s interval data and the customer\'s rate. Projections at our live utilities land within 6% of the final bill by day 10 of the cycle. Customers see the projection in the portal widget and in alerts.', lib1, 'Products › Bill projection', ['bill alerts', 'customer portal', 'analytics'], 'Daily projected bill from AMI data, accuracy figures.'),
    B('B-003', 'High bill alerts', 'When a projected bill runs above a customer\'s typical range, we send an alert by email, SMS or both, with the likely cause, such as cooling or a new appliance, and two or three things the customer can do this week. Utilities set the thresholds and the quiet hours. At Pinecrest Public Power, alerted customers called about high bills 38% less than a matched control group.', lib1, 'Products › Alerts', ['bill alerts', 'email', 'sms'], 'Proactive high bill alerts with causes and results.'),
    B('B-004', 'Contact center view', 'Agents get one screen with the customer\'s usage, bill history, projected bill, recent alerts and the likely cause of a change. It opens from the CIS account screen with single sign-on. Average handle time for high-bill calls dropped 2.1 minutes at Lakeview Electric after launch.', lib1, 'Products › Agent view', ['contact center', 'csr'], 'Single agent view and handle-time result.'),
    B('B-005', 'Integration approach', 'We take interval data from the AMI head-end or MDM by secure file transfer or API, and billing data from the CIS through a nightly extract. We have live integrations with Oracle CC&B at nine utilities and use a standard data specification, so the utility\'s IT team mainly configures exports rather than building new interfaces.', lib1, 'Technology › Integration', ['integration', 'cis', 'ami'], 'How data gets in, with Oracle CC&B experience.'),
    B('B-006', 'Security and compliance', 'Northbeam has held a SOC 2 Type II report every year since 2018. Customer data is encrypted in transit with TLS 1.2 or higher and at rest with AES-256. Data stays in US data centers. We run annual third-party penetration tests and share summaries under NDA.', lib1, 'Technology › Security', ['security', 'compliance'], 'SOC 2 Type II, encryption and testing.'),
    B('B-007', 'Accessibility', 'Our portal widgets and alert templates are tested against WCAG 2.1 AA before every release, using automated checks and manual screen reader testing.', lib1, 'Technology › Accessibility', ['accessibility', 'customer portal'], 'WCAG 2.1 AA testing.'),
    B('B-008', 'Pinecrest Public Power', 'Pinecrest Public Power (220,000 customers) launched bill projection and alerts in 2024. In the first summer, high-bill calls fell 38% for alerted customers and 71% of customers rated the alerts useful. Launch took eight months from contract.', lib2, 'p. 2', ['case study', 'bill alerts', 'municipal'], 'Municipal case study with call reduction.'),
    B('B-009', 'Lakeview Electric', 'Lakeview Electric (390,000 customers) added the contact center view and portal widgets in 2025, integrated with Oracle CC&B. Handle time for high-bill calls fell 2.1 minutes, and portal logins rose 24% in the first six months.', lib2, 'p. 3', ['case study', 'contact center', 'integration'], 'CC&B case study with handle time.'),
  ];
  p.blockSeq = 9;
  p.assets = [
    { id: 'A-001', source: 'example', name: 'architecture.svg', caption: 'How data flows from utility systems to customer channels', tags: ['integration', 'architecture'], dataUrl: EX_ARCH, thumb: EX_ARCH },
    { id: 'A-002', source: 'example', name: 'portal.svg', caption: 'Projected bill and usage breakdown in the portal', tags: ['customer portal', 'bill alerts'], dataUrl: EX_PORTAL, thumb: EX_PORTAL },
  ];

  const sec = (title, num, reqIds, o = {}) => { const s = newSection(Object.assign({ title, fixedNum: num, origin: 'rfp', reqIds }, o)); s.userEdited = false; return s; };
  const s1 = sec('Executive Summary', '1', [], { summarizes: true, pageLimit: 2, guidance: 'Restate HCU\'s goals and why we are the low-risk choice.' });
  const s2 = sec('Understanding of Requirements', '2', ['R-006', 'R-007', 'R-009'], { pageLimit: 3, guidance: 'Show we understand the high-bill call problem in HCU\'s terms.' });
  const s3 = sec('Technical Approach', '3', ['R-006', 'R-007', 'R-008', 'R-009', 'R-010', 'R-011'], { pageLimit: 10, guidance: 'Worth 35 points. Answer each requirement in B.1 to B.6 explicitly.' });
  const s31 = sec('Bill Projection and Alerts', '3.1', ['R-006', 'R-007'], { level: 2 });
  const s32 = sec('Integration and Security', '3.2', ['R-008', 'R-010', 'R-011'], { level: 2 });
  const s4 = sec('Implementation Plan', '4', ['R-012'], { pageLimit: 5, guidance: 'Worth 20 points. Milestones from signature to launch.' });
  const s5 = sec('Experience and References', '5', ['R-013'], { pageLimit: 4, guidance: 'Worth 20 points. Three similar-size utilities.' });
  const s6 = sec('Pricing', '6', [], { guidance: 'Submitted as a separate file per section 4.3. Placeholder only.' });
  s3.reqIds = ['R-009'];
  p.sections = [s1, s2, s3, s31, s32, s4, s5, s6];

  s1.keyPoints = ['HCU wants fewer high-bill calls and a daily bill view', 'We deliver both, live in 9 months', 'Proven at Pinecrest and Lakeview'];
  s1.blockRefs = [{ id: 'B-001', reason: 'Company background in one paragraph', mode: 'tailored' }];
  s1.status = 'outlined';

  s2.keyPoints = ['Summer high-bill calls are the main pain', 'Small IT team means integration must be light', 'Agents need one view'];
  s2.blockRefs = [{ id: 'B-003', reason: 'Ties alerts to call reduction', mode: 'synthesized' }];
  s2.status = 'drafted';
  s2.blocks = [
    newBlock({ type: 'text', mode: 'synthesized', sources: [{ t: 'req', id: 'R-006' }, { t: 'req', id: 'R-007' }], html: '<p>Harbor City\'s customers find out their bill is high when it arrives. By then the hot week that caused it is over and the only thing left to do is call. Your RFP asks for two things that change that: a projected bill customers can check any day of the cycle, and an alert that reaches them before the bill does.</p><p>Your team told us on the pre-bid call that summer is when this hurts most, and that IT capacity is tight. We have planned around both.</p>' }),
    newBlock({ type: 'callout', mode: 'synthesized', sources: [{ t: 'lib', id: 'B-008' }], html: '<p><b>38% fewer high-bill calls</b> from alerted customers in Pinecrest Public Power\'s first summer.</p>' }),
    newBlock({ type: 'text', mode: 'synthesized', sources: [{ t: 'req', id: 'R-009' }, { t: 'lib', id: 'B-004' }], html: '<p>When a customer does call, the agent should be able to see what the customer sees, plus the likely cause of the change. That is the third piece of this response: one view for your contact center that opens straight from CC&amp;B — no second login.</p>' }),
  ];

  s31.keyPoints = ['Nightly projection from AMI interval data (B.1)', 'Alerts by email and SMS with likely cause (B.2)', 'Thresholds and quiet hours set by HCU'];
  s31.blockRefs = [{ id: 'B-002', reason: 'Answers B.1 directly', mode: 'verbatim' }, { id: 'B-003', reason: 'Answers B.2 with a result', mode: 'tailored' }];
  s31.visuals = [{ assetId: 'A-002', need: 'Portal view of the projected bill', reason: 'Shows B.1 in one glance' }];
  s31.status = 'drafted';
  s31.blocks = [
    newBlock({ type: 'text', mode: 'verbatim', sources: [{ t: 'lib', id: 'B-002' }], html: textToHtml(p.library[1].text) }),
    newBlock({ type: 'image', assetId: 'A-002', caption: 'Projected bill and usage breakdown in the portal', width: 'half' }),
    newBlock({ type: 'text', mode: 'tailored', width: 'half', sources: [{ t: 'lib', id: 'B-003' }, { t: 'req', id: 'R-007' }], html: '<p>When a projected bill runs above a customer\'s usual range, we send an email, a text or both. Each alert names the likely cause and gives two or three things to try this week.</p><p>HCU sets the thresholds and quiet hours. We recommend starting with a [NEEDS INPUT: HCU threshold preference, e.g. 20% above typical] trigger for summer.</p>' }),
  ];

  s32.keyPoints = ['Nightly CC&B extract plus AMI file transfer (B.3)', 'SOC 2 Type II since 2018, AES-256 at rest (B.5)', 'WCAG 2.1 AA tested every release (B.6)'];
  s32.blockRefs = [{ id: 'B-005', reason: 'CC&B experience', mode: 'tailored' }, { id: 'B-006', reason: 'Answers B.5', mode: 'verbatim' }, { id: 'B-007', reason: 'Answers B.6', mode: 'verbatim' }];
  s32.visuals = [{ assetId: 'A-001', need: 'Data flow', reason: 'Makes the light integration visible' }];
  s32.status = 'outlined';

  s4.keyPoints = ['Nine months from signature to launch', 'Milestones: kickoff, data integration, testing, pilot, launch'];
  s4.gaps = [{ text: 'Named HCU dependencies and dates for IT export setup', owner: 'Delivery lead' }];
  s4.tables = [{ kind: 'timeline', title: 'Implementation milestones', reason: 'B.7 asks for milestones' }];
  s4.status = 'outlined';

  s5.blockRefs = [{ id: 'B-008', reason: 'Similar municipal utility', mode: 'tailored' }, { id: 'B-009', reason: 'Similar size, CC&B', mode: 'tailored' }];
  s5.gaps = [{ text: 'Third reference of similar size, with contact details', owner: 'Account lead' }];
  s5.status = 'outlined';

  numberSections(p);
  p.changeLog = [
    { ts: Date.now() - 3600e3, source: 'engine', text: 'Recommended an 8-section format (rfp mandated).' },
    { ts: Date.now() - 3000e3, source: 'user', text: 'Split Technical Approach into 3.1 and 3.2.' },
  ];
  s3.userEdited = true;
  return p;
}
