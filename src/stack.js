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
  renderStack(); renderLayer(); renderDeploy(); renderUC();
}

/* ---------- isometric platform stack ---------- */
const STACK = { W: 640, H: 604, cx: 196, a: 168, b: 40, t: 14, top: 100, gap: 100 };
const LAYER_COPY = {
  out: "Your apps, agents and automations. Built by your team or SI from Bidgely reference implementations and run on your own platforms.",
  access: "The interfaces every channel uses: ratepayer-scoped REST APIs, MCP servers any agent can call, the Analytics Workbench and the Control Center.",
  engines: "Calculation services that turn raw model outputs into use-case-ready answers for grid planning and customer experience.",
  models: "Bidgely's patented models, delivered as encrypted containers on confidential compute. Select a model to see what it detects.",
  found: "What you already run. UtilityAI Pro reads your systems of record and keeps all of its data in your {lakeLabel}.",
};
let selBand = "models";
const bandIds = (id) => Object.keys(NODES).filter(k => NODES[k].band === id);
const TILE_COLORS = { models: ["--c-cool", "--c-heat", "--c-ev", "--c-solar", "--c-pool", "--c-wh", "--c-ao", "--c-cool"] };

function renderStack() {
  const S = STACK, svg = $("#stack-svg"); svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${S.W} ${S.H}`);
  const defs = svgEl("defs", {}, svg);
  defs.innerHTML = `
    <linearGradient id="gTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9f6fd"/></linearGradient>
    <linearGradient id="gTopSel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2fbff"/><stop offset="1" stop-color="#c9ebfa"/></linearGradient>
    <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#29abe2" stop-opacity=".10"/><stop offset="1" stop-color="#29abe2" stop-opacity=".02"/></linearGradient>`;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const P = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const n = BANDS.length;
  // cloud floor: the tenant boundary everything stands on
  const fy = S.top + (n - 1) * S.gap + 30, fa = S.a + 26, fb = S.b + 16;
  svgEl("polygon", { points: [P(S.cx, fy - fb), P(S.cx + fa, fy), P(S.cx, fy + fb), P(S.cx - fa, fy)].join(" "), fill: "url(#gFloor)", stroke: cssv("--accent"), "stroke-width": 1.5, "stroke-dasharray": "6 5" }, svg);
  // pillars and data rising from the lake to the top layer
  const flowG = svgEl("g", { "aria-hidden": "true" }, svg);
  const yTop = S.top + S.b, yBot = S.top + (n - 1) * S.gap;
  [-96, 0, 96].forEach((dx, i) => {
    svgEl("line", { x1: S.cx + dx, x2: S.cx + dx, y1: yTop, y2: yBot, stroke: cssv("--accent-line"), "stroke-width": 1.2, "stroke-dasharray": "3 5" }, flowG);
    if (!reduce) for (let k = 0; k < 3; k++) {
      const c = svgEl("circle", { cx: S.cx + dx, cy: yBot, r: 3.2, fill: cssv("--accent") }, flowG);
      c.innerHTML = `<animate attributeName="cy" from="${yBot}" to="${yTop}" dur="3.2s" begin="${-(k * 1.07 + i * 0.4).toFixed(2)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="3.2s" begin="${-(k * 1.07 + i * 0.4).toFixed(2)}s" repeatCount="indefinite"/>`;
    }
  });
  // slabs, bottom first so upper slabs paint over the pillars
  const labels = $("#slab-labels"); labels.innerHTML = "";
  [...BANDS].reverse().forEach((B) => {
    const i = BANDS.indexOf(B), yc = S.top + i * S.gap, sel = B.id === selBand;
    const g = svgEl("g", { class: "slab" + (sel ? " sel" : ""), "data-band": B.id, tabindex: "-1" }, svg);
    const T = [S.cx, yc - S.b], R = [S.cx + S.a, yc], Bt = [S.cx, yc + S.b], L = [S.cx - S.a, yc];
    const stroke = sel ? cssv("--accent") : "#a9d4ea";
    svgEl("polygon", { points: [P(...L), P(...Bt), P(Bt[0], Bt[1] + S.t), P(L[0], L[1] + S.t)].join(" "), fill: sel ? "#7fcbee" : "#d3e9f5", stroke, "stroke-width": 1 }, g);
    svgEl("polygon", { points: [P(...Bt), P(...R), P(R[0], R[1] + S.t), P(Bt[0], Bt[1] + S.t)].join(" "), fill: sel ? "#4fb6e5" : "#b9dbee", stroke, "stroke-width": 1 }, g);
    svgEl("polygon", { points: [P(...T), P(...R), P(...Bt), P(...L)].join(" "), fill: sel ? "url(#gTopSel)" : "url(#gTop)", stroke, "stroke-width": sel ? 1.6 : 1 }, g);
    // component tiles laid out on the top face: map (u,v) in the unit square onto the diamond
    const ids = bandIds(B.id);
    const rows = B.id === "found" ? [ids.filter(k => NODES[k].row === "src"), ids.filter(k => NODES[k].row === "lake")] : ids.length > 6 ? [ids.slice(0, Math.ceil(ids.length / 2)), ids.slice(Math.ceil(ids.length / 2))] : [ids];
    const map = (u, v) => [T[0] + u * (R[0] - T[0]) + v * (L[0] - T[0]), T[1] + u * (R[1] - T[1]) + v * (L[1] - T[1])];
    rows.forEach((row, ri) => {
      const v0 = rows.length === 1 ? 0.36 : 0.16 + ri * 0.42, vh = rows.length === 1 ? 0.3 : 0.28;
      row.forEach((id, ci) => {
        const cw = 0.84 / row.length, u0 = 0.08 + ci * cw, u1 = u0 + cw * 0.78;
        const pts = [map(u0, v0), map(u1, v0), map(u1, v0 + vh), map(u0, v0 + vh)].map(p => P(...p)).join(" ");
        let fill = sel ? "#ffffff" : "#f4fbfe", st = sel ? cssv("--accent") : "#b7dcee";
        if (B.id === "models") { fill = cssv(TILE_COLORS.models[ci + ri * 4] || "--c-cool"); st = "#ffffff"; }
        if (B.id === "found" && ri === 1) { fill = sel ? "#dff3fc" : "#eaf7fd"; st = cssv("--accent"); }
        const tile = svgEl("polygon", { points: pts, fill, stroke: st, "stroke-width": 1, opacity: B.id === "models" && !sel ? 0.75 : 1 }, g);
        hoverable(tile, () => `<b>${esc(NODES[id].name)}</b><div>${esc(sub(NODES[id].sub))}</div>`);
        tile.addEventListener("click", (e) => { e.stopPropagation(); selBand = B.id; renderStack(); renderLayer(id); if (NODES[id].tab) openModel(NODES[id].tab); });
      });
    });
    g.addEventListener("click", () => { selBand = B.id; renderStack(); renderLayer(); });
    // HTML label at the slab's right corner so text stays at the page's text sizes
    const lx = (S.cx + S.a + 16) / S.W * 100, ly = (yc + S.t / 2) / S.H * 100;
    const extra = B.id === "found" ? `${logo(lake === "native" ? "" : lake)}` : "";
    const lab = el("button", { type: "button", class: "slab-label", style: `left:${lx}%;top:${ly}%`, "aria-pressed": sel },
      `<b>${esc(B.name)}</b><span style="display:flex;align-items:center;gap:5px">${extra}${esc(sub(B.tag))}</span>`);
    lab.addEventListener("click", () => { selBand = B.id; renderStack(); renderLayer(); });
    labels.append(lab);
    svgEl("line", { x1: R[0] + 2, y1: R[1] + S.t / 2, x2: R[0] + 14, y2: R[1] + S.t / 2, stroke: cssv("--line-2"), "stroke-width": 1 }, svg);
  });
  const e = ENV();
  $("#tenant-chip").innerHTML = `${logo(cloud)}${logo(lake === "native" ? "" : lake)}<span>${esc(e.tenant)}</span>`;
  $("#egress-net").textContent = e.network;
}

function renderLayer(focusId) {
  const B = BANDS.find(b => b.id === selBand), ids = bandIds(B.id), e = ENV();
  const card = (id) => {
    const nd = NODES[id], click = !!nd.tab;
    return `<${click ? "button type=\"button\"" : "div"} class="comp${click ? " clickable" : ""}${id === focusId ? " clickable" : ""}" data-id="${id}"${id === focusId ? ' style="border-color:var(--accent)"' : ""}>
      <b>${esc(nd.name)}</b><span class="sub">${esc(sub(nd.sub))}</span><span>${esc(sub(nd.desc))}</span>${click ? '<span class="go">See what it detects →</span>' : ""}</${click ? "button" : "div"}>`;
  };
  let grid;
  if (B.id === "found") {
    grid = `<div class="lbl group-h">Your systems of record</div>${ids.filter(k => NODES[k].row === "src").map(card).join("")}
      <div class="lbl group-h" style="display:flex;align-items:center;gap:6px">${logo(lake === "native" ? "" : lake)}UtilityAI Pro data layer, inside your ${esc(e.lakeLabel)}</div>${ids.filter(k => NODES[k].row === "lake").map(card).join("")}`;
  } else if (B.id === "engines") {
    grid = ["Grid & analytics", "Customer experience"].map(gn => `<div class="lbl group-h">${gn}</div>` + ids.filter(k => NODES[k].group === gn).map(card).join("")).join("");
  } else grid = ids.map(card).join("");
  const idx = BANDS.length - BANDS.indexOf(B);
  $("#layer-panel").innerHTML = `<div class="layer-top"><span class="eyebrow">Layer ${idx} of ${BANDS.length}</span><h3>${esc(B.name)}</h3><p>${esc(sub(LAYER_COPY[B.id]))}</p></div><div class="comp-grid">${grid}</div>`;
  $("#layer-panel").querySelectorAll(".comp[data-id]").forEach(c => { const nd = NODES[c.dataset.id]; if (nd.tab) c.addEventListener("click", () => openModel(nd.tab)); });
}
function openModel(tab) {
  setModelTab(tab);
  $("#models").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
