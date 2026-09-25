/* ---------- environment (cloud + data lake) ---------- */
let cloud = store.get("upro-cloud") || "azure";
if (!CLOUDS[cloud]) cloud = "azure";
let lake = store.get("upro-lake") || "databricks";
if (!LAKES[lake]) lake = "databricks";
const ENV = () => {
  const c = CLOUDS[cloud], l = lake === "native" ? c.native : LAKES[lake];
  return { ...c, ...l, lakeLabel: l.label, cloudLabel: c.label, tenant: `Your ${c.label} tenant + ${l.label}`,
    compute: c.compute + (l.computeAlt ? `, ${l.computeAlt}` : "") };
};
const sub = (s) => { const e = ENV(); return s.replace(/\{(\w+)\}/g, (_, k) => e[k] ?? ""); };
const DB_ICON = `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const logo = (k) => {
  if (!LOGOS[k]) return DB_ICON;
  const c = k === "aws" ? "#232F3E" : LOGOS[k].c; // AWS mark is dark on light backgrounds
  return `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="${LOGOS[k].d}"/></svg>`;
};

function buildEnvChips() {
  [["#cloud-chips", CLOUDS, "cloud"], ["#lake-chips", LAKES, "lake"]].forEach(([sel, src, kind]) => {
    const c = $(sel); c.innerHTML = "";
    for (const k in src) {
      const lbl = kind === "lake" && k === "native" ? "Cloud-native" : src[k].label;
      const b = el("button", { type: "button", class: "chip env", "data-kind": kind, "data-k": k, "aria-pressed": k === (kind === "cloud" ? cloud : lake) }, logo(k) + esc(lbl));
      b.addEventListener("click", () => setEnv(kind, k));
      c.append(b);
    }
  });
}
function setEnv(kind, k) {
  if (kind === "cloud") { cloud = k; store.set("upro-cloud", k); } else { lake = k; store.set("upro-lake", k); }
  document.querySelectorAll("[data-kind]").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === (b.dataset.kind === "cloud" ? cloud : lake)));
  renderStack(); renderLayer(); renderUC();
}

/* ---------- isometric platform stack ---------- */
const STACK = { W: 640, H: 620, cx: 196, a: 168, b: 44, t: 16, top: 160, gap: 116 };
const LAYER_COPY = {
  out: "Pre-built or custom apps, agents and automations, feeding the systems you already run.",
  engines: "Engines are services that translate ML model outputs into use case-ready insights. APIs and MCPs deliver them to every channel and agent.",
  models: "Patented models, encrypted, running in your cloud. Click one.",
  found: "Your systems of record, with all UtilityAI Pro data kept in your {lakeLabel}.",
};
const AI_TOOLS = [["claude", "Claude"], ["chatgpt", "ChatGPT"], ["copilot", "Copilot"], ["gemini", "Gemini"]];
const logoAI = (k) => k === "copilot"
  ? `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/><rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/><rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/></svg>`
  : `<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="${AI_LOGOS[k].c}" d="${AI_LOGOS[k].d}"/></svg>`;
let selBand = "models";
const bandIds = (id) => Object.keys(NODES).filter(k => NODES[k].band === id);
const MODEL_COLORS = ["--c-cool", "--c-heat", "--c-ev", "--c-solar", "--c-pool", "--c-wh", "--c-ao", "--c-cool"];
const LAKE_TINT = { databricks: ["#fff4f1", "#ffd9cf", "#ffc2b3"], snowflake: ["#eefaff", "#c9eefa", "#a7e1f4"], native: ["#f4f7fa", "#dbe4ec", "#c7d3de"] };
function bandStyle(id) {
  return ({
    out:     { top: ["#ffffff", "#f6f7f9"], L: "#eceff2", R: "#dfe3e8", stroke: "#b7bec7" },
    engines: { top: ["#141c26", "#0a0f16"], L: "#080c11", R: "#05080c", stroke: "#33404f" },
    models:  { top: ["#ffffff", "#f3f5f7"], L: "#eceff2", R: "#dfe3e8", stroke: "#b7bec7" },
    found:   { top: ["#ffffff", "#f6f7f9"], L: "#eceff2", R: "#dfe3e8", stroke: "#b7bec7" },
  })[id];
}

function renderStack() {
  const S = STACK, svg = $("#stack-svg"); svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${S.W} ${S.H}`);
  const defs = svgEl("defs", {}, svg);
  defs.innerHTML = `<linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#29abe2" stop-opacity=".05"/><stop offset="1" stop-color="#29abe2" stop-opacity="0"/></linearGradient>
    <linearGradient id="gFlow" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#29abe2"/><stop offset="1" stop-color="#29abe2"/></linearGradient>
    <filter id="glow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#29abe2" flood-opacity=".45"/></filter>`;
  BANDS.forEach(B => { const st = bandStyle(B.id); defs.insertAdjacentHTML("beforeend", `<linearGradient id="gT-${B.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${st.top[0]}"/><stop offset="1" stop-color="${st.top[1]}"/></linearGradient>`); });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const n = BANDS.length;
  const fy = S.top + (n - 1) * S.gap + 34, fa = S.a + 26, fb = S.b + 16;
  svgEl("polygon", { points: [P(S.cx, fy - fb), P(S.cx + fa, fy), P(S.cx, fy + fb), P(S.cx - fa, fy)].join(" "), fill: "url(#gFloor)", stroke: "#9aa4af", "stroke-width": 1, "stroke-dasharray": "4 4" }, svg);
  // data rising from the lake through every layer, and on up to the AI tools
  const flowG = svgEl("g", { "aria-hidden": "true" }, svg);
  const yTop = 70, yBot = S.top + (n - 1) * S.gap;
  const AIX = [70, 154, 238, 322], AIY = [40, 78, 40, 78];
  AIX.forEach((x, i) => svgEl("path", { d: `M${x},${AIY[i] + 12} L${x},${S.top - S.b + 20}`, stroke: cssv("--accent-line"), "stroke-width": 1.2, "stroke-dasharray": "3 4", fill: "none" }, flowG));
  [-96, 0, 96].forEach((dx, i) => {
    svgEl("line", { x1: S.cx + dx, x2: S.cx + dx, y1: S.top, y2: yBot, stroke: cssv("--accent-line"), "stroke-width": 1.2, "stroke-dasharray": "3 5" }, flowG);
    if (!reduce) for (let k = 0; k < 3; k++) {
      const c = svgEl("circle", { cx: S.cx + dx, cy: yBot, r: 3.4, fill: "url(#gFlow)" }, flowG);
      const beg = -(k * 1.1 + i * 0.4).toFixed(2);
      c.innerHTML = `<animate attributeName="cy" from="${yBot}" to="${S.top - S.b}" dur="3.4s" begin="${beg}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="3.4s" begin="${beg}s" repeatCount="indefinite"/>`;
    }
  });
  if (!reduce) AIX.forEach((x, i) => { const c = svgEl("circle", { cx: x, cy: S.top - S.b + 20, r: 2.6, fill: cssv("--accent") }, flowG); c.innerHTML = `<animate attributeName="cy" from="${S.top - S.b + 20}" to="${AIY[i] + 12}" dur="1.8s" begin="${-i * 0.45}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="${-i * 0.45}s" repeatCount="indefinite"/>`; });

  const labels = $("#slab-labels"); labels.innerHTML = "";
  labels.append(el("div", { class: "app-cluster" }, `<span class="lbl">Your applications</span><span class="app-pills">${APP_TARGETS.flatMap(([, vs]) => vs).map(([n, k]) => `<span class="ai-pill">${k ? logo(k) : ""}<span>${esc(n)}</span></span>`).join("")}</span>`));
  AI_TOOLS.forEach(([k, name], i) => labels.append(el("span", { class: "ai-row", style: `left:${AIX[i] / S.W * 100}%;top:${AIY[i] / S.H * 100}%` }, `<span class="ai-pill">${logoAI(k)}<span>${name}</span></span>`)));

  [...BANDS].reverse().forEach((B) => {
    const i = BANDS.indexOf(B), yc = S.top + i * S.gap, sel = B.id === selBand, st = bandStyle(B.id);
    const g = svgEl("g", { class: "slab" + (sel ? " sel" : ""), "data-band": B.id, filter: "" }, svg);
    const T = [S.cx, yc - S.b], R = [S.cx + S.a, yc], Bt = [S.cx, yc + S.b], L = [S.cx - S.a, yc];
    const stroke = sel ? cssv("--accent") : st.stroke;
    svgEl("polygon", { points: [P(...L), P(...Bt), P(Bt[0], Bt[1] + S.t), P(L[0], L[1] + S.t)].join(" "), fill: st.L, stroke, "stroke-width": 1 }, g);
    svgEl("polygon", { points: [P(...Bt), P(...R), P(R[0], R[1] + S.t), P(Bt[0], Bt[1] + S.t)].join(" "), fill: st.R, stroke, "stroke-width": 1 }, g);
    svgEl("polygon", { points: [P(...T), P(...R), P(...Bt), P(...L)].join(" "), fill: `url(#gT-${B.id})`, stroke, "stroke-width": sel ? 1.8 : 1 }, g);
    const map = (u, v) => [T[0] + u * (R[0] - T[0]) + v * (L[0] - T[0]), T[1] + u * (R[1] - T[1]) + v * (L[1] - T[1])];
    const quad = (u0, v0, u1, v1) => [map(u0, v0), map(u1, v0), map(u1, v1), map(u0, v1)].map(p => P(...p)).join(" ");
    const ids = bandIds(B.id);
    const rows = B.id === "found" ? [ids.filter(k => NODES[k].row === "src"), ids.filter(k => NODES[k].row === "lake")] : ids.length > 12 ? [ids.slice(0, 5), ids.slice(5, 10), ids.slice(10)] : ids.length > 6 ? [ids.slice(0, Math.ceil(ids.length / 2)), ids.slice(Math.ceil(ids.length / 2))] : [ids];
    const hook = (node, id) => { hoverable(node, () => `<b>${esc(NODES[id].name)}</b><div>${esc(sub(NODES[id].sub))}</div>`); node.addEventListener("click", (e) => { e.stopPropagation(); selBand = B.id; renderStack(); renderLayer(id); if (NODES[id].tab) openModel(NODES[id].tab); else if (NODES[id].band === "engines") openEngine(id); }); };
    const centers = [];
    rows.forEach((row, ri) => {
      const nr = rows.length, v0 = nr === 1 ? 0.34 : nr === 2 ? 0.14 + ri * 0.44 : 0.08 + ri * 0.3, vh = nr === 1 ? 0.32 : nr === 2 ? 0.3 : 0.22;
      row.forEach((id, ci) => {
        const cw = 0.86 / row.length, u0 = 0.07 + ci * cw, u1 = u0 + cw * 0.8, cu = (u0 + u1) / 2, cv = v0 + vh / 2;
        if (B.id === "out") { // app windows
          hook(svgEl("polygon", { points: quad(u0, v0, u1, v0 + vh), fill: "#ffffff", stroke: sel ? cssv("--accent") : "#c3cad2", "stroke-width": 1 }, g), id);
          svgEl("polygon", { points: quad(u0, v0, u1, v0 + vh * 0.22), fill: sel ? cssv("--accent") : "#dde2e7", "pointer-events": "none" }, g);
          svgEl("polygon", { points: quad(u0 + (u1 - u0) * 0.15, v0 + vh * 0.45, u1 - (u1 - u0) * 0.3, v0 + vh * 0.58), fill: "#eceff2", "pointer-events": "none" }, g);
        } else if (B.id === "engines") { // chips on a circuit board
          if (ci < row.length - 1) svgEl("polygon", { points: quad(u1, cv - 0.012, u0 + cw, cv + 0.012), fill: "#3b4a5a", opacity: 0.9, "pointer-events": "none" }, g);
          hook(svgEl("polygon", { points: quad(u0, v0, u1, v0 + vh), fill: "#0f1720", stroke: sel ? "#29abe2" : "#4a5a6b", "stroke-width": 1 }, g), id);
          svgEl("polygon", { points: quad(u0 + (u1 - u0) * 0.25, v0 + vh * 0.25, u1 - (u1 - u0) * 0.25, v0 + vh * 0.75), fill: NODES[id].group === "APIs, MCPs & apps" ? "#e6ebf0" : "#29abe2", opacity: sel ? 0.95 : 0.6, "pointer-events": "none" }, g);
        } else if (B.id === "models") { // neural network nodes
          centers.push([map(cu, cv), id, ci + ri * 4]);
        } else { // foundation: source pads and lake cylinders
          const [x, y] = map(cu, cv);
          if (ri === 0) {
            hook(svgEl("polygon", { points: quad(u0, v0, u1, v0 + vh), fill: "#ffffff", stroke: sel ? cssv("--accent") : "#c3cad2", "stroke-width": 1 }, g), id);
            svgEl("circle", { cx: x, cy: y, r: 2.4, fill: "#6b7480", "pointer-events": "none" }, g);
          } else {
            const w = 15, h = 13, cyl = svgEl("g", {}, g);
            svgEl("path", { d: `M${x - w},${y - h / 2} v${h} a${w},${w * 0.35} 0 0 0 ${w * 2},0 v${-h}`, fill: "#ffffff", stroke: sel ? cssv("--accent") : "#6b7480", "stroke-width": 1 }, cyl);
            svgEl("ellipse", { cx: x, cy: y - h / 2, rx: w, ry: w * 0.35, fill: "#f2f4f6", stroke: sel ? cssv("--accent") : "#6b7480", "stroke-width": 1 }, cyl);
            hook(cyl, id);
          }
        }
      });
    });
    if (B.id === "models") {
      centers.forEach(([p1], a1) => centers.forEach(([p2], a2) => { if (a2 > a1 && Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) < 120) svgEl("line", { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: sel ? "#9fd3ec" : "#c3cad2", "stroke-width": 1, opacity: 1, "pointer-events": "none" }, g); }));
      centers.forEach(([p, id, k]) => { const c = svgEl("circle", { cx: p[0], cy: p[1], r: 6, fill: sel ? cssv("--accent") : "#0a0f16", stroke: "#fff", "stroke-width": 2 }, g); hook(c, id); });
    }
    g.addEventListener("click", () => { selBand = B.id; renderStack(); renderLayer(); });
    const lx = (S.cx + S.a + 16) / S.W * 100, ly = (yc + S.t / 2) / S.H * 100;
    const extra = B.id === "found" ? `${logo(lake === "native" ? "" : lake)}` : "";
    const lab = el("button", { type: "button", class: "slab-label", style: `left:${lx}%;top:${ly}%`, "aria-pressed": sel }, `<b>${esc(B.name)}</b><span>${extra}${esc(sub(B.tag))}</span>`);
    lab.addEventListener("click", () => { selBand = B.id; renderStack(); renderLayer(); });
    labels.append(lab);
    svgEl("line", { x1: R[0] + 2, y1: R[1] + S.t / 2, x2: R[0] + 14, y2: R[1] + S.t / 2, stroke: cssv("--line-2"), "stroke-width": 1 }, svg);
  });
  const e = ENV(), tc = $("#tenant-chip");
  tc.innerHTML = `${logo(cloud)}${logo(lake === "native" ? "" : lake)}<span>${esc(e.tenant)}</span>`;
}

const APP_TARGETS = [
  ["Customer & billing", [["Oracle CC&B", "oracle"], ["SAP", "sap"], ["Salesforce", "salesforce"]]],
  ["Contact center", [["Genesys"], ["NICE"]]],
  ["Grid operations", [["ADMS"], ["DERMS"]]],
  ["Assets & work", [["IBM Maximo", "ibm"]]],
];
const vendorRows = (rows) => `<div class="vendors">${rows.map(([g, vs]) => `<div class="vendor-row"><span class="lbl">${g}</span>${vs.map(([n, k]) => `<span class="vendor">${k ? logo(k) : ""}${esc(n)}</span>`).join("")}</div>`).join("")}</div>`;
const SRC_VENDORS = [
  ["AMI & MDM", [["Itron"], ["Landis+Gyr"], ["Sensus"], ["Aclara"], ["Siemens EnergyIP", "siemens"]]],
  ["CIS & billing", [["SAP", "sap"], ["Oracle Utilities", "oracle"], ["Salesforce", "salesforce"]]],
  ["GIS", [["Esri ArcGIS", "esri"]]],
];
function renderLayer(focusId) {
  const B = BANDS.find(b => b.id === selBand), ids = bandIds(B.id), e = ENV();
  const card = (id) => {
    const nd = NODES[id], click = !!nd.tab || nd.band === "engines", tag = click ? "button" : "div";
    return `<${tag}${click ? ' type="button"' : ""} class="comp${click ? " clickable" : ""}" data-id="${id}"${id === focusId ? ' style="border-color:var(--accent)"' : ""}>
      <span class="ci">${icon(pickIcon(nd.name + " " + nd.sub))}</span><b>${esc(nd.name)}</b>${click ? '<span class="go">Explore →</span>' : ""}</${tag}>`;
  };
  let grid;
  if (B.id === "found") {
    grid = `<div class="lbl group-h">Your systems of record</div>${ids.filter(k => NODES[k].row === "src").map(card).join("")}
      <div class="lbl group-h">Connects to the systems you already run</div>
      ${vendorRows(SRC_VENDORS)}`;
  } else if (B.id === "engines") {
    grid = ["Grid & analytics engines", "Customer experience engines", "APIs, MCPs & apps"].map(gn => `<div class="lbl group-h">${gn}</div>` + ids.filter(k => NODES[k].group === gn).map(card).join("")).join("");
  } else if (B.id === "out") {
    grid = ids.map(card).join("") + `<div class="lbl group-h">Feeds the applications you already run</div>${vendorRows(APP_TARGETS)}`;
  } else grid = ids.map(card).join("");
  const stats = B.id === "models" ? `<div class="layer-stats">${[["38 Million", "meters"], ["45+", "utilities"], ["15 years", "of labeled ground truth"]].map(([v, l]) => `<span><strong>${v}</strong><em>${l}</em></span>`).join("")}</div>` : "";
  $("#layer-panel").innerHTML = `<div class="layer-top"><h3>${esc(B.name)}</h3><p>${esc(sub(LAYER_COPY[B.id]))}</p></div>${stats}<div class="comp-grid">${grid}</div>`;
  $("#layer-panel").querySelectorAll(".comp[data-id]").forEach(c => {
    const nd = NODES[c.dataset.id];
    hoverable(c, () => `<b>${esc(nd.name)}</b><div>${esc(sub(nd.desc))}</div>`);
    if (nd.tab) c.addEventListener("click", () => openModel(nd.tab));
    else if (nd.band === "engines") c.addEventListener("click", () => openEngine(c.dataset.id));
  });
}
function openModel(tab) {
  const d = $("#model-dlg");
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
  setModelTab(tab);
}
