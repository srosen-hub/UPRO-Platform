/* ---------- Engines · APIs · MCPs explorer (dialog) ---------- */
// Per-component detail: what goes in, what comes out, and a small example of the output.
const bars = (rows, max, unit = "") => rows.map(([n, v, c]) => `<div class="drv"><span>${esc(n)}</span><span class="track"><i style="width:${Math.abs(v) / max * 100}%;background:var(${c || "--accent"})"></i></span><b style="text-align:right">${esc(String(v))}${unit}</b></div>`).join("");
const kv = (rows) => rows.map(([k, v]) => `<div class="mock-row"><span class="muted">${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
const json = (o) => `<div class="cmd"><code style="white-space:pre-wrap">${esc(JSON.stringify(o, null, 1).replace(/\n\s*/g, " "))}</code></div>`;
const ENGINE_DETAIL = {
  "e-agg":  { in: ["Hourly end-use outputs per meter", "GIS meter-to-asset mapping"], out: ["8760 end-use load shapes per transformer, feeder, network"],
    ex: () => `<div class="lbl">Feeder F-2231 · peak hour 18:00</div>${bars([["Cooling", 2.9, "--c-cool"], ["EV charging", 1.6, "--c-ev"], ["Base load", 3.8, "--c-other"], ["Heat pumps", 0.4, "--c-heat"]], 4, " MW")}${kv([["Meters rolled up", "1,842"], ["Transformers", "96"]])}` },
  "e-flex": { in: ["EV, HVAC, pool, water heating, battery load", "Event window"], out: ["Shiftable kW per customer and hour"],
    ex: () => `<div class="lbl">Customer 40021887 · 4 to 8pm</div>${bars([["EV charging", 6.1, "--c-ev"], ["HVAC", 2.2, "--c-cool"], ["Pool pump", 0.9, "--c-pool"]], 7, " kW")}${kv([["Available in window", "86% of events"]])}` },
  "e-fc":   { in: ["Adoption detections over time", "DER propensity scores"], out: ["Adoption and growth inputs for your forecast models"],
    ex: () => `<div class="lbl">Network N-18 · EV adoption inputs</div>${kv([["Current share", "14.2%"], ["12-month growth", "+4.1 pts"], ["High-propensity homes", "2,310"], ["2030 projected share", "27%"]])}` },
  "e-kw":   { in: ["AMI kWh intervals"], out: ["kW demand values and peaks"],
    ex: () => `<div class="lbl">15-minute interval to demand</div>${kv([["Interval energy", "1.8 kWh"], ["Demand", "7.2 kW"], ["Monthly peak", "9.4 kW at 18:15"]])}` },
  "e-rate": { in: ["Interval usage", "Rate catalog"], out: ["Cost at any granularity, past or forward-looking"],
    ex: () => `<div class="lbl">Yesterday, TOU plan</div>${bars([["Off-peak", 4.12, "--c-ev"], ["Mid-peak", 2.05, "--c-solar"], ["On-peak", 3.60, "--c-heat"]], 4.5, "")}${kv([["Total", "$9.77"]])}` },
  "e-cost": { in: ["Usage", "Rate engine output"], out: ["Usage and cost by day, month and TOU band"],
    ex: () => `<div class="lbl">August by TOU band</div>${bars([["Off-peak", 92, "--c-ev"], ["Mid-peak", 38, "--c-solar"], ["On-peak", 64, "--c-heat"]], 100, "")}${kv([["Bill", "$194"]])}` },
  "e-bp":   { in: ["Month-to-date usage", "Seasonality", "Rate engine"], out: ["Projected cost for the open billing cycle"],
    ex: () => `<div class="lbl">Cycle day 15 of 30</div>${kv([["Spent so far", "$84"], ["Projected bill", "$171"], ["Typical bill", "$120"], ["Status", "Alert threshold crossed"]])}` },
  "e-rc":   { in: ["12 months of interval usage", "Eligible plans"], out: ["Annual cost on each plan and the best fit"],
    ex: () => `<div class="lbl">Annual cost by plan</div>${bars([["Standard", 2280, "--c-other"], ["TOU", 1990, "--c-cool"], ["TOU-EV", 1860, "--c-ev"]], 2400, "")}` },
  "e-rec":  { in: ["Disaggregation", "Similar-home gaps", "Tip catalog"], out: ["Ranked savings tips per customer and cycle"],
    ex: () => `<ol class="tips-list"><li>Raise cooling setpoint 2°F, 2 to 7pm <b>$19/mo</b></li><li>AC tune-up <b>$14/mo</b></li><li>Charge EV after 11pm <b>$11/mo</b></li></ol>` },
  "e-hi":   { in: ["All model outputs for a home"], out: ["Personalized insight cards"],
    ex: () => `<div class="notif"><span class="app">${icon("flame")}Insight</span><b>Your AC used 24% more than similar homes in August.</b></div><div class="notif"><span class="app">${icon("ev")}Insight</span><b>70% of your EV charging is already off-peak.</b></div>` },
  "i-api":  { in: ["Customer identity via your gateway"], out: ["Ratepayer-scoped JSON for web, app, CSR tools"],
    ex: () => `<div class="lbl">GET /v1/bill-itemization?account=40021887&amp;cycle=2026-08</div>${json({ total: 194, cooling: 88, ev: 31, always_on: 24, pool_pump: 18 })}` },
  "i-mcp":  { in: ["An agent's tool call"], out: ["Structured answers any AI tool can use"],
    ex: () => `<div class="lbl">tools/call analyze_bill</div>${json({ bill: 194, prior: 142, drivers: { cooling_weather: 38, ev: 9, rate_change: 6 } })}<div class="pill-row">${AI_TOOLS.map(([k, n]) => `<span class="tag" style="display:inline-flex;align-items:center;gap:5px">${logoAI(k)}${n}</span>`).join("")}</div>` },
  "i-awb":  { in: ["Complete Data Layer"], out: ["Segments, maps, program simulations, exports"],
    ex: () => `<div class="lbl">Segment: heat pump candidates</div>${kv([["Homes", "18,240"], ["Expected enrollments", "1,460"], ["Export", "CSV · Marketing cloud"]])}` },
  "i-ea":   { in: ["A plain-language question"], out: ["Governed query + explained answer"],
    ex: () => `<div class="tip-row">${icon("search")}<span>How many homes added an EV this year?</span></div><div class="cmd"><code>SELECT network, COUNT(*) FROM upro.ev_detections WHERE first_seen &gt;= '2026-01-01' GROUP BY 1</code></div>` },
  "i-cc":   { in: ["Operator settings"], out: ["Schedules, thresholds, content and rates for every component"],
    ex: () => `${kv([["Model run", "Nightly 01:00"], ["High bill threshold", "+40%"], ["Checkpoints", "Days 10, 15, 20"], ["Rate catalog", "Updated Sep 1"]])}` },
};
let engSel = "e-agg";
function openEngine(id) {
  engSel = id || engSel;
  const d = $("#eng-dlg");
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
  renderEngine();
}
function renderEngine() {
  const groups = ["Grid & analytics engines", "Customer experience engines", "APIs, MCPs & apps"];
  const ids = Object.keys(NODES).filter(k => NODES[k].band === "engines");
  $("#eng-list").innerHTML = groups.map(g => `<div class="lbl">${g}</div>` + ids.filter(k => NODES[k].group === g).map(k => `<button type="button" class="eng-btn" data-id="${k}" aria-pressed="${k === engSel}">${icon(pickIcon(NODES[k].name + " " + NODES[k].sub))}${esc(NODES[k].name)}</button>`).join("")).join("");
  $("#eng-list").querySelectorAll(".eng-btn").forEach(b => b.addEventListener("click", () => { engSel = b.dataset.id; renderEngine(); }));
  const n = NODES[engSel], D = ENGINE_DETAIL[engSel];
  const ucs = USE_CASES.filter(u => u.trace.includes(engSel));
  $("#eng-detail").innerHTML = `<div class="layer-top"><h3>${esc(n.name)}</h3><p>${esc(sub(n.desc))}</p></div>
    <div class="flow" style="grid-auto-columns:1fr">
      <div class="node-s"><span class="top">${icon("export")}In</span>${D.in.map(x => `<span class="sys">${esc(x)}</span>`).join("")}</div>
      <div class="node-s"><span class="top">${icon("gear")}${esc(n.name)}</span><span class="sys">${esc(sub(n.sub))}</span></div>
      <div class="node-s"><span class="top">${icon("check")}Out</span>${D.out.map(x => `<span class="sys">${esc(x)}</span>`).join("")}</div>
    </div>
    <div class="mock"><div class="mock-bar"><i></i><i></i><i></i><span>Example output</span></div><div class="mock-body">${D.ex()}</div></div>
    ${ucs.length ? `<div><div class="lbl" style="margin-bottom:6px">Powers</div><div class="chips">${ucs.map(u => `<button type="button" class="chip sm" data-uc="${u.id}">${esc(u.short)}</button>`).join("")}</div></div>` : ""}`;
  $("#eng-detail").querySelectorAll("[data-uc]").forEach(b => b.addEventListener("click", () => { $("#eng-dlg").close(); if (document.body.classList.contains("plat-full")) $("#full-btn").click(); openUC(b.dataset.uc); }));
}
