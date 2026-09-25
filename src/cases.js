/* ---------- case studies (published Bidgely results) ---------- */
const CASES = [
  { name: "APS", full: "Arizona Public Service", program: "High Bill Analyzer in the call center",
    stats: [["+7%", "CX score on calls using it"], ["68%", "CSR utilization"], ["82%", "advisor like rate"]],
    url: "https://www.bidgely.com/pdf/aps-high-bill-advisor-snapshot" },
  { name: "PSEG Long Island", full: "PSEG Long Island", program: "Time-of-Day rate transition",
    stats: [["~900k", "customers moved to TOD rates"], ["98%", "retention"], ["250k+", "personalized rate comparisons"]],
    url: "https://www.bidgely.com/podcast/pseg-long-island-tod-rate-rollout" },
  { name: "Southern Company", full: "Southern Company", program: "Modernized HERs, CX and TOU coaching",
    stats: [["124%", "of year-one savings target"], ["85%+", "CSAT in year one"]],
    url: "https://www.bidgely.com/webinar/cx-dsm-modernization-customer-snapshot" },
  { name: "Dominion Energy", full: "Dominion Energy South Carolina", program: "Targeted DSM and Home Energy Reports",
    stats: [["+27%", "above HER savings forecast"]],
    url: "https://www.bidgely.com/webinar/how-dominion-and-oge-turn-data-into-action-with-targeted-customer-programs" },
];
function buildCases() {
  $("#case-grid").innerHTML = CASES.map(c => `<a class="case" href="${c.url}" target="_blank" rel="noopener">
    <span class="case-mark">${esc(c.name)}</span>
    <b>${esc(c.program)}</b>
    <span class="case-stats">${c.stats.map(([v, l]) => `<span><strong>${esc(v)}</strong><em>${esc(l)}</em></span>`).join("")}</span>
    <span class="go">Read the story →</span></a>`).join("");
}
