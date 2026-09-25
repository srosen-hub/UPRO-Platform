(() => {
"use strict";

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html) => {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") n.className = attrs[k];
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  if (html != null) n.innerHTML = html;
  return n;
};
const cssv = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const hex2rgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t)); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS = "http://www.w3.org/2000/svg";
const fmt = (v, d = 1) => v.toFixed(d);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

const tip = $("#tip");
function showTip(html, x, y) {
  tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = x - w - 14;
  if (top + h > innerHeight - 8) top = y - h - 14;
  tip.style.left = Math.max(8, left) + "px"; tip.style.top = Math.max(8, top) + "px";
}
const hideTip = () => { tip.hidden = true; };

/* ---------- synthetic household: one year of hourly data ---------- */
const START = Date.UTC(2025, 9, 1); // 1 Oct 2025, a Wednesday
const DAYS = 365, H = 24, N = DAYS * H;
const dateOf = (d) => new Date(START + d * 864e5);
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const dLabel = (d) => { const t = dateOf(d); return `${DOW[t.getUTCDay()]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
const isWeekend = (d) => { const w = dateOf(d).getUTCDay(); return w === 0 || w === 6; };
const EV_START = 105;   // 14 Jan 2026
const EV_SHIFT = 240;   // 29 May 2026, charging moves off-peak after TOU coaching
const SOLAR_START = 180; // 30 Mar 2026
const VS_POOL = 243;    // 1 Jun 2026, variable-speed pump
const inPool = (d) => d <= 30 || d >= 212;

const CATS = [ // stack order bottom-up; hue order validated for CVD in both themes
  { id: "ao", name: "Always on", v: "--c-ao" },
  { id: "pool", name: "Pool pump", v: "--c-pool" },
  { id: "wh", name: "Water heating", v: "--c-wh" },
  { id: "ev", name: "EV charging", v: "--c-ev" },
  { id: "heat", name: "Heating", v: "--c-heat" },
  { id: "cool", name: "Cooling", v: "--c-cool" },
  { id: "other", name: "Lighting, fridge & other", v: "--c-other" },
];
const SOLAR = { id: "solar", name: "Solar generation", v: "--c-solar" };

const HH = (() => {
  const r = rng(20260925);
  const c = {}; ["ao","pool","wh","ev","heat","cool","other","solar"].forEach(k => c[k] = new Float32Array(N));
  const temp = new Float32Array(N);
  let wxNoise = 0, cloud = 0.8;
  let evCarry = 0;
  for (let d = 0; d < DAYS; d++) {
    wxNoise = wxNoise * 0.7 + (r() - 0.5) * 7;
    cloud = clamp(cloud * 0.55 + (0.35 + r() * 0.75) * 0.45, 0.25, 1);
    const mean = 62 - 21 * Math.cos(2 * Math.PI * (d - 111) / 365) + wxNoise;
    const summer = (1 - Math.cos(2 * Math.PI * (d - 111) / 365)) / 2; // 0 Jan, 1 Jul
    const winter = 1 - summer;
    const we = isWeekend(d);
    const cooks = r() < 0.72;
    const whM = we ? 8 + (r() < 0.5 ? 1 : 0) : 6 + (r() < 0.4 ? 1 : 0);
    const whE = 19 + Math.floor(r() * 3);
    const evTonight = d >= EV_START && r() < 0.7;
    const evNeed = 7 + r() * 11;
    const evStart = d >= EV_SHIFT ? 23 : (we ? 20 : 18 + Math.floor(r() * 2));
    const rise = 7 - 1.4 * summer, len = 10.5 + 3.8 * summer;
    for (let h = 0; h < H; h++) {
      const i = d * H + h;
      const T = mean + 9 * Math.sin(2 * Math.PI * (h - 9) / 24) + (r() - 0.5) * 2;
      temp[i] = T;
      const home = we || h < 8 || h >= 17;
      c.ao[i] = 0.3 + r() * 0.04;
      let o = 0.05 + (r() < 0.5 ? 0.04 : 0);
      if (h >= 18 && h <= 23) o += 0.2 + 0.12 * winter;
      if (h >= 6 && h <= 7) o += 0.1;
      if (cooks && h >= 17 && h <= 18) o += 0.45 + r() * 0.3;
      if (home && h >= 7 && h <= 23) o += 0.08 + r() * 0.22;
      c.other[i] = o;
      const spC = home ? 74 : 80;
      c.cool[i] = Math.min(3.7, Math.max(0, T - spC) * 0.2 * (0.85 + r() * 0.3));
      const spH = (h < 5 || !home) ? 64 : 68;
      let heat = Math.max(0, spH - T) * 0.075 * (0.8 + r() * 0.4);
      if (T < 32) heat += 3.2 * (r() < 0.65 ? 1 : 0.4);
      c.heat[i] = Math.min(8, heat);
      let wh = 0;
      if (h === whM) wh = (1.6 + r() * 0.8) * (1 + 0.3 * winter);
      if (h === whE) wh = (1.0 + r() * 0.6) * (1 + 0.3 * winter);
      if (h === 13 && we) wh = 0.6 * r();
      c.wh[i] = wh;
      if (inPool(d)) {
        if (d >= VS_POOL) c.pool[i] = (h >= 9 && h <= 16) ? 0.85 + r() * 0.08 : 0;
        else c.pool[i] = ((h >= 8 && h <= 10) || (h >= 14 && h <= 16)) ? 1.75 + r() * 0.1 : 0;
      }
      if (evTonight && h === evStart) evCarry = evNeed;
      if (evCarry > 0 && (h >= evStart || h < 6)) { const e = Math.min(7.2, evCarry); c.ev[i] += e; evCarry -= e; }
      if (d >= SOLAR_START) {
        const x = (h + 0.5 - rise) / len;
        const g = x > 0 && x < 1 ? Math.pow(Math.sin(Math.PI * x), 1.25) : 0;
        c.solar[i] = 6.5 * 0.78 * g * cloud * (0.9 + r() * 0.1) * (0.7 + 0.3 * summer);
      }
    }
    // carry-over EV charge into the early hours of the next day
    if (evCarry > 0 && d + 1 < DAYS) {
      for (let h = 0; h < 6 && evCarry > 0; h++) { const i = (d + 1) * H + h; const e = Math.min(7.2, evCarry); c.ev[i] += e; evCarry -= e; }
      evCarry = 0;
    }
  }
  const total = new Float32Array(N), net = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0; for (const k of CATS) s += c[k.id][i];
    total[i] = s; net[i] = s - c.solar[i];
  }
  return { c, total, net, temp };
})();

const annual = {};
for (const k of [...CATS, SOLAR]) { let s = 0; const a = HH.c[k.id]; for (let i = 0; i < N; i++) s += a[i]; annual[k.id] = s; }

/* ---------- hero heatmap ---------- */
let heroMode = "raw";
function drawHero() {
  const cv = $("#hero-hm"); const ctx = cv.getContext("2d");
  const cw = cv.width / DAYS, ch = cv.height / H;
  const zero = cssv("--hm-zero"), blue = cssv("--c-cool"), sol = cssv("--c-solar");
  const deep = mix(blue, "#0a2a55", 0.35).map(v => v.toString(16).padStart(2, "0")).join("");
  const img = ctx.createImageData(cv.width, cv.height);
  const catCols = CATS.map(k => cssv(k.v));
  const px = (x, y, rgb) => { const o = (y * cv.width + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; };
  const cells = [];
  for (let d = 0; d < DAYS; d++) for (let h = 0; h < H; h++) {
    const i = d * H + h; let rgb;
    if (heroMode === "raw") {
      const v = HH.net[i];
      rgb = v >= 0 ? mix(zero, "#" + deep, Math.pow(clamp(v / 9, 0, 1), 0.6)) : mix(zero, sol, Math.pow(clamp(-v / 4.5, 0, 1), 0.7));
    } else {
      let best = 0, bv = -1;
      CATS.forEach((k, j) => { const v = HH.c[k.id][i]; if (k.id !== "other" && k.id !== "ao" && v > bv) { bv = v; best = j; } });
      const sv = HH.c.solar[i];
      if (sv > bv && sv > 0.6) rgb = mix(zero, sol, clamp(0.35 + sv / 5, 0, 1));
      else if (bv < 0.35) rgb = mix(zero, catCols[0], 0.28);
      else rgb = mix(zero, catCols[best], clamp(0.35 + bv / 4, 0, 1));
    }
    cells.push([d, h, rgb]);
  }
  for (const [d, h, rgb] of cells) {
    const x0 = Math.floor(d * cw), x1 = Math.floor((d + 1) * cw), y0 = Math.floor(h * ch), y1 = Math.floor((h + 1) * ch);
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) px(x, y, rgb);
  }
  ctx.putImageData(img, 0, 0);
  const lg = $("#hero-legend");
  if (heroMode === "raw") {
    lg.innerHTML = `<span>Export</span><i style="background:linear-gradient(90deg,${sol},${zero})"></i><i style="background:linear-gradient(90deg,${zero},#${deep})"></i><span>Import (up to 9 kWh/h)</span><span style="margin-left:auto">rows: midnight to midnight</span>`;
  } else {
    lg.innerHTML = [...CATS.filter(k => !["ao", "other"].includes(k.id)), SOLAR].map(k => `<span style="display:inline-flex;align-items:center;gap:5px"><span class="sw" style="background:var(${k.v})"></span>${k.name}</span>`).join("") + `<span style="margin-left:auto">dominant load each hour</span>`;
  }
}
function setHero(m) {
  heroMode = m;
  $("#hero-raw").setAttribute("aria-pressed", m === "raw");
  $("#hero-dis").setAttribute("aria-pressed", m === "dis");
  drawHero();
}
$("#hero-raw").addEventListener("click", () => setHero("raw"));
$("#hero-dis").addEventListener("click", () => setHero("dis"));
$("#hero-hm").addEventListener("mousemove", (e) => {
  const cv = e.currentTarget, rc = cv.getBoundingClientRect();
  const d = clamp(Math.floor((e.clientX - rc.left) / rc.width * DAYS), 0, DAYS - 1);
  const h = clamp(Math.floor((e.clientY - rc.top) / rc.height * H), 0, H - 1);
  const i = d * H + h;
  const rows = [...CATS, SOLAR].filter(k => HH.c[k.id][i] > 0.05).sort((a, b) => HH.c[b.id][i] - HH.c[a.id][i]).slice(0, 4)
    .map(k => `<div class="r"><span><i style="background:var(${k.v})"></i>${k.name}</span><span>${k.id === "solar" ? "-" : ""}${fmt(HH.c[k.id][i], 2)}</span></div>`).join("");
  showTip(`<b>${dLabel(d)} · ${String(h).padStart(2, "0")}:00</b><div class="r"><span>Net meter read</span><span>${fmt(HH.net[i], 2)} kWh</span></div>${rows}`, e.clientX, e.clientY);
});
$("#hero-hm").addEventListener("mouseleave", hideTip);

/* ---------- platform map ---------- */
let cloud = store.get("upro-cloud") || "azure";
if (!CLOUDS[cloud]) cloud = "azure";
let selNode = "m-disagg", traceId = null;
const sub = (s) => s.replace(/\{(\w+)\}/g, (_, k) => CLOUDS[cloud][k] ?? "");

function buildPlatform() {
  const src = $("#col-src"), out = $("#col-out"), grid = $("#tenant-grid");
  for (const id in NODES) {
    const n = NODES[id];
    if (n.col === "src") src.append(nodeBtn(id));
    if (n.col === "out") out.append(nodeBtn(id));
  }
  for (const L of LAYERS) {
    const col = el("div", { class: "layer" });
    col.append(el("div", { class: "layer-h" }, `${L.name}<small>${L.tag}</small>`));
    let lastGroup = null;
    for (const id in NODES) {
      const n = NODES[id]; if (n.layer !== L.id) continue;
      if (n.group && n.group !== lastGroup) { col.append(el("div", { class: "sublabel" }, n.group)); lastGroup = n.group; }
      col.append(nodeBtn(id));
    }
    grid.append(col);
  }
}
function nodeBtn(id) {
  const n = NODES[id];
  const b = el("button", { type: "button", class: "node", "data-id": id, "aria-pressed": "false" });
  b.innerHTML = `${esc(n.name)}<small data-sub>${esc(sub(n.sub))}</small>`;
  b.addEventListener("click", () => selectNode(id));
  return b;
}
function refreshNodeText() {
  document.querySelectorAll(".node").forEach(b => { b.querySelector("[data-sub]").textContent = sub(NODES[b.dataset.id].sub); });
  $("#tenant-label").textContent = CLOUDS[cloud].tenant;
  $("#cloud-note").textContent = `Compute: ${CLOUDS[cloud].compute}`;
}
function selectNode(id) {
  selNode = id;
  document.querySelectorAll(".node").forEach(b => { const on = b.dataset.id === id; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on); });
  const n = NODES[id];
  const inUC = USE_CASES.filter(u => u.trace.includes(id));
  const ucLinks = inUC.map(u => `<button type="button" class="chip sm" data-uc="${u.id}">${esc(u.short)}</button>`).join(" ");
  let extra = "";
  if (n.tab) extra = `<p class="hint"><a href="#models" data-tab="${n.tab}">See the ${esc(n.name)} deep dive</a></p>`;
  $("#plat-detail").innerHTML = `
    <div><span class="eyebrow">${esc(n.kind)}</span><h3>${esc(n.name)}</h3><p class="small" style="color:var(--ink-2)">${esc(sub(n.desc))}</p>${extra}</div>
    <dl class="kv">
      ${n.feeds ? `<dt>Feeds</dt><dd>${esc(n.feeds)}</dd>` : ""}
      <dt>Runs in</dt><dd>${n.col === "src" ? "Your systems of record" : n.col === "out" ? "Your channels and tools" : esc(CLOUDS[cloud].tenant)}</dd>
      <dt>Use cases</dt><dd><div class="chips">${ucLinks || '<span class="muted">Foundation for all</span>'}</div></dd>
    </dl>`;
  $("#plat-detail").querySelectorAll("[data-uc]").forEach(b => b.addEventListener("click", () => { setTrace(b.dataset.uc); }));
  const a = $("#plat-detail").querySelector("[data-tab]");
  if (a) a.addEventListener("click", () => setModelTab(a.dataset.tab));
}
function setTrace(id) {
  traceId = traceId === id ? null : id;
  document.querySelectorAll("#trace-chips .chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.uc === traceId));
  const map = $("#platform-map");
  map.classList.toggle("tracing", !!traceId);
  const set = new Set(traceId ? USE_CASES.find(u => u.id === traceId).trace : []);
  document.querySelectorAll(".node").forEach(b => b.classList.toggle("on", set.has(b.dataset.id)));
  drawLinks();
}
const COL_ORDER = (id) => { const n = NODES[id]; if (n.col === "src") return 0; if (n.col === "out") return 6; return { data: 1, models: 2, engines: 3, access: 5 }[n.layer]; };
function drawLinks() {
  const svg = $("#plat-svg"); svg.innerHTML = "";
  if (!traceId) return;
  const map = $("#platform-map"), mr = map.getBoundingClientRect();
  const uc = USE_CASES.find(u => u.id === traceId);
  const ids = uc.trace.filter(id => NODES[id]);
  const byCol = {};
  ids.forEach(id => {
    const k = COL_ORDER(id);
    (byCol[k] = byCol[k] || []).push(id);
  });
  const keys = Object.keys(byCol).map(Number).sort((a, b) => a - b);
  const rect = (id) => { const r = map.querySelector(`.node[data-id="${id}"]`).getBoundingClientRect(); return { l: r.left - mr.left, r: r.right - mr.left, t: r.top - mr.top, b: r.bottom - mr.top, cx: (r.left + r.right) / 2 - mr.left, cy: (r.top + r.bottom) / 2 - mr.top }; };
  svg.setAttribute("viewBox", `0 0 ${mr.width} ${mr.height}`);
  svg.setAttribute("width", mr.width); svg.setAttribute("height", mr.height);
  for (let i = 0; i < keys.length - 1; i++) {
    const A = byCol[keys[i]], B = byCol[keys[i + 1]];
    // connect each A to nearest B, and each B to nearest A, to keep the wiring readable
    const pairs = new Set();
    A.forEach(a => { const ra = rect(a); let best = B[0], bd = 1e9; B.forEach(b => { const d = Math.abs(rect(b).cy - ra.cy); if (d < bd) { bd = d; best = b; } }); pairs.add(a + "|" + best); });
    B.forEach(b => { const rb = rect(b); let best = A[0], bd = 1e9; A.forEach(a => { const d = Math.abs(rect(a).cy - rb.cy); if (d < bd) { bd = d; best = a; } }); pairs.add(best + "|" + b); });
    pairs.forEach(p => {
      const [a, b] = p.split("|"); const ra = rect(a), rb = rect(b);
      let x1 = ra.r, y1 = ra.cy, x2 = rb.l, y2 = rb.cy;
      if (rb.l < ra.r) { x1 = ra.cx; y1 = ra.b; x2 = rb.cx; y2 = rb.t; } // same column (data layer): drop vertically
      const dx = Math.max(24, (x2 - x1) / 2);
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", rb.l < ra.r ? `M${x1},${y1} C${x1},${y1 + 20} ${x2},${y2 - 20} ${x2},${y2}` : `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
      svg.append(path);
    });
  }
}
function buildCloudChips(containerId) {
  const c = $(containerId); c.innerHTML = "";
  for (const k in CLOUDS) {
    const b = el("button", { type: "button", class: "chip", "data-cloud": k, "aria-pressed": k === cloud }, esc(CLOUDS[k].label));
    b.addEventListener("click", () => setCloud(k));
    c.append(b);
  }
}
function setCloud(k) {
  cloud = k; store.set("upro-cloud", k);
  document.querySelectorAll("[data-cloud]").forEach(b => b.setAttribute("aria-pressed", b.dataset.cloud === k));
  refreshNodeText(); selectNode(selNode); renderDeploy(); renderUC(); drawLinks();
}
function buildTraceChips() {
  const c = $("#trace-chips");
  TRACE_CHIPS.forEach(id => {
    const u = USE_CASES.find(x => x.id === id);
    const b = el("button", { type: "button", class: "chip", "data-uc": id, "aria-pressed": "false" }, esc(u.short));
    b.addEventListener("click", () => setTrace(id));
    c.append(b);
  });
}

/* ---------- SVG chart helpers ---------- */
function svgEl(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.append(n); return n; }
function mkSvg(w, h, label) { const s = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label }); return s; }
function text(parent, x, y, str, attrs = {}) { const t = svgEl("text", { x, y, ...attrs }, parent); t.textContent = str; return t; }
function yAxis(s, x0, x1, y, ticks, fmtT = (v) => v) {
  ticks.forEach(v => { const yy = y(v); svgEl("line", { x1: x0, x2: x1, y1: yy, y2: yy, class: v === 0 ? "axis-l" : "grid-l" }, s); text(s, x0 - 6, yy + 3, fmtT(v), { "text-anchor": "end" }); });
}
function hoverable(node, html) {
  node.addEventListener("mousemove", (e) => showTip(typeof html === "function" ? html() : html, e.clientX, e.clientY));
  node.addEventListener("mouseleave", hideTip);
}

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
    <p style="color:var(--ink-2)">Each heatmap is the same meter: one row per day, one column per hour. The left panel is what the meter records. The rest are what the model separates out. Hover to read values; click any row to open that day.</p>
    <p class="small muted">Look for the EV stripe that appears in mid-January and moves to 11pm in June, solar arriving in spring, and the pool pump switching from two runs to one long variable-speed run.</p>`,
    [["Input", "AMI interval data (15-min or hourly), weather, bill cycles"], ["Output", "Hourly kWh per appliance per meter; monthly for cooking, laundry, entertainment"], ["Categories", "Always on, heating, cooling, water heating, refrigeration, lighting, pool pump, EV, solar, plus 3 monthly"], ["Written to", "Governed output tables in your data platform, every run"]]);
  v.append(el("div", { class: "viz-h" }, `<h4>8,760 hours, separated</h4><span class="xs muted mono">sample premise · Oct 2025 to Sep 2026</span>`));
  const wrap = el("div", { class: "hm-wrap" });
  const months = el("div", { class: "hm-y", "aria-hidden": "true" });
  ["Oct","Dec","Feb","Apr","Jun","Aug","Sep"].forEach(m => months.append(el("span", {}, m)));
  const multi = el("div", { class: "hm-multi" });
  const cursor = el("div", { class: "hm-cursor", hidden: "" });
  wrap.append(months, multi, cursor);
  v.append(wrap);
  const zero = cssv("--hm-zero");
  HM_SERIES.forEach(s => {
    const cell = el("div", { class: "hm-cell", role: "button", tabindex: "0", "aria-pressed": hmFocus === s.id, "aria-label": `${s.name} heatmap` });
    const cv = el("canvas", { width: 48, height: 365 });
    const arr = s.id === "net" ? HH.net : HH.c[s.id];
    let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(arr[i]));
    const ctx = cv.getContext("2d"); const img = ctx.createImageData(48, 365);
    const hue = s.id === "net" ? cssv("--c-cool") : cssv(s.v);
    const deep = s.id === "net" ? mix(hue, "#0a2a55", 0.4) : null;
    const deepHex = deep ? "#" + deep.map(x => x.toString(16).padStart(2, "0")).join("") : hue;
    const sol = cssv("--c-solar");
    for (let d = 0; d < DAYS; d++) for (let h = 0; h < H; h++) {
      const val = arr[d * H + h];
      const rgb = val < 0 ? mix(zero, sol, Math.pow(clamp(-val / 4.5, 0, 1), 0.7)) : mix(zero, deepHex, Math.pow(clamp(val / (s.id === "net" ? 9 : mx), 0, 1), 0.65));
      for (let x = h * 2; x < h * 2 + 2; x++) { const o = (d * 48 + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    const kwh = s.id === "net" ? `${Math.round(annual.ao + annual.pool + annual.wh + annual.ev + annual.heat + annual.cool + annual.other - annual.solar).toLocaleString()} kWh net` : `${Math.round(annual[s.id]).toLocaleString()} kWh/yr`;
    cell.innerHTML = `<div class="nm"><span class="sw" style="background:var(${s.v})"></span>${s.name}</div>`;
    cell.append(cv);
    cell.append(el("div", { class: "kwh" }, kwh));
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
    multi.append(cell);
  });
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
  const acc = el("div", {});
  acc.innerHTML = `<div class="viz-h" style="margin-bottom:8px"><h4>Published accuracy, 15-minute data</h4><span class="xs muted">validated against your ground truth before launch</span></div>
  <div class="tbl-scroll"><table class="acc-table"><thead><tr><th>Appliance</th><th>Min history</th><th>Precision</th><th>Recall</th><th>Accuracy</th><th>False pos.</th><th>Est. accuracy (100-MAPE)</th></tr></thead><tbody>
  ${ACCURACY.map(a => `<tr><td>${a.a}</td><td class="mono">${a.days} days</td><td>${a.p}%</td><td>${a.r}%</td><td>${a.acc}%</td><td>${a.fpr}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:${a.est}%"></i></div><span class="mono xs">${a.est} ±${a.pm}%</span></div></td></tr>`).join("")}
  </tbody></table></div><p class="xs muted" style="margin-top:6px">Precision: when the model says yes, how often it is right. Recall: share of true owners found. 100-MAPE: share of actual appliance consumption captured.</p>`;
  v.append(acc);
  drawDay();
}
function drawDay() {
  const box = $("#day-box"); if (!box) return;
  const d = selDay;
  const w = 720, h = 250, ml = 38, mr = 8, mt = 14, mb = 26;
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
    <p style="color:var(--ink-2)">Knowing a home has heating is useful. Knowing it runs electric resistance heat instead of a heat pump is what makes an electrification offer land. The attributes model profiles every detected appliance.</p>
    <p class="small muted">A heat pump draws a steady, cycling load that rises gently as it gets colder. Resistance heat jumps in large steps and tracks temperature much more steeply.</p>`,
    [["Input", "Disaggregation outputs, interval shape, weather"], ["Output", "Per-appliance attributes with confidence"], ["Examples", "Heating fuel, heat pump, pool pump type and runs, water heater type, EV charger amplitude, solar capacity, smart thermostat, battery"], ["Used for", "Electrification, BYOT DR, EV and battery programs, rebates"]]);
  v.append(el("div", { class: "detect-list" }, [
    ["Heating fuel", "Electric", "--c-heat"], ["Heat pump", "Detected · 0.93", "--c-heat"], ["Pool pump", "Variable speed · 1 run/day", "--c-pool"],
    ["Water heater", "Electric resistance · 2 runs/day", "--c-wh"], ["EV charger", "Level 2 · 7.2 kW", "--c-ev"], ["Solar capacity", "6-7 kW DC", "--c-solar"],
    ["Smart thermostat", "Detected · setback schedule", "--c-cool"], ["Battery", "Not detected", "--c-other"],
  ].map(([h, t, c]) => `<div class="det"><div class="h"><span class="sw" style="background:var(${c})"></span>${h}</div><div class="v">${t}</div></div>`).join("")));
  // heat pump vs resistance on a cold day
  const w = 720, h = 240, ml = 38, mr = 90, mt = 16, mb = 26;
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
    <p style="color:var(--ink-2)">The model tracks how much energy each home's HVAC needs per degree of weather, season after season. Rising energy per degree means degradation. A ceiling on the hottest days means the unit is saturated and cannot keep up. Frequent short on-off patterns point to short cycling.</p>`,
    [["Input", "Heating and cooling disaggregation, weather"], ["Output", "Degradation, short cycling and saturation flags per system"], ["Used for", "Tune-up and replacement offers, heat pump upgrades, EE program targeting"]]);
  const r = rng(77);
  const w = 720, h = 280, ml = 42, mr = 16, mt = 16, mb = 34;
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
    <p style="color:var(--ink-2)">Lifestyle archetypes cluster how and when a household uses energy across seasons and days of the week. They shape message timing, rate fit and program offers. The sample home is an Office Goer on weekdays and a Weekend Warrior on Saturdays.</p>`,
    [["Input", "Annual, seasonal and daily usage patterns"], ["Output", "Archetype label per household"], ["Archetypes", "Dormant, Office Goer, Active, Weekend Warrior, Evening Consumer and more"], ["Used for", "Rate fit, message timing, DR availability"]]);
  const grid = el("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px" });
  ARCH.forEach((a, j) => {
    const w = 200, h = 110, ml = 6, mr = 6, mt = 8, mb = 16;
    const vals = Array.from({ length: 25 }, (_, i) => a.f(i)); const top = 3.2;
    const x = (i) => ml + i / 24 * (w - ml - mr), y = (vv) => mt + (top - vv) / top * (h - mt - mb);
    const s = mkSvg(w, h, `${a.n} average weekday load shape`);
    svgEl("line", { x1: ml, x2: w - mr, y1: y(0), y2: y(0), class: "axis-l" }, s);
    const col = j === 0 ? cssv("--accent") : cssv("--muted");
    const d = vals.map((vv, i) => `${i ? "L" : "M"}${x(i)},${y(vv)}`).join("");
    svgEl("path", { d: d + `L${x(24)},${y(0)}L${x(0)},${y(0)}Z`, fill: col, opacity: 0.14 }, s);
    svgEl("path", { d, fill: "none", stroke: col, "stroke-width": 2 }, s);
    [0, 12, 24].forEach(t => text(s, x(t), h - 3, `${t}h`, { "text-anchor": t === 0 ? "start" : t === 24 ? "end" : "middle" }));
    const card = el("div", { class: "det", style: j === 0 ? "border-color:var(--accent);background:var(--accent-soft)" : "" });
    card.innerHTML = `<div class="h">${a.n}${j === 0 ? ' <span class="tag" style="margin-left:auto">sample home</span>' : ""}</div><div class="v">${a.d}</div>`;
    card.append(s); grid.append(card);
  });
  v.append(el("div", { class: "viz-h" }, `<h4>Average weekday load shape by archetype</h4><span class="xs muted mono">kWh per hour, illustrative</span>`), grid);
}

/* DER propensity */
const PROP = (() => { const r = rng(9); const a = []; for (let i = 0; i < 24000; i++) { const u = r(), w = r(); a.push(clamp(Math.pow(u, 2.4) * 0.85 + (w < 0.08 ? 0.35 * r() : 0), 0, 0.999)); } return a; })();
let propT = 0.6;
function mProp() {
  const v = panel(`<h3>DER propensity</h3>
    <p style="color:var(--ink-2)">Propensity scores rank every customer by the likelihood of adopting an EV or installing solar. Planners use them as forecast inputs; program teams use them to reach likely adopters early. Existing owners, found by disaggregation, are excluded automatically.</p>`,
    [["Input", "Usage patterns, home and lifestyle profile, area adoption"], ["Output", "EV and solar adoption likelihood per customer"], ["Used for", "Localized adoption forecasts, EV program outreach, solar offers"]]);
  v.append(el("div", { class: "viz-h" }, `<h4>EV propensity across one network · 24,000 premises</h4><span class="xs muted mono">synthetic distribution</span>`));
  const holder = el("div"); v.append(holder);
  const ctl = el("div", { class: "range" }, `<label for="prop-t" class="small">Outreach threshold</label><input id="prop-t" type="range" min="0.2" max="0.9" step="0.05" value="${propT}"><span class="mono small" id="prop-tv">${propT.toFixed(2)}</span>`);
  v.append(ctl);
  const k = el("div", { class: "kpis" }); v.append(k);
  const draw = () => {
    const bins = 20, cnt = new Array(bins).fill(0); PROP.forEach(p => cnt[Math.min(bins - 1, Math.floor(p * bins))]++);
    const w = 720, h = 200, ml = 44, mr = 8, mt = 10, mb = 26; const top = Math.ceil(Math.max(...cnt) / 1000) * 1000;
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
    <p style="color:var(--ink-2)">Census data tells you the share of income-eligible households in a block. It cannot tell you which households. The income model scores each premise from its energy profile combined with public income distribution data, so assistance programs reach the right doors.</p>`,
    [["Input", "Energy profile, home attributes, census income distribution"], ["Output", "Likelihood of income eligibility per premise"], ["Used for", "Income-qualified EE and bill assistance, affordability reporting"]]);
  const seg = el("div", { class: "seg", role: "group", "aria-label": "Targeting method" }, `<button type="button" data-m="census" aria-pressed="${incMode === "census"}">Census block average</button><button type="button" data-m="premise" aria-pressed="${incMode === "premise"}">Premise-level model</button>`);
  v.append(el("div", { class: "viz-h" }, `<h4>288 premises in six census blocks</h4>`));
  v.firstElementChild.append(seg);
  const holder = el("div"); v.append(holder);
  const k = el("div", { class: "kpis" }); v.append(k);
  const draw = () => {
    seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === incMode));
    const cols = 24, cs = 28, w = cols * cs + 2, rows = Math.ceil(INC.length / cols), h = rows * cs + 22;
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
    <p style="color:var(--ink-2)">Each home is compared with statistically similar homes nearby, by size, age, heating type and appliance mix, at the appliance level. The gap drives a ranked list of tips, so a customer sees the two things worth doing in their home instead of twenty generic ones.</p>`,
    [["Input", "Disaggregation, home profile, similar-home cohort"], ["Output", "Efficiency score per appliance, ranked tips"], ["Used for", "Home energy reports, bill explanations, EE program savings"]]);
  const rows = [["Cooling", 612, 430, 540], ["EV charging", 318, 250, 300], ["Pool pump", 205, 150, 240], ["Water heating", 180, 120, 160], ["Always on", 225, 170, 210], ["Lighting & other", 260, 220, 250]];
  const w = 720, rh = 34, ml = 130, mr = 20, mt = 24, h = mt + rows.length * rh + 24;
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
    <p style="color:var(--ink-2)">The revenue loss model compares each meter with its own history, its weather response and similar premises. When consumption drops in a way weather and behavior cannot explain, the case is flagged and categorized for investigation.</p>
    <div class="chips">${["Theft", "Rate misuse", "Tampering", "Load violation", "Power factor", "Terminal burn"].map(c => `<span class="tag">${c}</span>`).join("")}</div>`,
    [["Input", "AMI usage, meter events, rate assignment, weather"], ["Output", "Anomaly flag, category and priority per meter"], ["Used for", "Revenue protection, field investigation, safety"]]);
  const r = rng(5); const n = 180, drop = 118;
  const exp = [], act = [];
  for (let d = 0; d < n; d++) { const e = 34 + 16 * Math.sin(2 * Math.PI * (d + 40) / 365 * 2) + (r() - 0.5) * 6; exp.push(e); act.push(d < drop ? e * (0.93 + r() * 0.14) : e * (0.38 + r() * 0.1)); }
  const w = 720, h = 240, ml = 38, mr = 12, mt = 14, mb = 26, top = 60;
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

/* ---------- use cases ---------- */
let ucId = "forecast";
function buildUCNav() {
  const nav = $("#uc-nav"); const groups = {};
  USE_CASES.forEach(u => (groups[u.group] = groups[u.group] || []).push(u));
  for (const g in groups) {
    const box = el("div", { class: "uc-group" }, `<h5>${esc(g)}</h5>`);
    groups[g].forEach(u => { const b = el("button", { type: "button", class: "uc-btn", "data-id": u.id, "aria-pressed": u.id === ucId }, esc(u.title)); b.addEventListener("click", () => { ucId = u.id; renderUC(); }); box.append(b); });
    nav.append(box);
  }
}
const CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function renderUC() {
  document.querySelectorAll(".uc-btn").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === ucId));
  const u = USE_CASES.find(x => x.id === ucId);
  const ing = (cls, title, dot, items) => `<div class="ing ${cls}"><h6><i style="background:${dot}"></i>${title}</h6><ul>${items.map(i => `<li>${esc(sub(i))}</li>`).join("")}</ul></div>`;
  $("#uc-card").innerHTML = `<article class="uc-card">
    <div class="uc-top"><span class="eyebrow">${esc(u.group)}</span><h3 style="font-size:1.6rem">${esc(u.title)}</h3><div class="tags">${u.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div><p style="color:var(--ink-2);max-width:72ch">${esc(u.need)}</p></div>
    <div><h4 style="margin-bottom:10px">The recipe</h4>
      <div class="recipe">
        ${ing("utility", "Your data", "var(--accent)", u.utility)}
        ${ing("", "Models", "var(--c-ev)", u.models)}
        ${ing("", "Engines", "var(--c-heat)", u.engines)}
        ${ing("", "APIs · MCPs · Apps", "var(--c-cool)", u.access)}
        <div class="eq"><span aria-hidden="true">=</span></div>
      </div>
    </div>
    <div class="uc-cols">
      <div><h4 style="margin-bottom:12px">How it runs</h4><ol class="steps">${u.steps.map(([t, who]) => `<li><span>${esc(sub(t))}<span class="who">${esc(who)}</span></span></li>`).join("")}</ol></div>
      <div style="display:grid;gap:16px;align-content:start">
        <div><h4 style="margin-bottom:10px">Value unlocked</h4><ul class="value-list">${u.value.map(x => `<li>${CHECK}<span>${esc(x)}</span></li>`).join("")}</ul></div>
        ${u.proof ? `<p class="proof">${esc(u.proof)}</p>` : ""}
        <div class="deploy-box"><h4>Deploying it</h4>
          <div class="split"><div><h6>Bidgely delivers</h6><ul>${u.bidgely.map(x => `<li>${esc(x)}</li>`).join("")}<li>Reference implementation and orchestration guide</li></ul></div>
          <div><h6>You or your SI</h6><ul>${u.you.map(x => `<li>${esc(x)}</li>`).join("")}<li>Runs in ${esc(CLOUDS[cloud].tenant)}</li></ul></div></div>
          <button type="button" class="btn" id="uc-trace" style="justify-self:start">Trace it on the platform map ↑</button>
        </div>
      </div>
    </div>
  </article>`;
  $("#uc-trace").addEventListener("click", () => { if (traceId !== u.id) setTrace(u.id); $("#platform").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
}

/* ---------- deployment ---------- */
const ICONS = {
  lock: `<svg viewBox="0 0 20 20"><path d="M6 9V6.5a4 4 0 0 1 8 0V9" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="9" width="12" height="8.5" rx="2" fill="currentColor"/></svg>`,
  db: `<svg viewBox="0 0 20 20"><ellipse cx="10" cy="5" rx="6" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  key: `<svg viewBox="0 0 20 20"><circle cx="7" cy="10" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10H18M15 10v3M17.5 10v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  check: `<svg viewBox="0 0 20 20"><path d="M10 2 3.5 5v5c0 4 2.8 6.8 6.5 8 3.7-1.2 6.5-4 6.5-8V5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m7 10 2 2 4-4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  arrow: `<svg viewBox="0 0 20 20"><path d="M3 10h11M10 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
};
function renderDeploy() {
  const c = CLOUDS[cloud];
  $("#map-table").innerHTML = `<tbody>
    <tr><th>Model runtime</th><td>${esc(c.compute)}<div class="xs muted">Encrypted containers, attested before keys are released</div></td></tr>
    <tr><th>Data layer</th><td>${esc(c.data)}<div class="xs muted">Input builders, output tables, Complete Data Layer</div></td></tr>
    <tr><th>Engines &amp; pipelines</th><td>Batch jobs on your data platform<div class="xs muted">Provisioned from your catalog, scheduled in the Control Center</div></td></tr>
    <tr><th>CX APIs &amp; MCP servers</th><td>Application tier in your tenant, behind your API gateway<div class="xs muted">${esc(c.identity)}</div></td></tr>
    <tr><th>Analytics Workbench</th><td>${esc(c.bi)}</td></tr>
    <tr><th>Internal agents</th><td>${esc(c.agentsInt)}</td></tr>
    <tr><th>Customer-facing agents</th><td>${esc(c.agentsExt)}<div class="xs muted">Evals and guardrails in your platform</div></td></tr>
    <tr><th>Boundary egress</th><td>${esc(c.network)}<div class="xs muted">Key attestation and operational counts only</div></td></tr>
    <tr><th>Environments</th><td>Dev, UAT and Prod</td></tr>
  </tbody>`;
  $("#sec-list").innerHTML = SECURITY.map(s => `<div class="sec-item"><div class="ic">${ICONS[s.ic]}</div><div><h4>${esc(s.h)}</h4><p>${esc(sub(s.p))}</p></div></div>`).join("");
}
function renderGantt() {
  const g = $("#gantt"); const lo = -2, hi = 14, span = hi - lo;
  const pos = (m) => (m - lo) / span * 100;
  g.innerHTML = `<div class="g-row" style="margin-bottom:4px"><h4>Reference implementation plan</h4><span class="xs muted">months from Phase 1 kickoff · final plan agreed in Define</span></div>` +
    GANTT.map(r => `<div class="g-row"><div><b style="font-weight:600">${esc(r.name)}</b><div class="xs muted">${esc(r.sub)}</div></div><div class="g-track"><div class="g-bar ${r.cls}" style="left:${pos(r.s)}%;width:${pos(r.e) - pos(r.s)}%">${esc(r.lbl)}</div></div></div>`).join("") +
    `<div class="g-scale"><div></div><div>${Array.from({ length: 9 }, (_, i) => `<span>M${lo + i * 2}</span>`).join("")}</div></div>
    <div class="g-row" style="margin-top:6px"><div></div><div class="xs muted">After go-live: managed services for release, security patching and model operations, including quarterly model performance reviews and annual tuning.</div></div>`;
}

/* ---------- init ---------- */
buildPlatform(); buildCloudChips("#cloud-chips"); buildCloudChips("#dep-chips"); buildTraceChips();
refreshNodeText(); selectNode(selNode);
buildModelTabs(); renderModel();
buildUCNav(); renderUC();
renderDeploy(); renderGantt();
drawHero();
setTrace("highbill");

let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawLinks, 80); });
$(".plat-scroll").addEventListener("scroll", () => {}, { passive: true });
const redraw = () => { drawHero(); renderModel(); drawLinks(); };
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLinks);
})();
