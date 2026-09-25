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

/* ---------- SVG chart helpers ---------- */
// Charts are drawn at their container's pixel width so SVG text renders at exactly --fs-3.
const VW = () => { const v = document.querySelector("#model-panels .viz"); return v ? Math.max(280, Math.round(v.clientWidth - 36)) : 720; };
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
