/* ---------- deployment ---------- */
const ICONS = {
  lock: `<svg viewBox="0 0 20 20"><path d="M6 9V6.5a4 4 0 0 1 8 0V9" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="12" height="8.5" rx="2" fill="currentColor"/></svg>`,
  db: `<svg viewBox="0 0 20 20"><ellipse cx="10" cy="5" rx="6" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  key: `<svg viewBox="0 0 20 20"><circle cx="7" cy="10" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10H18M15 10v3M17.5 10v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  check: `<svg viewBox="0 0 20 20"><path d="M10 2 3.5 5v5c0 4 2.8 6.8 6.5 8 3.7-1.2 6.5-4 6.5-8V5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m7 10 2 2 4-4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  arrow: `<svg viewBox="0 0 20 20"><path d="M3 10h11M10 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
};
function renderDeploy() {
  const c = ENV();
  $("#dep-env").textContent = `${c.cloudLabel} + ${c.lakeLabel}`;
  $("#map-table").innerHTML = `<tbody>
    <tr><th>Model runtime</th><td>${esc(c.compute)}<div class="xs muted">Encrypted containers, attested before keys are released</div></td></tr>
    <tr><th>Data layer</th><td>${esc(c.data)}<div class="xs muted">Input builders, output tables, Complete Data Layer</div></td></tr>
    <tr><th>Engines &amp; pipelines</th><td>${esc(c.jobs)}<div class="xs muted">Provisioned from your catalog, scheduled in the Control Center</div></td></tr>
    <tr><th>CX APIs &amp; MCP servers</th><td>Application tier in your tenant, behind your API gateway<div class="xs muted">${esc(c.identity)}</div></td></tr>
    <tr><th>Analytics Workbench</th><td>${esc(c.bi)}</td></tr>
    <tr><th>Internal agents</th><td>${esc(c.agentsInt)}</td></tr>
    <tr><th>Customer-facing agents</th><td>${esc(c.agentsExt)}<div class="xs muted">Evals and guardrails in your platform</div></td></tr>
    <tr><th>Boundary egress</th><td>${esc(c.network)}<div class="xs muted">Key attestation and operational counts only</div></td></tr>
    <tr><th>Environments</th><td>Dev, UAT and Prod</td></tr>
  </tbody>`;
  $("#sec-list").innerHTML = SECURITY.map(s => `<div class="sec-item"><div class="ic">${ICONS[s.ic]}</div><div><h4>${esc(s.h)}</h4><p>${esc(sub(s.p))}</p></div></div>`).join("");
}
