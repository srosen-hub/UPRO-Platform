/* ---------- models ---------- */
let modelTab = "disagg", selDay = null, hmFocus = null;
function pickDefaultDay() { for (let d = 296; d < 330; d++) if (!isWeekend(d)) { let ev = 0; for (let h = 0; h < 24; h++) ev += HH.c.ev[d * 24 + h]; if (ev > 8) return d; } return 300; }
selDay = pickDefaultDay();

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
function panel(copyHtml, specs) {
  const p = el("div", { class: "model-panel", role: "tabpanel", "aria-labelledby": "tab-" + modelTab });
  const c = el("div", { class: "m-copy" }, copyHtml + `<div class="spec">${specs.map(([k, v]) => `<div><span>${k}</span><p>${v}</p></div>`).join("")}</div>`);
  const v = el("div", { class: "viz" });
  p.append(c, v);
  const host = $("#model-panels"); host.innerHTML = ""; host.append(p);
  return v;
}
function renderModel() { ({ disagg: mDisagg, attr: mAttr, ineff: mIneff, life: mLife, prop: mProp, inc: mInc, pi: mPI, rev: mRev })[modelTab](); }

/* Disaggregation */
const HM_SERIES = [
  { id: "net", name: "Raw AMI", v: "--ink-2" },
  { id: "cool", name: "Cooling", v: "--c-cool" },
  { id: "heat", name: "Heating", v: "--c-heat" },
  { id: "ev", name: "EV", v: "--c-ev" },
  { id: "solar", name: "Solar", v: "--c-solar" },
  { id: "pool", name: "Pool pump", v: "--c-pool" },
  { id: "wh", name: "Water heat", v: "--c-wh" },
];
function mDisagg() {
  const v = panel(`
    <h3>Appliance &amp; DER disaggregation</h3>
    <p>One meter, one row per day. Raw reads on the left, what the model separates out on the right. Click a row.</p>`,
    [["Input", "AMI interval data (15-min or hourly), weather, bill cycles"], ["Output", "Hourly kWh per appliance per meter; monthly for cooking, laundry, entertainment"], ["Categories", "Always on, heating, cooling, water heating, refrigeration, lighting, pool pump, EV, solar, plus 3 monthly"], ["Written to", "Governed output tables in your data platform, every run"]]);
  v.append(el("div", { class: "viz-h" }, `<h4>8,760 hours, separated</h4><span class="mono">sample premise · Oct 2025 to Sep 2026</span>`));
  // Instrument panel: raw AMI in, six end-use channels out. Rows are days, columns are hours.
  const panelEl = el("div", { class: "hm-panel" });
  panelEl.innerHTML = `<div class="hm-head"><span><i class="hm-dot"></i>Input · raw AMI</span><span class="hm-arrow" aria-hidden="true">→</span><span><i class="hm-dot on"></i>Model output · 6 end uses</span></div>`;
  const wrap = el("div", { class: "hm-body" });
  const months = el("div", { class: "hm-y", "aria-hidden": "true" });
  ["Oct","Dec","Feb","Apr","Jun","Aug","Sep"].forEach(m => months.append(el("span", {}, m)));
  const rawCol = el("div", { class: "hm-raw" }), comps = el("div", { class: "hm-comps" });
  const cursor = el("div", { class: "hm-cursor", hidden: "" }), selLine = el("div", { class: "hm-sel" });
  wrap.append(months, rawCol, el("div", { class: "hm-gap", "aria-hidden": "true" }), comps, cursor, selLine);
  panelEl.append(wrap);
  v.append(panelEl);
  const MAGMA = ["#000004", "#1c1044", "#4f127b", "#812581", "#b5367a", "#e55064", "#fb8761", "#fec287", "#fcfdbf"];
  const ramp = (stops, t) => { const x = clamp(t, 0, 1) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)); return mix(stops[i], stops[i + 1], x - i); };
  const BASE = "#0d141d";
  HM_SERIES.forEach(s => {
    const isRaw = s.id === "net";
    const cell = el("div", { class: "hm-cell" + (isRaw ? " raw" : ""), role: "button", tabindex: "0", "aria-label": `${s.name} heatmap` });
    const W = isRaw ? 96 : 48, px = W / 24;
    const cv = el("canvas", { width: W, height: 365 });
    const arr = isRaw ? HH.net : HH.c[s.id];
    let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(arr[i]));
    const ctx = cv.getContext("2d"); const img = ctx.createImageData(W, 365);
    const hue = cssv(s.v), hot = "#" + mix(hue, "#ffffff", 0.45).map(x => x.toString(16).padStart(2, "0")).join("");
    for (let d = 0; d < DAYS; d++) for (let h = 0; h < H; h++) {
      const val = arr[d * H + h];
      let rgb;
      if (isRaw) rgb = val < 0 ? ramp([BASE, "#0e4a5c", "#1fb5c9", "#b8f3ff"], Math.pow(-val / 4.5, 0.7)) : ramp(MAGMA, 0.08 + 0.92 * Math.pow(clamp(val / 9, 0, 1), 0.6));
      else { const t = Math.pow(clamp(Math.abs(val) / mx, 0, 1), 0.6); rgb = t < 0.02 ? mix(BASE, BASE, 0) : ramp([BASE, hue, hot], t); }
      for (let x = h * px; x < (h + 1) * px; x++) { const o = (d * W + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    const kwh = isRaw ? `${Math.round(annual.ao + annual.pool + annual.wh + annual.ev + annual.heat + annual.cool + annual.other - annual.solar).toLocaleString()} kWh net` : `${Math.round(annual[s.id]).toLocaleString()} kWh`;
    cell.innerHTML = `<div class="nm">${isRaw ? "" : `<span class="sw" style="background:var(${s.v})"></span>`}${s.name}</div><div class="kwh">${kwh}</div>`;
    cell.append(cv);
    if (isRaw) cell.append(el("div", { class: "hm-x" }, "<span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>"));
    const pick = (e) => { const rc = cv.getBoundingClientRect(); return [clamp(Math.floor((e.clientY - rc.top) / rc.height * DAYS), 0, DAYS - 1), clamp(Math.floor((e.clientX - rc.left) / rc.width * H), 0, H - 1), rc]; };
    cv.addEventListener("mousemove", (e) => {
      const [d, h, rc] = pick(e); const val = arr[d * H + h];
      const wr = wrap.getBoundingClientRect();
      cursor.hidden = false; cursor.style.top = (rc.top - wr.top + (d + 0.5) / DAYS * rc.height) + "px";
      showTip(`<b>${dLabel(d)} · ${String(h).padStart(2, "0")}:00</b><div class="r"><span>${s.name}</span><span>${fmt(s.id === "solar" ? -val : val, 2)} kWh</span></div><div class="r"><span>Outdoor temp</span><span>${Math.round(HH.temp[d * H + h])}°F</span></div><div class="xs" style="opacity:.7;margin-top:4px">Click to open this day</div>`, e.clientX, e.clientY);
    });
    cv.addEventListener("mouseleave", () => { hideTip(); cursor.hidden = true; });
    cv.addEventListener("click", (e) => { selDay = pick(e)[0]; drawDay(); });
    cell.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); selDay = clamp(selDay + (e.key === "ArrowDown" ? 1 : -1), 0, DAYS - 1); drawDay(); } });
    (isRaw ? rawCol : comps).append(cell);
  });
  panelEl.append(el("div", { class: "hm-foot" }, `<span>Rows = 365 days · columns = 24 hours</span><span class="hm-scale"><i style="background:linear-gradient(90deg,${MAGMA.join(",")})"></i>0 → 9 kWh/h</span>`));
  const dayBox = el("div", { id: "day-box" });
  v.append(dayBox);
  v.append(el("div", { class: "detect-list" }, [
    ["--c-ev", "EV charger", `First charge ${dLabel(EV_START).slice(4)} · L2 · 7.2 kW · ~4.3 sessions/wk`],
    ["--c-ev", "Charging window", `Shifted from 6-8pm to 11pm on ${dLabel(EV_SHIFT).slice(4)}`],
    ["--c-solar", "Solar PV", `Detected ${dLabel(SOLAR_START).slice(4)} · est. 6-7 kW DC`],
    ["--c-pool", "Pool pump", `Single-speed, 2 runs → variable-speed, 1 run (Jun)`],
    ["--c-heat", "Heat pump", "Cycling signature · aux strip below 32°F"],
    ["--c-cool", "Central AC", "Saturates near 3.7 kWh/h on the hottest afternoons"],
  ].map(([c, h, t]) => `<div class="det"><div class="h"><span class="sw" style="background:var(${c})"></span>${h}</div><div class="v">${t}</div></div>`).join("")));
  drawDay();
}
function placeSel() {
  const line = document.querySelector(".hm-sel"), cv = document.querySelector(".hm-cell.raw canvas"), wr = document.querySelector(".hm-body");
  if (!line || !cv || !wr) return;
  const rc = cv.getBoundingClientRect(), wb = wr.getBoundingClientRect();
  line.style.top = (rc.top - wb.top + (selDay + 0.5) / DAYS * rc.height) + "px";
}
function drawDay() {
  const box = $("#day-box"); if (!box) return;
  requestAnimationFrame(placeSel);
  const d = selDay;
  const w = VW(), h = 250, ml = 38, mr = 8, mt = 14, mb = 26;
  let mxS = 0, mnS = 0;
  for (let hh = 0; hh < 24; hh++) { const i = d * 24 + hh; mxS = Math.max(mxS, HH.total[i]); mnS = Math.min(mnS, -HH.c.solar[i]); }
  const top = Math.max(4, Math.ceil(mxS)), bot = Math.floor(Math.min(0, mnS));
  const y = (v) => mt + (top - v) / (top - bot) * (h - mt - mb);
  const bw = (w - ml - mr) / 24;
  const s = mkSvg(w, h, `Stacked hourly usage for ${dLabel(d)}`);
  const step = top - bot > 12 ? 4 : 2; const ticks = [];
  for (let t = Math.ceil(bot / step) * step; t <= top; t += step) ticks.push(t);
  if (!ticks.includes(0)) ticks.push(0);
  yAxis(s, ml, w - mr, y, ticks, (t) => t);
  text(s, 4, mt - 2, "kWh", {});
  const surf = cssv("--surface");
  for (let hh = 0; hh < 24; hh++) {
    const i = d * 24 + hh; let acc = 0;
    const x = ml + hh * bw + 2, bwi = bw - 4;
    const g = svgEl("g", {}, s);
    CATS.forEach(k => {
      const val = HH.c[k.id][i]; if (val < 0.02) return;
      svgEl("rect", { x, y: y(acc + val), width: bwi, height: Math.max(0.5, y(acc) - y(acc + val)), fill: cssv(k.v), stroke: surf, "stroke-width": 1 }, g);
      acc += val;
    });
    const sv = HH.c.solar[i];
    if (sv > 0.02) svgEl("rect", { x, y: y(0), width: bwi, height: y(-sv) - y(0), fill: cssv(SOLAR.v), rx: 2 }, g);
    const hit = svgEl("rect", { x: ml + hh * bw, y: mt, width: bw, height: h - mt - mb, fill: "transparent" }, g);
    hoverable(hit, () => {
      const rows = [...CATS].reverse().filter(k => HH.c[k.id][i] >= 0.02).map(k => `<div class="r"><span><i style="background:var(${k.v})"></i>${k.name}</span><span>${fmt(HH.c[k.id][i], 2)}</span></div>`).join("");
      return `<b>${String(hh).padStart(2, "0")}:00 · ${Math.round(HH.temp[i])}°F</b>${rows}${sv > 0.02 ? `<div class="r"><span><i style="background:var(--c-solar)"></i>Solar</span><span>-${fmt(sv, 2)}</span></div>` : ""}<div class="r" style="margin-top:3px;border-top:1px solid rgba(127,127,127,.4);padding-top:3px"><span>Net meter</span><span>${fmt(HH.net[i], 2)} kWh</span></div>`;
    });
    if (hh % 3 === 0) text(s, ml + hh * bw + bw / 2, h - 8, `${hh}h`, { "text-anchor": "middle" });
  }
  let tot = 0, sol = 0; for (let hh = 0; hh < 24; hh++) { tot += HH.total[d * 24 + hh]; sol += HH.c.solar[d * 24 + hh]; }
  box.innerHTML = "";
  const hd = el("div", { class: "viz-h" }, `<h4>${dLabel(d)}</h4><span class="xs mono muted">${fmt(tot, 1)} kWh used · ${fmt(sol, 1)} kWh solar · use ↑↓ on a heatmap to step days</span>`);
  box.append(hd, s);
  box.append(el("div", { class: "legend", style: "margin-top:6px" }, [...CATS, SOLAR].map(k => `<span><span class="sw" style="background:var(${k.v})"></span>${k.name}</span>`).join("")));
}

/* Attributes */
function mAttr() {
  const v = panel(`<h3>Appliance &amp; DER attributes</h3>
    <p>Every detected appliance, profiled.</p>`,
    [["Input", "Disaggregation outputs, interval shape, weather"], ["Output", "Per-appliance attributes with confidence"], ["Examples", "Heating fuel, heat pump, pool pump type and runs, water heater type, EV charger amplitude, solar capacity, smart thermostat, battery"]]);
  v.append(el("div", { class: "detect-list" }, [
    ["Heating fuel", "Electric", "--c-heat"], ["Heat pump", "Detected · 0.93", "--c-heat"], ["Pool pump", "Variable speed · 1 run/day", "--c-pool"],
    ["Water heater", "Electric resistance · 2 runs/day", "--c-wh"], ["EV charger", "Level 2 · 7.2 kW", "--c-ev"], ["Solar capacity", "6-7 kW DC", "--c-solar"],
    ["Smart thermostat", "Detected · setback schedule", "--c-cool"], ["Battery", "Not detected", "--c-other"],
  ].map(([h, t, c]) => `<div class="det"><div class="h"><span class="sw" style="background:var(${c})"></span>${h}</div><div class="v">${t}</div></div>`).join("")));
  // heat pump vs resistance on a cold day
  const w = VW(), h = 240, ml = 38, mr = 90, mt = 16, mb = 26;
  const temps = Array.from({ length: 24 }, (_, i) => 26 + 12 * Math.sin(2 * Math.PI * (i - 9) / 24));
  const hp = temps.map((t, i) => 0.6 + Math.max(0, 68 - t) * 0.07 + (i % 2 ? 0.25 : -0.1) + (t < 20 ? 1.5 : 0));
  const rs = temps.map((t, i) => Math.max(0, 68 - t) * 0.19 + (i % 3 === 0 ? 0.9 : 0));
  const top = Math.ceil(Math.max(...rs, ...hp) + 1);
  const x = (i) => ml + i / 23 * (w - ml - mr), y = (vv) => mt + (top - vv) / top * (h - mt - mb);
  const s = mkSvg(w, h, "Hourly heating load on a cold day: heat pump versus electric resistance");
  yAxis(s, ml, w - mr, y, [0, 2, 4, 6, 8].filter(t => t <= top));
  text(s, 4, mt - 4, "kWh");
  const line = (arr, col, lbl) => {
    const d = arr.map((vv, i) => `${i ? "L" : "M"}${x(i)},${y(vv)}`).join("");
    svgEl("path", { d: d + `L${x(23)},${y(0)}L${x(0)},${y(0)}Z`, fill: col, opacity: 0.12 }, s);
    svgEl("path", { d, fill: "none", stroke: col, "stroke-width": 2, "stroke-linejoin": "round" }, s);
    svgEl("circle", { cx: x(23), cy: y(arr[23]), r: 4, fill: col, stroke: cssv("--surface"), "stroke-width": 2 }, s);
    text(s, x(23) + 8, y(arr[23]) + 4, lbl, { class: "t-ink" });
  };
  line(rs, cssv("--c-heat"), "Resistance");
  line(hp, cssv("--c-cool"), "Heat pump");
  for (let i = 0; i < 24; i += 3) text(s, x(i), h - 8, `${i}h`, { "text-anchor": "middle" });
  const hit = svgEl("rect", { x: ml, y: mt, width: w - ml - mr, height: h - mt - mb, fill: "transparent" }, s);
  hit.addEventListener("mousemove", (e) => { const rc = s.getBoundingClientRect(); const px = (e.clientX - rc.left) / rc.width * w; const i = clamp(Math.round((px - ml) / (w - ml - mr) * 23), 0, 23); showTip(`<b>${i}:00 · ${Math.round(temps[i])}°F</b><div class="r"><span><i style="background:var(--c-cool)"></i>Heat pump</span><span>${fmt(hp[i], 2)} kWh</span></div><div class="r"><span><i style="background:var(--c-heat)"></i>Resistance</span><span>${fmt(rs[i], 2)} kWh</span></div>`, e.clientX, e.clientY); });
  hit.addEventListener("mouseleave", hideTip);
  v.append(el("div", { class: "viz-h" }, `<h4>Same cold day, two heating systems</h4><span class="xs muted mono">illustrative · 26°F average</span>`), s);
}

/* Inefficiency */
function mIneff() {
  const v = panel(`<h3>Appliance inefficiency</h3>
    <p>Energy per degree, tracked season over season.</p>`,
    [["Input", "Heating and cooling disaggregation, weather"], ["Output", "Degradation, short cycling and saturation flags per system"]]);
  const r = rng(77);
  const w = VW(), h = 280, ml = 42, mr = 16, mt = 16, mb = 34;
  const xT = (t) => ml + (t - 72) / (104 - 72) * (w - ml - mr), yK = (k) => mt + (60 - k) / 60 * (h - mt - mb);
  const s = mkSvg(w, h, "Daily cooling energy versus daily high temperature, 2024 and 2026 seasons");
  yAxis(s, ml, w - mr, yK, [0, 15, 30, 45, 60]);
  [75, 80, 85, 90, 95, 100].forEach(t => text(s, xT(t), h - 16, `${t}°F`, { "text-anchor": "middle" }));
  text(s, (ml + w - mr) / 2, h - 2, "Daily high temperature", { "text-anchor": "middle" });
  text(s, 4, mt - 4, "kWh/day");
  const f24 = (t) => Math.min(52, Math.max(0, (t - 74) * 1.55)), f26 = (t) => Math.min(47, Math.max(0, (t - 74) * 1.85));
  const pts = (fn, col, n, lbl) => {
    for (let i = 0; i < n; i++) { const t = 74 + r() * 29; const k = clamp(fn(t) * (0.85 + r() * 0.3) + (r() - 0.5) * 3, 0, 58); const c = svgEl("circle", { cx: xT(t), cy: yK(k), r: 4, fill: col, opacity: 0.8, stroke: cssv("--surface"), "stroke-width": 1.5 }, s); hoverable(c, `<b>${lbl} season</b><div class="r"><span>High</span><span>${Math.round(t)}°F</span></div><div class="r"><span>Cooling</span><span>${fmt(k, 1)} kWh</span></div>`); }
    const d = []; for (let t = 74; t <= 103; t += 0.5) d.push(`${d.length ? "L" : "M"}${xT(t)},${yK(fn(t))}`);
    svgEl("path", { d: d.join(""), fill: "none", stroke: col, "stroke-width": 2 }, s);
  };
  pts(f24, cssv("--c-cool"), 60, "2024");
  pts(f26, cssv("--c-heat"), 60, "2026");
  const sx = xT(99.5);
  svgEl("line", { x1: sx, x2: sx, y1: yK(58), y2: yK(47), class: "axis-l", "stroke-dasharray": "3 3" }, s);
  text(s, sx - 6, yK(56), "Flat above ~99°F: saturation", { "text-anchor": "end", class: "t-2" });
  text(s, xT(80), yK(28), "+19% kWh per degree vs 2024: degradation", { class: "t-2" });
  v.append(el("div", { class: "viz-h" }, `<h4>One home's AC, two summers</h4><span class="legend"><span><span class="sw" style="background:var(--c-cool)"></span>2024</span><span><span class="sw" style="background:var(--c-heat)"></span>2026</span></span>`), s);
  v.append(el("div", { class: "kpis" }, `<div class="kpi"><b>Degradation</b><span>Energy per cooling degree up 19% in two seasons</span></div><div class="kpi"><b>Saturation</b><span>Output caps at ~47 kWh/day above 99°F</span></div><div class="kpi"><b>Short cycling</b><span>Not detected for this system</span></div>`));
}

/* Lifestyle */
const ARCH = [
  { n: "Office Goer", d: "Away on weekdays, morning and evening peaks", f: (h) => 0.5 + 1.1 * Math.exp(-((h - 7) ** 2) / 2) + 1.9 * Math.exp(-((h - 19.5) ** 2) / 5) },
  { n: "Active", d: "Home through the day, broad afternoon load", f: (h) => 0.6 + 1.3 * Math.exp(-((h - 9) ** 2) / 6) + 1.6 * Math.exp(-((h - 15) ** 2) / 10) + 1.2 * Math.exp(-((h - 20) ** 2) / 4) },
  { n: "Evening Consumer", d: "Low days, heavy late evening", f: (h) => 0.45 + 2.6 * Math.exp(-((h - 21.5) ** 2) / 3) + 0.4 * Math.exp(-((h - 8) ** 2) / 2) },
  { n: "Dormant", d: "Little variation, often vacant or seasonal", f: (h) => 0.42 + 0.12 * Math.exp(-((h - 19) ** 2) / 6) },
];
function mLife() {
  const v = panel(`<h3>Customer lifestyle</h3>
    <p>How and when a household uses energy.</p>`,
    [["Input", "Annual, seasonal and daily usage patterns"], ["Output", "Archetype label per household"], ["Archetypes", "Dormant, Office Goer, Active, Weekend Warrior, Evening Consumer and more"]]);
  const grid = el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px" });
  ARCH.forEach((a, j) => {
    const w = 200, h = 96, ml = 2, mr = 2, mt = 6, mb = 4;
    const vals = Array.from({ length: 25 }, (_, i) => a.f(i)); const top = 3.2;
    const x = (i) => ml + i / 24 * (w - ml - mr), y = (vv) => mt + (top - vv) / top * (h - mt - mb);
    const s = mkSvg(w, h, `${a.n} average weekday load shape`);
    svgEl("line", { x1: ml, x2: w - mr, y1: y(0), y2: y(0), class: "axis-l" }, s);
    const col = j === 0 ? cssv("--accent") : cssv("--muted");
    const d = vals.map((vv, i) => `${i ? "L" : "M"}${x(i)},${y(vv)}`).join("");
    svgEl("path", { d: d + `L${x(24)},${y(0)}L${x(0)},${y(0)}Z`, fill: col, opacity: 0.14 }, s);
    svgEl("path", { d, fill: "none", stroke: col, "stroke-width": 2 }, s);
    const card = el("div", { class: "det" });
    card.innerHTML = `<div class="h">${a.n}${j === 0 ? ' <span class="tag" style="margin-left:auto">sample home</span>' : ""}</div><div class="v">${a.d}</div>`;
    if (j === 0) card.classList.add("hl");
    card.append(s, el("div", { class: "hm-axis-row" }, "<span>0h</span><span>12h</span><span>24h</span>")); grid.append(card);
  });
  v.append(el("div", { class: "viz-h" }, `<h4>Average weekday load shape by archetype</h4><span class="xs muted mono">kWh per hour, illustrative</span>`), grid);
}

/* DER propensity */
const PROP = (() => { const r = rng(9); const a = []; for (let i = 0; i < 24000; i++) { const u = r(), w = r(); a.push(clamp(Math.pow(u, 2.4) * 0.85 + (w < 0.08 ? 0.35 * r() : 0), 0, 0.999)); } return a; })();
let propT = 0.6;
function mProp() {
  const v = panel(`<h3>DER propensity</h3>
    <p>Who is likely to adopt an EV or solar next.</p>`,
    [["Input", "Usage patterns, home and lifestyle profile, area adoption"], ["Output", "EV and solar adoption likelihood per customer"]]);
  v.append(el("div", { class: "viz-h" }, `<h4>EV propensity across one network · 24,000 premises</h4><span class="xs muted mono">synthetic distribution</span>`));
  const holder = el("div"); v.append(holder);
  const ctl = el("div", { class: "range" }, `<label for="prop-t" class="small">Outreach threshold</label><input id="prop-t" type="range" min="0.2" max="0.9" step="0.05" value="${propT}"><span class="mono small" id="prop-tv">${propT.toFixed(2)}</span>`);
  v.append(ctl);
  const k = el("div", { class: "kpis" }); v.append(k);
  const draw = () => {
    const bins = 20, cnt = new Array(bins).fill(0); PROP.forEach(p => cnt[Math.min(bins - 1, Math.floor(p * bins))]++);
    const w = VW(), h = 200, ml = 44, mr = 8, mt = 10, mb = 26; const top = Math.ceil(Math.max(...cnt) / 1000) * 1000;
    const bw = (w - ml - mr) / bins, y = (vv) => mt + (top - vv) / top * (h - mt - mb);
    const s = mkSvg(w, h, "Histogram of EV propensity scores");
    yAxis(s, ml, w - mr, y, [0, top / 2, top], (t) => t >= 1000 ? `${t / 1000}k` : t);
    cnt.forEach((c, i) => {
      const lo = i / bins, on = lo >= propT - 1e-9;
      const r = svgEl("rect", { x: ml + i * bw + 1, y: y(c), width: bw - 2, height: y(0) - y(c), rx: 3, fill: on ? cssv("--accent") : cssv("--surface-3") }, s);
      hoverable(r, `<b>Score ${lo.toFixed(2)}-${(lo + 1 / bins).toFixed(2)}</b><div class="r"><span>Premises</span><span>${c.toLocaleString()}</span></div>`);
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(t => text(s, ml + t * (w - ml - mr), h - 8, t.toFixed(2), { "text-anchor": "middle" }));
    holder.innerHTML = ""; holder.append(s);
    const sel = PROP.filter(p => p >= propT); const exp = sel.reduce((a, p) => a + p * 0.35, 0); const all = PROP.reduce((a, p) => a + p * 0.35, 0);
    k.innerHTML = `<div class="kpi"><b>${sel.length.toLocaleString()}</b><span>premises above threshold</span></div><div class="kpi"><b>${Math.round(exp).toLocaleString()}</b><span>expected adopters in 24 months</span></div><div class="kpi"><b>${Math.round(exp / all * 100)}%</b><span>of expected adopters reached with ${Math.round(sel.length / PROP.length * 100)}% of outreach</span></div>`;
  };
  $("#prop-t").addEventListener("input", (e) => { propT = +e.target.value; $("#prop-tv").textContent = propT.toFixed(2); draw(); });
  draw();
}

/* Income */
let incMode = "premise";
const INC = (() => { const r = rng(31); const blocks = [0.12, 0.55, 0.3, 0.72, 0.2, 0.42]; const cells = []; for (let b = 0; b < 6; b++) for (let i = 0; i < 48; i++) { const truth = r() < blocks[b]; const p = clamp(truth ? 0.62 + r() * 0.35 : r() * 0.45 + (r() < 0.1 ? 0.25 : 0), 0, 1); cells.push({ b, truth, p, share: blocks[b] }); } return cells; })();
function mInc() {
  const v = panel(`<h3>Customer income</h3>
    <p>Income eligibility, scored per premise instead of per census block.</p>`,
    [["Input", "Energy profile, home attributes, census income distribution"], ["Output", "Likelihood of income eligibility per premise"]]);
  const seg = el("div", { class: "seg", role: "group", "aria-label": "Targeting method" }, `<button type="button" data-m="census" aria-pressed="${incMode === "census"}">Census block average</button><button type="button" data-m="premise" aria-pressed="${incMode === "premise"}">Premise-level model</button>`);
  v.append(el("div", { class: "viz-h" }, `<h4>288 premises in six census blocks</h4>`));
  v.firstElementChild.append(seg);
  const holder = el("div"); v.append(holder);
  const k = el("div", { class: "kpis" }); v.append(k);
  const draw = () => {
    seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === incMode));
    const cols = 24, cs = Math.max(11, Math.floor((VW() - 2) / 24)), w = cols * cs + 2, rows = Math.ceil(INC.length / cols), h = rows * cs + 22;
    const s = mkSvg(w, h, "Grid of premises colored by income eligibility likelihood");
    const zero = cssv("--hm-zero"), hue = cssv("--c-wh");
    INC.forEach((c, i) => {
      const bx = c.b % 3, by = Math.floor(c.b / 3); const ii = i % 48; const cx = bx * 8 + (ii % 8), cy = by * 6 + Math.floor(ii / 8);
      const val = incMode === "census" ? c.share : c.p;
      const rgb = mix(zero, hue, clamp(val, 0.05, 1));
      const targeted = incMode === "census" ? c.share >= 0.4 : c.p >= 0.5;
      const r = svgEl("rect", { x: cx * cs + 2, y: cy * cs + 2, width: cs - 4, height: cs - 4, rx: 5, fill: `rgb(${rgb})`, stroke: targeted ? cssv("--ink") : "none", "stroke-width": targeted ? 1.5 : 0 }, s);
      if (c.truth) svgEl("circle", { cx: cx * cs + cs / 2, cy: cy * cs + cs / 2, r: 3, fill: cssv("--surface") }, s);
      hoverable(r, `<b>Premise ${1000 + i}</b><div class="r"><span>Block share</span><span>${Math.round(c.share * 100)}%</span></div><div class="r"><span>Premise score</span><span>${c.p.toFixed(2)}</span></div><div class="r"><span>Eligible (truth)</span><span>${c.truth ? "yes" : "no"}</span></div>`);
    });
    text(s, 2, h - 6, "Fill: likelihood · Outline: targeted · Dot: truly eligible");
    holder.innerHTML = ""; holder.append(s);
    const tg = INC.filter(c => incMode === "census" ? c.share >= 0.4 : c.p >= 0.5), hit = tg.filter(c => c.truth).length, tot = INC.filter(c => c.truth).length;
    k.innerHTML = `<div class="kpi"><b>${tg.length}</b><span>households contacted</span></div><div class="kpi"><b>${hit} of ${tot}</b><span>eligible households reached</span></div><div class="kpi"><b>${Math.round(hit / tg.length * 100)}%</b><span>of outreach reaches an eligible home</span></div>`;
  };
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { incMode = b.dataset.m; draw(); } });
  draw();
}

/* Personalized insights */
function mPI() {
  const v = panel(`<h3>Personalized insights</h3>
    <p>Each home against similar homes, appliance by appliance.</p>`,
    [["Input", "Disaggregation, home profile, similar-home cohort"], ["Output", "Efficiency score per appliance, ranked tips"]]);
  const rows = [["Cooling", 612, 430, 540], ["EV charging", 318, 250, 300], ["Pool pump", 205, 150, 240], ["Water heating", 180, 120, 160], ["Always on", 225, 170, 210], ["Lighting & other", 260, 220, 250]];
  const w = VW(), rh = 34, ml = 130, mr = 20, mt = 24, h = mt + rows.length * rh + 24;
  const mx = 700; const x = (vv) => ml + vv / mx * (w - ml - mr);
  const s = mkSvg(w, h, "July kWh by appliance: this home, similar homes average, efficient similar homes");
  [0, 175, 350, 525, 700].forEach(t => { svgEl("line", { x1: x(t), x2: x(t), y1: mt - 8, y2: h - 20, class: "grid-l" }, s); text(s, x(t), h - 6, t, { "text-anchor": "middle" }); });
  text(s, w - mr, h - 6, "kWh in July", { "text-anchor": "end" });
  const C = [cssv("--c-cool"), cssv("--c-heat"), cssv("--c-ev")];
  rows.forEach(([n, me, eff, avg], i) => {
    const cy = mt + i * rh + rh / 2;
    text(s, ml - 10, cy + 4, n, { "text-anchor": "end", class: "t-ink" });
    svgEl("line", { x1: x(Math.min(me, eff, avg)), x2: x(Math.max(me, eff, avg)), y1: cy, y2: cy, stroke: cssv("--line-2"), "stroke-width": 2 }, s);
    [[eff, 2, "Efficient similar homes"], [avg, 1, "Similar homes average"], [me, 0, "This home"]].forEach(([val, ci, lbl]) => {
      const c = svgEl("circle", { cx: x(val), cy, r: ci === 0 ? 6 : 5, fill: C[ci], stroke: cssv("--surface"), "stroke-width": 2 }, s);
      hoverable(c, `<b>${n}</b><div class="r"><span>${lbl}</span><span>${val} kWh</span></div>`);
    });
  });
  v.append(el("div", { class: "viz-h" }, `<h4>This home vs. similar homes, July</h4><span class="legend"><span><span class="sw" style="background:var(--c-cool);border-radius:50%"></span>This home</span><span><span class="sw" style="background:var(--c-heat);border-radius:50%"></span>Similar avg.</span><span><span class="sw" style="background:var(--c-ev);border-radius:50%"></span>Efficient similar</span></span>`), s);
  v.append(el("div", {}, `<h4 style="margin-bottom:8px">Ranked tips for this home</h4><ol class="tips-list"><li>Raise the cooling setpoint 2°F from 2 to 7pm <b>$19/mo</b></li><li>Book an AC tune-up: output is degrading <b>$14/mo</b></li><li>Keep EV charging after 11pm on the TOU plan <b>$11/mo</b></li><li>Trim pool pump run to 6 hours in September <b>$6/mo</b></li></ol>`));
}

/* Revenue loss */
function mRev() {
  const v = panel(`<h3>Revenue loss</h3>
    <p>Drops that weather and behavior can't explain get flagged.</p>
    <div class="chips">${["Theft", "Rate misuse", "Tampering", "Load violation", "Power factor", "Terminal burn"].map(c => `<span class="tag">${c}</span>`).join("")}</div>`,
    [["Input", "AMI usage, meter events, rate assignment, weather"], ["Output", "Anomaly flag, category and priority per meter"]]);
  const r = rng(5); const n = 180, drop = 118;
  const exp = [], act = [];
  for (let d = 0; d < n; d++) { const e = 34 + 16 * Math.sin(2 * Math.PI * (d + 40) / 365 * 2) + (r() - 0.5) * 6; exp.push(e); act.push(d < drop ? e * (0.93 + r() * 0.14) : e * (0.38 + r() * 0.1)); }
  const w = VW(), h = 240, ml = 38, mr = 12, mt = 14, mb = 26, top = 60;
  const x = (d) => ml + d / (n - 1) * (w - ml - mr), y = (vv) => mt + (top - vv) / top * (h - mt - mb);
  const s = mkSvg(w, h, "Daily consumption versus weather-expected consumption with flagged drop");
  yAxis(s, ml, w - mr, y, [0, 20, 40, 60]);
  text(s, 4, mt - 4, "kWh/day");
  svgEl("rect", { x: x(drop), y: mt, width: x(n - 1) - x(drop), height: h - mt - mb, fill: cssv("--crit"), opacity: 0.07 }, s);
  const band = exp.map((e, i) => `${i ? "L" : "M"}${x(i)},${y(e * 1.12)}`).join("") + exp.slice().reverse().map((e, i) => `L${x(n - 1 - i)},${y(e * 0.88)}`).join("") + "Z";
  svgEl("path", { d: band, fill: cssv("--muted"), opacity: 0.16 }, s);
  svgEl("path", { d: act.map((a, i) => `${i ? "L" : "M"}${x(i)},${y(a)}`).join(""), fill: "none", stroke: cssv("--c-cool"), "stroke-width": 2 }, s);
  svgEl("line", { x1: x(drop), x2: x(drop), y1: mt, y2: h - mb, stroke: cssv("--crit"), "stroke-width": 1.5, "stroke-dasharray": "4 3" }, s);
  svgEl("circle", { cx: x(drop), cy: y(act[drop]), r: 5, fill: cssv("--crit"), stroke: cssv("--surface"), "stroke-width": 2 }, s);
  text(s, x(drop) + 8, mt + 12, "Flagged: tampering suspected", { class: "t-ink" });
  text(s, x(drop) + 8, mt + 26, "Usage down 58% with no weather or occupancy change", { class: "t-2" });
  ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].forEach((m, i) => text(s, x(i * 30 + 15), h - 8, m, { "text-anchor": "middle" }));
  const hit = svgEl("rect", { x: ml, y: mt, width: w - ml - mr, height: h - mt - mb, fill: "transparent" }, s);
  hit.addEventListener("mousemove", (e) => { const rc = s.getBoundingClientRect(); const px = (e.clientX - rc.left) / rc.width * w; const d = clamp(Math.round((px - ml) / (w - ml - mr) * (n - 1)), 0, n - 1); showTip(`<b>Day ${d + 1}</b><div class="r"><span><i style="background:var(--c-cool)"></i>Metered</span><span>${fmt(act[d], 1)} kWh</span></div><div class="r"><span>Expected</span><span>${fmt(exp[d] * 0.88, 0)}-${fmt(exp[d] * 1.12, 0)} kWh</span></div>`, e.clientX, e.clientY); });
  hit.addEventListener("mouseleave", hideTip);
  v.append(el("div", { class: "viz-h" }, `<h4>Metered vs. expected consumption</h4><span class="legend"><span><span class="sw" style="background:var(--c-cool)"></span>Metered</span><span><span class="sw" style="background:var(--muted);opacity:.4"></span>Expected range</span><span><span class="sw" style="background:var(--crit)"></span>Flag</span></span>`), s);
  v.append(el("div", { class: "kpis" }, `<div class="kpi"><b>Priority 1</b><span>Ranked for field investigation</span></div><div class="kpi"><b>~410 kWh</b><span>estimated unbilled per month</span></div><div class="kpi"><b>Tampering</b><span>Category, with meter event match</span></div>`));
}
