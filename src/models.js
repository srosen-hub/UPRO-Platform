/* ---------- models ---------- */
// Each model tab: what it does, key capabilities, inputs, sub-models (from the UtilityAI Pro model spec),
// one clear visual with callouts, and an expandable sample output record.
let modelTab = "disagg", disaggCat = "cool";

function buildModelTabs() {
  const tabs = $("#model-tabs");
  MODEL_TABS.forEach(t => {
    const b = el("button", { type: "button", class: "tab", role: "tab", id: "tab-" + t.id, "aria-selected": t.id === modelTab, "aria-controls": "model-panels" }, esc(t.name));
    b.addEventListener("click", () => setModelTab(t.id));
    tabs.append(b);
  });
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = MODEL_TABS.findIndex(t => t.id === modelTab);
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + MODEL_TABS.length) % MODEL_TABS.length;
    setModelTab(MODEL_TABS[j].id); $("#tab-" + MODEL_TABS[j].id).focus();
  });
}
function setModelTab(id) {
  modelTab = id;
  document.querySelectorAll("#model-tabs .tab").forEach(b => b.setAttribute("aria-selected", b.id === "tab-" + id));
  renderModel();
}
function renderModel() { ({ disagg: mDisagg, attr: mAttr, ineff: mIneff, life: mLife, prop: mProp, inc: mInc, pi: mPI, rev: mRev })[modelTab](); }

/* ---------- shared layout ---------- */
const ALL_INPUTS = ["Premise enrollment", "AMI usage (15, 30 or 60 min)", "Premise information (opt.)", "Bill cycle schedule (opt.)"];
function panel(m) {
  const node = NODES["m-" + modelTab];
  const p = el("div", { class: "model-panel", role: "tabpanel", "aria-labelledby": "tab-" + modelTab });
  const subs = m.subs ? `<div class="m-block"><span class="lbl">Sub-models</span><table class="subm"><thead><tr><th>Model</th><th>Mode</th><th>Status</th></tr></thead><tbody>${m.subs.map(([n, mode, ok]) => `<tr><td>${esc(n)}</td><td>${esc(mode)}</td><td><span class="st ${ok ? "ok" : "rm"}">${ok ? "Available" : "Roadmap"}</span></td></tr>`).join("")}</tbody></table></div>` : "";
  const c = el("div", { class: "m-copy" }, `<h3>${esc(node.name)}</h3><p>${esc(node.desc)}</p>
    <div class="m-block"><span class="lbl">Key capabilities</span><ul class="caps">${m.caps.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="m-block"><span class="lbl">Data inputs</span><div class="in-chips">${m.inputs.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>
    <div class="m-block"><span class="lbl">Output</span><p class="m-out">${esc(m.out)}</p></div>${subs}`);
  const v = el("div", { class: "viz" });
  p.append(c, v);
  if (m.json) p.append(jsonBlock(m.json));
  const host = $("#model-panels"); host.innerHTML = ""; host.append(p);
  return v;
}
function jsonBlock(samples) {
  const d = el("details", { class: "json-x" });
  const tabs = samples.length > 1 ? `<span class="json-tabs">${samples.map((s, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${esc(s.label)}</button>`).join("")}</span>` : "";
  d.innerHTML = `<summary><span class="chev" aria-hidden="true">+</span>Sample output JSON<span class="muted"> · ${esc(samples[0].note || "illustrative values")}</span></summary>
    <div class="json-body"><div class="json-bar">${tabs}<button type="button" class="btn sm json-copy">Copy</button></div><pre><code></code></pre></div>`;
  let cur = 0;
  const show = () => { d.querySelector("code").innerHTML = hlJson(JSON.stringify(samples[cur].data, null, 2)); };
  show();
  d.querySelectorAll(".json-tabs button").forEach(b => b.addEventListener("click", () => { cur = +b.dataset.i; d.querySelectorAll(".json-tabs button").forEach(x => x.setAttribute("aria-pressed", x === b)); show(); }));
  d.querySelector(".json-copy").addEventListener("click", (e) => {
    const t = JSON.stringify(samples[cur].data, null, 2), btn = e.currentTarget;
    const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy", 1400); };
    try { navigator.clipboard.writeText(t).then(done, done); } catch (_) { done(); }
  });
  return d;
}
function hlJson(s) {
  return esc(s).replace(/(&quot;[^&]*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+\.?\d*(?:e[+-]?\d+)?)/g, (m, str, colon, lit, num) => {
    if (str) return colon ? `<span class="jk">${str}</span>${colon}` : `<span class="js">${str}</span>`;
    if (lit) return `<span class="jl">${lit}</span>`;
    return `<span class="jn">${num}</span>`;
  });
}
const vizHead = (title, note) => el("div", { class: "viz-h" }, `<h4>${title}</h4>${note ? `<span>${note}</span>` : ""}`);
const insight = (txt) => el("div", { class: "insight" }, `<b>Bidgely's insight</b><span>${txt}</span>`);

/* Light heatmap: rows = days (top to bottom), columns = 24 hours. Callouts are placed in % of the grid. */
function heatmap(host, { rows, get, color, max, label, height = 300, callouts = [], months = true, d0 = 0 }) {
  const wrap = el("div", { class: "lhm" });
  const yax = el("div", { class: "lhm-y" });
  if (months) { let last = -1; for (let r = 0; r < rows; r++) { const m = dateOf(d0 + r).getUTCMonth(); if (m !== last) { last = m; if (r > 0 && r / rows < 0.05) continue; if (rows - r < rows * 0.04) continue; const s = el("span", { style: `top:${r / rows * 100}%` }, MON[m]); yax.append(s); } } }
  const grid = el("div", { class: "lhm-grid", style: `height:${height}px` });
  const cv = el("canvas", { width: 24, height: rows, "aria-label": label, role: "img" });
  const g = cv.getContext("2d"), img = g.createImageData(24, rows);
  const c1 = hex(cssv(color)), c0 = [247, 249, 251];
  for (let r = 0; r < rows; r++) for (let h = 0; h < 24; h++) {
    const t = clamp(get(r, h) / max, 0, 1), k = (r * 24 + h) * 4, e = Math.pow(t, 0.8);
    img.data[k] = c0[0] + (c1[0] - c0[0]) * e; img.data[k + 1] = c0[1] + (c1[1] - c0[1]) * e; img.data[k + 2] = c0[2] + (c1[2] - c0[2]) * e; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grid.append(cv);
  callouts.forEach(([x, y, txt, side]) => grid.append(el("span", { class: "co" + (side === "l" ? " l" : ""), style: `left:${x}%;top:${y}%` }, `<i></i><em>${txt}</em>`)));
  const xax = el("div", { class: "lhm-x" }, ["12 AM", "6 AM", "12 PM", "6 PM", "12 AM"].map(t => `<span>${t}</span>`).join(""));
  wrap.append(yax, grid, el("div"), xax);
  host.append(wrap);
  return wrap;
}
const hex = (c) => { const m = c.trim().replace("#", ""); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)); };
const at = (k, d, h) => HH.c[k][d * 24 + h];

/* ---------- Appliance & DER disaggregation ---------- */
const DIS_CATS = [
  { k: "cool", n: "Cooling", v: "--c-cool", max: 3, ins: "Cooling runs from late May to September, peaking between 2 and 7pm on hot afternoons.", co: [[62, 72, "Summer afternoons", "l"]] },
  { k: "heat", n: "Space heating", v: "--c-heat", max: 5, ins: "Heating starts in November and ramps up before sunrise, when the thermostat steps up from its night setting.", co: [[26, 30, "Early-morning warm-up"]] },
  { k: "ev", n: "EV charging", v: "--c-ev", max: 6, ins: "EV charging appears in mid January. After TOU coaching in late May it moves to 11pm, off-peak.", co: [[80, 48, "Evening charging", "l"], [93, 80, "Shifted to 11pm", "l"]] },
  { k: "pool", n: "Pool pump", v: "--c-pool", max: 1.8, ins: "Two daily pool pump runs in summer. From June the pump is variable speed: one long, low run.", co: [[40, 84, "Variable speed from June"]] },
  { k: "wh", n: "Water heating", v: "--c-wh", max: 2.2, ins: "Water heater fires at 6 to 7am for morning showers and again in the evening, a little later on weekends.", co: [[28, 50, "Morning showers"]] },
  { k: "solar", n: "Solar generation", v: "--c-solar", max: 5, ins: "Solar generation begins in late March and follows the length of the day through summer.", co: [[52, 66, "Longer summer days"]] },
];
function mDisagg() {
  const v = panel({
    caps: ["CORE categories: Always On, Space Heating, Cooling, Water Heating, Refrigeration, Lighting, Pool pumps, plus Laundry, Entertainment and Cooking monthly", "DER categories: Electric Vehicle charging, Solar Generation", "Delivered at monthly (or billing cycle) and timestamp-level granularity", "Supports 15, 30 and 60 minute AMI"],
    inputs: [...ALL_INPUTS, "Weather data"],
    out: "Appliance-level usage per premise, per billing cycle or per AMI interval, with appliance attributes.",
    subs: [["RESI AMI Disaggregation, CORE", "Batch export", true], ["RESI AMI Disaggregation, DERs", "Batch export", true], ["RESI NSM Disaggregation", "Batch export", false], ["SMB AMI Disaggregation", "Batch export", false]],
    json: [
      { label: "Monthly", note: "record format from the model spec", data: { event_id: "78fb2f9a-6627-4e6c-8b1b-d9c5ded69e60", combined_id: "123456_78910_111213", start_date: "2023-11-30", end_date: "2023-12-30", last_updated_timestamp: 1704412832763, appliance_categories: [
        { name: "alwaysOn", id: 8, appliance_type: "ELECTRIC", usage: 62.0 },
        { name: "spaceHeating", id: 3, appliance_type: "ELECTRIC", usage: 165.0 },
        { name: "electricVehicle", id: 18, appliance_type: "ELECTRIC", usage: 1092.0, attributes: { detectionConfidence: 0.94, chargerType: "L2", amplitude: 11590.0, chargingInstanceCount: 27, averageChargingDuration: 3.38 } },
        { name: "refrigeration", id: 9, appliance_type: "ELECTRIC", usage: 45.0, attributes: { amplitude: 1235.0, multipleRef: false } },
        { name: "total", id: 17, appliance_type: "ELECTRIC", usage: 1364.0 }] } },
      { label: "Timestamp-level", note: "record format from the model spec", data: { event_id: "78fb2f9a-6627-4e6c-8b1b-d9c5ded69e60", combined_id: "123456_78910_111213", start_timestamp: 1701334800, end_timestamp: 1701340200, granularity: 1800, last_updated_timestamp: 1704412832763, appliance_usage: [
        { name: "lighting", id: 71, appliance_type: "ELECTRIC", usage: [{ timestamp: 1701334800, value: 16.0 }, { timestamp: 1701336600, value: 14.0 }, { timestamp: 1701338400, value: 9.0 }, { timestamp: 1701340200, value: 3.0 }] },
        { name: "spaceHeating", id: 3, appliance_type: "ELECTRIC", usage: [{ timestamp: 1701334800, value: 92.0 }, { timestamp: 1701336600, value: 115.0 }, { timestamp: 1701338400, value: 112.0 }, { timestamp: 1701340200, value: 118.0 }] }] } },
    ],
  });
  const C = DIS_CATS.find(c => c.k === disaggCat);
  v.append(vizHead("24 × 7 × 365 energy heatmap", "one home · Oct 2025 to Sep 2026"));
  const chips = el("div", { class: "chips sm-chips", role: "group", "aria-label": "Appliance" });
  DIS_CATS.forEach(c => { const b = el("button", { type: "button", class: "chip sm", "aria-pressed": c.k === disaggCat }, `<i class="dot" style="background:var(${c.v})"></i>${c.n}`); b.addEventListener("click", () => { disaggCat = c.k; mDisagg(); }); chips.append(b); });
  v.append(chips);
  const pair = el("div", { class: "hm-pair" });
  const a = el("div", { class: "hm-card" }, `<span class="lbl">Smart meter data</span>`), b = el("div", { class: "hm-card" }, `<span class="lbl" style="color:var(${C.v})">${C.n}, separated out</span>`);
  heatmap(a, { rows: DAYS, get: (r, h) => Math.max(0, HH.net[r * 24 + h]), color: "--ink-2", max: 7, label: "Raw AMI heatmap" });
  heatmap(b, { rows: DAYS, get: (r, h) => at(C.k, r, h), color: C.v, max: C.max, label: C.n + " heatmap", callouts: C.co });
  pair.append(a, b); v.append(pair, insight(C.ins));
}

/* ---------- Appliance & DER attributes ---------- */
function mAttr() {
  const v = panel({
    caps: ["Heating: fuel type (electric or not), heat pump detection and confidence, amplitude, capacity, 24h profile", "Cooling: type (AC or fan), amplitude, capacity, 24h profile", "Water heating: type (timed, thermostat, seasonal), confidence", "Pool pump: speed (single or variable), runs per day, amplitude", "EV: charger type (L1 or L2), amplitude, charging count and duration", "Solar: panel capacity, generation profile"],
    inputs: ALL_INPUTS,
    out: "Attributes per detected appliance, per billing cycle, added to the disaggregation record.",
    subs: [["RESI AMI Appliance Attributes, CORE", "Batch export", true], ["RESI AMI Appliance Attributes, DERs", "Batch export", true]],
    json: [{ label: "Attributes", data: { combined_id: "123456_78910_111213", start_date: "2026-07-01", end_date: "2026-07-31", appliance_categories: [
      { name: "electricVehicle", id: 18, attributes: { detectionConfidence: 0.94, chargerType: "L2", hourlyUsage: 11900.0, chargingInstanceCount: 17, averageChargingDuration: 3.4 } },
      { name: "spaceHeating", id: 3, attributes: { fuelType: "Electric", heatPumpDetected: true, heatPumpConfidence: 0.88, capacity: 5400.0 } },
      { name: "airConditioning", id: 4, attributes: { coolingType: "AC", capacity: 5000.0, hourlyUsageList: [3200.0] } },
      { name: "pool", id: 2, attributes: { detectionConfidence: 0.91, speed: "Variable", runsPerDay: 1.0, hourlyUsageList: [850.0] } },
      { name: "waterHeating", id: 7, attributes: { detectionConfidence: 0.83, appType: "thermostat" } },
      { name: "solar", id: 16, attributes: { detectionConfidence: 0.99, solarCapacity: 6500.0 } }] } }],
  });
  v.append(vizHead("EV use heat map", "one home · Jan to Sep 2026"));
  const row = el("div", { class: "attr-row" });
  const hm = el("div", { class: "hm-card" });
  const d0 = EV_START - 5, rows = DAYS - d0;
  heatmap(hm, { rows, d0, get: (r, h) => at("ev", d0 + r, h), color: "--c-ev", max: 6, height: 320, label: "EV charging heatmap", callouts: [[8, 4, "Start of charging streak"], [84, 22, "Overnight charging", "l"], [55, 58, "Mid-day session", "l"], [96, 88, "Moved to 11pm", "l"]] });
  const card = el("div", { class: "attr-card" }, `<span class="lbl">Detected attributes</span>${[["Charger type", "L2"], ["Amplitude", "11,900 W"], ["Charging frequency", "4 times / week"], ["Typical window", "8pm to 4am"], ["Avg. session", "3.4 hours"], ["Detection confidence", "0.94"]].map(([k, x]) => `<div><span>${k}</span><b>${x}</b></div>`).join("")}`);
  row.append(hm, card); v.append(row, insight("L2 charging every few nights, mostly overnight. Good candidate for managed charging or a TOU-EV rate."));
}

/* ---------- Appliance inefficiency ---------- */
function mIneff() {
  const v = panel({
    caps: ["Degradation: more energy for the same weather, year over year", "Saturation: unit runs most of the day above (or below) a trigger temperature", "Short cycling: frequent on and off cycles within the hour", "HVAC Fault Detection Risk, Water Heater Fault Detection Risk"],
    inputs: ["Premise enrollment", "AMI usage (15, 30 or 60 min)", "Home profile (opt.)"],
    out: "Inefficiency attributes on the Space Heating and Cooling categories, per billing cycle.",
    subs: [["Appliance Inefficiency (HVAC)", "Batch export", true], ["Appliance Fault Detection (HVAC)", "Batch export", true], ["Appliance Fault Detection (Water Heater)", "Batch export", true]],
    json: [{ label: "Cooling", data: { combined_id: "123456_78910_111213", start_date: "2026-07-01", end_date: "2026-07-31", appliance_categories: [{ name: "airConditioning", id: 4, attributes: { showsDegradation: true, saturationTemperature: 91.0, saturationFraction: 0.27, shortCycling: false } }] } }],
  });
  v.append(vizHead("Three patterns the model looks for", "cooling · May to Sep · illustrative homes"));
  const r = rng(77), rows = 128, d0 = 237, cool = (d, h) => at("cool", d0 + d, h), T = (d, h) => HH.temp[(d0 + d) * 24 + h];
  const grid = el("div", { class: "trio" });
  const cards = [
    { t: "HVAC degradation", ins: "Use of the AC intensifies compared with the previous year, for the same weather.", get: (d, h) => cool(d, h) * (0.8 + 0.9 * d / rows) },
    { t: "Saturated AC", ins: "The widening solid area shows the unit running flat out on more hours as summer goes on.", get: (d, h) => { const c = cool(d, h); return T(d, h) > 84 - 8 * Math.sin(Math.PI * d / rows) ? 3.2 : c * 0.8; } },
    { t: "Short cycling AC", ins: "The checkered pattern is the unit switching on and off too often.", get: (d, h) => cool(d, h) * 1.3 * (((d >> 1) + h) % 2 ? 1 : 0.1) },
  ];
  cards.forEach(c => { const card = el("div", { class: "hm-card" }, `<span class="lbl">${c.t}</span>`); heatmap(card, { rows, d0, get: c.get, color: "--c-cool", max: 3, height: 220, label: c.t }); card.append(el("p", { class: "mini-ins" }, esc(c.ins))); grid.append(card); });
  v.append(grid);
}

/* ---------- Customer lifestyle ---------- */
const ARCH = [["Office goer", "Morning and evening peaks, quiet during office hours, weekday vs weekend difference"], ["Active", "High variation in use across the day"], ["Dormant", "Low, flat use even after HVAC and pool pumps"], ["Weekend warrior", "Weekends higher than weekdays"]];
function mLife() {
  const v = panel({
    caps: ["Daily load type (e.g. early evening, dual peak) and seasonal load type (e.g. heavy summer peak)", "Office goer, active, dormant and weekend warrior flags, each with a probability", "Vacation identification and percentage of the cycle away", "24-hour usage fractions for all days, weekdays and weekends"],
    inputs: ["Premise enrollment", "AMI usage (15, 30 or 60 min)", "Home profile (opt.)"],
    out: "Lifestyle dimensions per premise, per billing cycle.",
    subs: [["RESI Customer Lifestyle", "Batch export", true]],
    json: [{ label: "Lifestyle", data: { combined_id: "123456_78910_111213", start_date: "2026-01-01", end_date: "2026-01-31", lifestyle: { dailyLoadType: "MORNING_EVE", seasonalLoadType: "MILD_WINTER_PEAK", officeGoer: true, officeGoerProbability: 0.86, activeUser: false, activeUserProbability: 0.31, dormantUser: false, dormantUserProbability: 0.08, weekendWarrior: false, weekendWarriorProbability: 0.22, VacationPercentage: 0.29, hourFractionsWeekday: [0.02, 0.02, 0.02, 0.02, 0.03, 0.07, 0.08, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.04, 0.07, 0.09, 0.08, 0.07, 0.06, 0.05, 0.03] } } }],
  });
  v.append(vizHead("What the meter says about daily life", "one home · illustrative"));
  const row = el("div", { class: "hm-pair" });
  const r = rng(12), rows = 365, vac = (d) => d >= 70 && d < 86;
  const a = el("div", { class: "hm-card" }, `<span class="lbl">Office goer, all year</span>`);
  heatmap(a, { rows, get: (d, h) => { if (vac(d)) return 0.06; const we = isWeekend(d); const m = Math.exp(-Math.pow((h - 5.5) / 1.1, 2)), e = Math.exp(-Math.pow((h - 19) / 2.2, 2)), day = we ? 0.55 : 0.08; return (0.1 + 1.1 * m + 1.3 * e + (h > 8 && h < 17 ? day : 0)) * (0.8 + r() * 0.4); }, color: "--c-wh", max: 1.5, label: "Lifestyle heatmap", callouts: [[22, 10, "Wake-up around 5am"], [40, 42, "Quiet during office hours"], [60, 21, "Away over the holidays", "l"]] });
  const b = el("div", { class: "hm-card" }, `<span class="lbl">Archetypes</span><div class="arch">${ARCH.map(([n, d], i) => `<div class="${i === 0 ? "on" : ""}"><b>${n}</b><span>${d}</span>${i === 0 ? "<em>0.86</em>" : ""}</div>`).join("")}</div>`);
  row.append(a, b); v.append(row, insight("Wake-up around 5am with low daytime use points to an office goer. The empty band in winter is a two-week vacation."));
}

/* ---------- DER propensity ---------- */
function mProp() {
  const v = panel({
    caps: ["EV adoption propensity, 0 to 1", "Solar adoption propensity, 0 to 1", "Scores refresh each billing cycle as usage and home details change"],
    inputs: ["Premise enrollment", "AMI usage (15, 30 or 60 min)", "Load disaggregation outcomes", "Premise information (opt.)"],
    out: "Short-term purchase probability for an EV and for a PV system, per premise.",
    subs: [["EV Purchase Propensity", "Batch export", true], ["Solar Propensity", "Batch export", true]],
    json: [{ label: "Propensity", note: "illustrative field names and values", data: { combined_id: "123456_78910_111213", start_date: "2026-08-01", end_date: "2026-08-31", propensity: { evShortTermPurchasePropensityProbability: 0.82, solarPropensityProbability: 0.64 } } }],
  });
  v.append(vizHead("How a score is built", "one home"));
  const ins = [["home", "Existing DER ownership"], ["building", "Size of home"], ["home", "Type of home"], ["ev", "Area EV ownership %"], ["user", "Income"], ["meter", "Appliance usage"]];
  const flow = el("div", { class: "pflow" }, `
    <div class="pf-in">${ins.map(([k, t]) => `<span>${icon(k)}${t}</span>`).join("")}</div>
    <div class="pf-mid"><span class="pf-arrow" aria-hidden="true"></span><div class="pf-algo">${icon("brain")}<b>DER adoption propensity algorithms</b></div><span class="pf-arrow" aria-hidden="true"></span></div>
    <div class="pf-out">${[["EV adoption propensity", 0.82, "--c-ev"], ["Solar adoption propensity", 0.64, "--c-solar"]].map(([t, s, c]) => `<div class="score"><span>${t}</span><b>${s.toFixed(2)}</b><i><em style="width:${s * 100}%;background:var(${c})"></em></i></div>`).join("")}</div>`);
  v.append(flow, insight("A large single-family home with high daytime use, in an area where EV ownership is rising, scores 0.82 for EV. Target it before the car arrives."));
}

/* ---------- Customer income ---------- */
function mInc() {
  const v = panel({
    caps: ["Income qualified (yes or no) per premise, with model confidence", "Income clusters for targeted outreach and equity alignment", "Energy burden evaluation per household", "Meaningful leads for implementers and CBOs"],
    inputs: ["Premise enrollment", "AMI usage (15, 30 or 60 min)", "Load disaggregation outcomes", "Premise information (opt.)", "Income census data (opt.)"],
    out: "Income-qualified flag and confidence per premise.",
    subs: [["Income Level Estimation", "Batch export", true]],
    json: [{ label: "Income", note: "illustrative field names and values", data: { combined_id: "123456_78910_111213", start_date: "2026-08-01", end_date: "2026-08-31", income: { incomeQualified: true, confidence: 0.87 } } }],
  });
  v.append(vizHead("From census tract to household", "illustrative"));
  const r = rng(5), n = 120, hi = 57;
  const dots = (fn) => Array.from({ length: n }, (_, i) => `<i class="${fn(i)}"></i>`).join("");
  const cmp = el("div", { class: "inc-cmp" }, `
    <div class="inc-card"><span class="lbl">ZIP code & census</span><b>Population ~4,000</b><div class="dotgrid">${dots(() => "mid")}</div><p>One average for everyone. Generic data leads to generic results.</p></div>
    <div class="inc-arrow" aria-hidden="true">→</div>
    <div class="inc-card on"><span class="lbl">UtilityAI Pro</span><b>1 household</b><div class="dotgrid">${dots(i => i === hi ? "pick" : (r() < 0.28 ? "lmi" : ""))}</div><p>Scored per premise, enriched with arrearage and program data.</p></div>`);
  v.append(cmp, insight("The same tract holds both income-qualified and higher-income homes. Premise-level scoring finds the right ones to reach."));
}

/* ---------- Personalized insights ---------- */
const SHC = { applianceName: "spaceHeating", benchmarkConsumption: "30.0", consumption0Percentile: "13604.62", consumption100Percentile: "1359504.028", consumption10Percentile: "28100.453", consumption20Percentile: "55108.237", consumption30Percentile: "82430.585", consumption40Percentile: "111279.226", consumption50Percentile: "143244.484", consumption60Percentile: "180179.15", consumption70Percentile: "230266.324", consumption80Percentile: "298965.589", consumption90Percentile: "379567.795", currentBCSelfCost: "61.0", efficientThreshold: "82430.585", userConsumption: "173.0" };
function mPI() {
  const v = panel({
    caps: ["Similar Homes Comparison on total usage and each appliance category", "Clustering by location, home size and type, and appliance ownership", "Efficient and average peer groups each bill period", "Ranked savings tips and recommendations from a tip catalog"],
    inputs: ["Premise enrollment", "AMI usage (AMI meters)", "Billing usage (non-smart meters)", "Load disaggregation", "Premise information (opt.)"],
    out: "Similar-home percentiles per appliance and a ranked list of tips, per billing cycle.",
    subs: [["SHC Clustering", "REST API (batch on roadmap)", true], ["SHC Efficiency", "REST API (batch on roadmap)", true], ["Savings Tips / Recommendations", "REST API (batch on roadmap)", true]],
    json: [{ label: "SHC · spaceHeating", note: "example response from the model spec", data: SHC }],
  });
  v.append(vizHead("Space heating vs. similar homes", "one billing cycle"));
  const P = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(p => +SHC[`consumption${p}Percentile`] / 1000);
  const me = +SHC.userConsumption, eff = +SHC.efficientThreshold / 1000, maxv = 400;
  const W = VW(), Hh = 150, x = (kwh) => 16 + (W - 32) * Math.min(kwh, maxv) / maxv;
  const s = mkSvg(W, Hh, "Similar homes percentile band");
  svgEl("rect", { x: x(0), y: 58, width: x(eff) - x(0), height: 22, rx: 3, fill: cssv("--c-ev"), opacity: 0.22 }, s);
  svgEl("rect", { x: x(eff), y: 58, width: x(maxv) - x(eff), height: 22, rx: 3, fill: cssv("--line-2"), opacity: 0.6 }, s);
  P.forEach((kwh, i) => { svgEl("line", { x1: x(kwh), x2: x(kwh), y1: 54, y2: 84, stroke: cssv("--ink-2"), "stroke-width": 1, opacity: 0.5 }, s); if ([1, 5, 9].includes(i)) text(s, x(kwh), 100, `P${i * 10}`, { "text-anchor": "middle", fill: cssv("--muted") }); });
  svgEl("line", { x1: x(eff), x2: x(eff), y1: 40, y2: 84, stroke: cssv("--c-ev"), "stroke-width": 2 }, s);
  text(s, x(eff), 34, `Efficient homes · under ${Math.round(eff)} kWh`, { "text-anchor": "middle", fill: cssv("--c-ev") });
  svgEl("circle", { cx: x(me), cy: 69, r: 7, fill: cssv("--c-heat"), stroke: "#fff", "stroke-width": 2 }, s);
  text(s, x(me), 126, `This home · ${me} kWh · $${SHC.currentBCSelfCost}`, { "text-anchor": "middle", fill: cssv("--c-heat"), "font-weight": 600 });
  v.append(s);
  v.append(el("div", {}, `<span class="lbl">Ranked tips for this home</span><ol class="tips-list"><li>Lower the heating setpoint 2°F overnight <b>$14/mo</b></li><li>Service the heat pump before winter <b>$9/mo</b></li><li>Seal ducts in the attic <b>$6/mo</b></li></ol>`));
  v.append(insight("This home uses 173 kWh on heating, between the 50th and 60th percentile of similar homes and about double the efficient group."));
}

/* ---------- Revenue loss ---------- */
function mRev() {
  const v = panel({
    caps: ["Direct theft (meter bypass), night theft and AC bypass", "Tariff misuse, meter tampering (magnet, cover open, current without voltage)", "Sanctioned load violation and low power factor (commercial)", "Terminal burn, flagged as a safety condition"],
    inputs: ["AMI interval data (energy, voltage, current, PF)", "Consumer / meter master data", "Billing data (cond.)", "Meter event logs (cond.)", "Instantaneous data (opt.)", "Weather (supplied by Bidgely)"],
    out: "One flat record per meter per run: fired flag, priority, window and details for each detection module.",
    subs: [["Theft detection", "Batch export", true]],
    json: [{ label: "Theft record", note: "field names from the model spec, illustrative values", data: { meter_id: "MTR-00482211", analysis_start_date: "2025-10-01", analysis_end_date: "2026-08-31", has_direct_theft: true, direct_theft_priority: "High", direct_theft_start_date: "2026-05-14", direct_theft_end_date: "2026-08-31", has_direct_theft_recent: true, direct_theft_probability: 0.91, has_ac_bypass: false, has_night_theft: false, has_tariff_misuse: false, has_sl_violation: false, has_low_pf: false, has_meter_tampering: true, meter_tampering_probability: 0.78, has_magnet_event: true, has_magnet_tamper: true, anomaly_category: "Direct theft; Magnet tamper", inspection_comment: "Consumption fell 64% after a magnet event on 2026-05-14, not explained by weather.", failure_reason: "" } }],
  });
  v.append(vizHead("Inspector work card", "one meter · illustrative"));
  const mods = [["Direct theft", true, "High"], ["Magnet tampering", true, "Mid"], ["AC bypass", false], ["Night theft", false], ["Tariff misuse", false], ["Sanctioned load violation", false], ["Low power factor", false], ["Terminal burn", false]];
  const wc = el("div", { class: "work-card" }, `<div class="wc-head"><b>MTR-00482211</b><span>Oct 2025 to Aug 2026 · single-phase · domestic</span></div>
    <div class="wc-mods">${mods.map(([n, f, p]) => `<div class="${f ? "fired" : ""}"><span>${n}</span>${f ? `<em class="pr ${p === "High" ? "hi" : "mid"}">${p}</em>` : `<em>clear</em>`}</div>`).join("")}</div>`);
  const W = VW(), Hh = 150, s = mkSvg(W, Hh, "Metered vs expected consumption");
  const months = 11, x = (i) => 30 + (W - 50) * i / (months - 1), y = (k) => 120 - k * 0.12;
  const exp = [520, 610, 690, 640, 560, 480, 620, 760, 820, 800, 690], met = exp.map((e, i) => i >= 7 ? e * 0.36 : e * (0.97 + 0.04 * Math.sin(i)));
  svgEl("rect", { x: x(6.5), y: 10, width: x(10) - x(6.5) + 10, height: 112, fill: cssv("--c-heat"), opacity: 0.08 }, s);
  text(s, x(8.2), 22, "Flagged window", { "text-anchor": "middle", fill: cssv("--c-heat") });
  const path = (a) => a.map((k, i) => `${i ? "L" : "M"}${x(i)},${y(k)}`).join("");
  svgEl("path", { d: path(exp), fill: "none", stroke: cssv("--line-3"), "stroke-width": 2, "stroke-dasharray": "5 4" }, s);
  svgEl("path", { d: path(met), fill: "none", stroke: cssv("--c-cool"), "stroke-width": 2.4 }, s);
  ["Oct", "Dec", "Feb", "Apr", "Jun", "Aug"].forEach((m, i) => text(s, x(i * 2), 142, m, { "text-anchor": "middle", fill: cssv("--muted") }));
  const leg = el("div", { class: "legend" }, `<span><span class="sw" style="background:var(--c-cool)"></span>Metered</span><span><span class="sw" style="background:var(--line-3)"></span>Expected for this home and weather</span>`);
  v.append(wc, leg, s, insight("Consumption dropped 64% right after a magnet event and weather does not explain it. High priority lead."));
}
