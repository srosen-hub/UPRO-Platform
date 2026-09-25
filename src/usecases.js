/* ---------- use cases: card grid, detail, visuals, MCP connect + assistant chat ---------- */
const ASSISTANTS = {
  claude:  { name: "Claude" },
  chatgpt: { name: "ChatGPT" },
  copilot: { name: "Microsoft Copilot" },
  gemini:  { name: "Gemini" },
  dev:     { name: "Your agent" },
};
let ucId = null, mcpTab = "claude", chatTimer = null;
const UC_ORDER = ["highbill", "forecast", "flex", "nws", "trend", "rates", "assistant", "alert", "web", "targeting", "analyst", "revenue"];
const UC_META = {
  highbill: ["bill", "CSR desktop"], forecast: ["chart", "Grid chart"], flex: ["battery", "Agent automation"], nws: ["bolt", "Scenario chart"],
  trend: ["bot", "Agent automation"], rates: ["tag", "Customer app"], assistant: ["sun", "Customer app"], alert: ["mail", "Proactive email"],
  web: ["phone", "Customer app"], targeting: ["target", "Agent automation"], analyst: ["search", "Analyst workspace"], revenue: ["shield", "Agent automation"],
};
const UCW = (host) => Math.max(280, Math.round(host.clientWidth || 600));
const CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const money = (v) => "$" + Math.round(v).toLocaleString();
const firstSentence = (t) => (t.match(/^[^.]*\./) || [t])[0];

const UC_GROUPS = ["Transform Customer Service and Experience", "Transform Grid Planning", "Transform Customer and DER Programs"];
function buildUCTabs() {
  const c = $("#uc-grid"); c.innerHTML = "";
  UC_GROUPS.forEach(g => {
    const grid = el("div", { class: "uc-grid" });
    UC_ORDER.map(id => USE_CASES.find(x => x.id === id)).filter(u => u.group === g).forEach(u => {
      const id = u.id, [ic, kind] = UC_META[id];
      const b = el("button", { type: "button", class: "uc-c", "data-id": id, "aria-pressed": "false" },
        `<span class="ico">${icon(ic)}</span><b>${esc(u.title)}</b><span class="meta"><span class="kind">${esc(kind)}</span></span>`);
      b.addEventListener("click", () => openUC(id));
      grid.append(b);
    });
    const sec = el("div", { class: "uc-group" }, `<h3>${esc(g)}</h3>`);
    sec.append(grid); c.append(sec);
  });
}
function openUC(id) {
  ucId = id; renderUC();
  $("#uc-card").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function renderUC() {
  document.querySelectorAll(".uc-c").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === ucId));
  const host = $("#uc-card");
  if (!ucId) { host.innerHTML = ""; return; }
  const u = USE_CASES.find(x => x.id === ucId), m = UC_MCP[ucId], S = MCP_SERVERS[m.server];
  const used = new Set(m.turns.filter(t => t[0] === "tool").map(t => t[1]));
  const ing = (cls, title, dot, items) => `<div class="ing ${cls}"><h6><i style="background:${dot}"></i>${title}</h6><ul>${items.map(i => `<li>${icon(pickIcon(i))}<span>${esc(sub(i))}</span></li>`).join("")}</ul></div>`;
  const url = `https://upro.your-utility.com/mcp/${S.path}`;
  host.innerHTML = `
    <div class="uc-hero">
      <div class="panel">
        <div class="panel-top"><span></span><button type="button" class="btn sm" id="uc-close">Close</button></div>
        <h3>${esc(u.title)}</h3>
        <p>${esc(firstSentence(u.need))}</p>
        <ul class="value-list">${u.value.map(x => `<li>${CHECK}<span>${esc(x)}</span></li>`).join("")}</ul>
        ${u.proof ? `<p class="proof">${esc(u.proof)}</p>` : ""}
      </div>
      <div class="panel ucv" id="ucv"></div>
    </div>

    <div class="mcp">
      <div class="mcp-setup">
        <div class="ai-tabs" role="group" aria-label="AI tool">${Object.keys(ASSISTANTS).map(k => `<button type="button" class="ai-tab" data-t="${k}" aria-pressed="${mcpTab === k}">${k === "dev" ? icon("code") : logoAI(k)}${k === "dev" ? "Developers" : k === "copilot" ? "Copilot" : ASSISTANTS[k].name}</button>`).join("")}</div>
        <div class="howto" id="howto"></div>
        <div class="tool-chips">${S.tools.map(t => `<code class="${used.has(t) ? "used" : ""}">${t}</code>`).join("")}</div>
      </div>
      <div class="chat">
        <div class="chat-top"><span class="who"><span id="chat-logo"></span><span id="chat-name">Claude</span> · ${esc(S.id)}</span><button type="button" class="btn sm" id="chat-replay">Replay</button></div>
        <div class="chat-body" id="chat-body" aria-live="polite"></div>
      </div>
    </div>

    <div class="panel">
      <h4>The recipe</h4>
      <div class="recipe">
        ${ing("utility", "Your data", "var(--accent)", u.utility)}
        ${ing("", "Models", "var(--c-ev)", u.models)}
        ${ing("", "Engines", "var(--c-heat)", u.engines)}
        ${ing("", "APIs · MCPs · Apps", "var(--c-cool)", u.access)}
      </div>
      <details class="more"><summary>How it runs, step by step</summary>
        <ol class="steps">${u.steps.map(([t, who]) => `<li><span>${esc(sub(t))}<span class="who">${esc(who)}</span></span></li>`).join("")}</ol>
      </details>
    </div>`;

  const setup = () => {
    const h = $("#howto"), e = ENV();
    const steps = {
      claude: `<ol><li><b>Settings → Connectors → Add custom connector</b></li><li>Paste the URL, sign in with SSO</li></ol>${cmd(url)}`,
      chatgpt: `<ol><li><b>Settings → Apps &amp; Connectors</b>, developer mode on</li><li>Create a connector with the URL</li></ol>${cmd(url)}`,
      copilot: `<ol><li>Copilot Studio: <b>Tools → Add a tool → MCP</b></li><li>Paste the URL, sign in with Entra ID</li></ol>${cmd(url)}`,
      gemini: `<ol><li>Gemini Enterprise / Agent Builder: <b>add an MCP tool</b></li><li>Paste the URL, sign in with SSO</li></ol>${cmd(url)}`,
      dev: `<p>Works with ${esc(e.agentsInt)} or any MCP client.</p>${cmd(`claude mcp add --transport http ${S.id} ${url}`)}`,
    };
    h.innerHTML = steps[mcpTab];
    h.querySelectorAll(".cmd button").forEach(b => b.addEventListener("click", () => copyText(b.previousElementSibling.textContent, b)));
    document.querySelectorAll(".ai-tab").forEach(b => b.setAttribute("aria-pressed", b.dataset.t === mcpTab));
    $("#chat-name").textContent = ASSISTANTS[mcpTab].name;
    $("#chat-logo").innerHTML = mcpTab === "dev" ? icon("bot") : logoAI(mcpTab);
  };
  document.querySelectorAll(".ai-tab").forEach(b => b.addEventListener("click", () => { mcpTab = b.dataset.t; setup(); }));
  setup();
  $("#chat-replay").addEventListener("click", () => playChat(true));
  $("#uc-close").addEventListener("click", () => { ucId = null; renderUC(); $("#usecases").scrollIntoView({ block: "start" }); });
  playChat(false);
  drawUCViz();
}
const cmd = (t) => `<div class="cmd"><code>${esc(t)}</code><button type="button">Copy</button></div>`;
function copyText(t, btn) {
  const done = () => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy", 1400); };
  try { navigator.clipboard.writeText(t).then(done, () => selectCode(btn)); } catch (e) { selectCode(btn); }
}
function selectCode(btn) { const r = document.createRange(); r.selectNodeContents(btn.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Press ⌘C"; }

function turnHtml(t, S) {
  if (t[0] === "user") return `<div class="msg user">${esc(t[1])}</div>`;
  if (t[0] === "assistant") return `<div class="msg assistant">${esc(t[1])}</div>`;
  const pretty = (j) => { try { return JSON.stringify(JSON.parse(j), null, 1).replace(/\n\s*/g, " "); } catch (e) { return j; } };
  return `<details class="msg tool"><summary><span class="dot"></span>Used <code>${esc(t[1])}</code><span class="srvname">${esc(S.id)}</span></summary><pre>Request  ${esc(pretty(t[2]))}\nResponse ${esc(pretty(t[3]))}</pre></details>`;
}
function playChat(animate) {
  clearTimeout(chatTimer);
  const m = UC_MCP[ucId], S = MCP_SERVERS[m.server], body = $("#chat-body");
  if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { body.innerHTML = m.turns.map(t => turnHtml(t, S)).join(""); return; }
  body.innerHTML = ""; let i = 0;
  const step = () => {
    const typing = body.querySelector(".typing"); if (typing) typing.remove();
    if (i >= m.turns.length) return;
    body.insertAdjacentHTML("beforeend", turnHtml(m.turns[i], S)); i++;
    if (i < m.turns.length) { body.insertAdjacentHTML("beforeend", `<span class="typing" aria-hidden="true"><i></i><i></i><i></i></span>`); chatTimer = setTimeout(step, m.turns[i][0] === "tool" ? 900 : 1300); }
  };
  step();
}

/* ---------- visuals ---------- */
let ucvState = {}, autoTimer = null;
function drawUCViz() { const host = $("#ucv"); if (!host) return; clearTimeout(autoTimer); host.innerHTML = ""; (UCV[ucId] || (() => {}))(host); }
function ucHead(host, title, controls = "") { host.append(el("div", { class: "ucv-h" }, `<h4>${esc(title)}</h4>${controls}`)); }
function segCtl(key, opts, def) {
  if (ucvState[key] == null) ucvState[key] = def;
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-seg="${key}" data-v="${v}" aria-pressed="${String(ucvState[key]) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
}
function wireSeg(host) { host.querySelectorAll("[data-seg]").forEach(b => b.addEventListener("click", () => { const v = b.dataset.v; ucvState[b.dataset.seg] = isNaN(+v) ? v : +v; drawUCViz(); })); }
function legendHtml(items) { return `<div class="legend">${items.map(([c, n]) => `<span><span class="sw" style="background:${c}"></span>${esc(n)}</span>`).join("")}</div>`; }

// An agent automation: trigger + steps across systems, a run log, and what it produced.
function automation(host, cfg) {
  host.insertAdjacentHTML("beforeend", `<div class="auto">
    <div class="auto-head"><span class="auto-name"><span class="bot">${icon("bot")}</span><span>${esc(cfg.name)}<small>${esc(cfg.trigger)}</small></span></span><button type="button" class="btn sm dark" data-run>Run agent</button></div>
    <div class="flow">${cfg.steps.map(s => `<div class="node-s"><span class="top">${icon(s[0])}${esc(s[1])}</span><span class="sys">${esc(s[2])}</span></div>`).join("")}</div>
    <div class="runlog" aria-live="polite"></div>
    <div class="out-card">${cfg.output}</div></div>`);
  const nodes = [...host.querySelectorAll(".node-s")], log = host.querySelector(".runlog");
  const fill = (k) => { log.innerHTML = cfg.log.slice(0, k).map(([t, m], i) => `<div><span class="t">${t}</span>${esc(m)}${i === cfg.log.length - 1 ? ' <span class="ok">done</span>' : ""}</div>`).join(""); };
  const finish = () => { nodes.forEach(n => { n.classList.remove("run"); n.classList.add("done"); }); fill(cfg.log.length); };
  finish();
  host.querySelector("[data-run]").addEventListener("click", () => {
    clearTimeout(autoTimer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    nodes.forEach(n => n.classList.remove("run", "done")); fill(0); let i = 0;
    const tick = () => { nodes.forEach((n, j) => { n.classList.toggle("run", j === i); n.classList.toggle("done", j < i); }); fill(Math.round((i + 1) / nodes.length * cfg.log.length)); i++; if (i < nodes.length) autoTimer = setTimeout(tick, 900); else autoTimer = setTimeout(finish, 900); };
    tick();
  });
}
const phone = (inner) => `<div class="phone"><div class="phone-body">${inner}</div></div>`;
const win = (title, inner, cls = "") => `<div class="mock ${cls}"><div class="mock-bar"><i></i><i></i><i></i><span>${esc(title)}</span></div><div class="mock-body">${inner}</div></div>`;
const drv = (n, v, max, c, sign = "+") => `<div class="drv"><span>${esc(n)}</span><span class="track"><i style="width:${Math.abs(v) / max * 100}%;background:var(${c})"></i></span><b style="text-align:right">${v < 0 ? "−" : sign}${money(Math.abs(v))}</b></div>`;

const UCV = {
  forecast(host) {
    ucHead(host, "Network 12 design day, by end use", segCtl("fy", [[2026, "2026"], [2030, "2030 forecast"]], 2026)); wireSeg(host);
    const yr = ucvState.fy, w = UCW(host), h = 250, ml = 40, mr = 12, mt = 12, mb = 24;
    const f = yr === 2030 ? 1 : 0;
    const base = (x) => 16 + 4 * Math.sin((x - 9) / 24 * 2 * Math.PI) + 3 * Math.exp(-((x - 19) ** 2) / 8);
    const cool = (x) => (9.5 + 2.1 * f) * Math.exp(-((x - 16.5) ** 2) / 10);
    const ev = (x) => (1.2 + 3.4 * f) * (Math.exp(-((x - 19) ** 2) / 5) + 0.5 * Math.exp(-((x - 23) ** 2) / 4));
    const hp = (x) => (0.6 + 0.6 * f) * Math.exp(-((x - 18) ** 2) / 20);
    const sol = (x) => -(1.2 + 0.4 * f) * Math.max(0, Math.sin(Math.PI * (x - 6.5) / 13));
    const S = [["Base load", "--c-other", base], ["Heat pumps", "--c-heat", hp], ["Cooling", "--c-cool", cool], ["EV charging", "--c-ev", ev]];
    let pk = 0, pkh = 0; for (let x = 0; x < 24; x++) { const t = S.reduce((a, s) => a + s[2](x), 0) + sol(x); if (t > pk) { pk = t; pkh = x; } }
    const target = yr === 2030 ? 47.9 : 41.2, k = target / pk;
    const top = 55, x = (v) => ml + v / 23 * (w - ml - mr), y = (v) => mt + (top - v) / (top + 4) * (h - mt - mb);
    const s = mkSvg(w, h, "Stacked hourly load by end use"); yAxis(s, ml, w - mr, y, [0, 10, 20, 30, 40, 50]);
    text(s, 2, mt, "MW");
    const acc = new Array(24).fill(0);
    S.forEach(([n, c, fn]) => {
      const lo = acc.slice(), hi = lo.map((a, i) => a + fn(i) * k);
      const d = hi.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("") + lo.slice().reverse().map((v, i) => `L${x(23 - i)},${y(v)}`).join("") + "Z";
      svgEl("path", { d, fill: cssv(c), opacity: 0.9, stroke: cssv("--surface"), "stroke-width": 1 }, s);
      hi.forEach((v, i) => acc[i] = v);
    });
    const sd = Array.from({ length: 24 }, (_, i) => sol(i) * k);
    svgEl("path", { d: sd.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("") + `L${x(23)},${y(0)}L${x(0)},${y(0)}Z`, fill: cssv("--c-solar"), opacity: 0.85 }, s);
    svgEl("line", { x1: ml, x2: w - mr, y1: y(46), y2: y(46), stroke: cssv("--crit"), "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
    text(s, w - mr, y(46) - 6, "Design criteria 46 MW", { "text-anchor": "end", class: "t-ink" });
    svgEl("circle", { cx: x(pkh), cy: y(target), r: 5, fill: cssv("--navy"), stroke: "#fff", "stroke-width": 2 }, s);
    text(s, x(pkh) - 8, y(target) - 10, `${target} MW at ${pkh}:00`, { "text-anchor": "end", class: "t-ink" });
    [0, 6, 12, 18, 23].forEach(t => text(s, x(t), h - 6, `${t}h`, { "text-anchor": "middle" }));
    const hit = svgEl("rect", { x: ml, y: mt, width: w - ml - mr, height: h - mt - mb, fill: "transparent" }, s);
    hit.addEventListener("mousemove", (e) => { const rc = s.getBoundingClientRect(); const i = clamp(Math.round(((e.clientX - rc.left) / rc.width * w - ml) / (w - ml - mr) * 23), 0, 23); showTip(`<b>${i}:00 · ${yr}</b>` + S.map(([n, c, fn]) => `<div class="r"><span><i style="background:var(${c})"></i>${n}</span><span>${fmt(fn(i) * k, 1)} MW</span></div>`).reverse().join("") + `<div class="r"><span><i style="background:var(--c-solar)"></i>Solar</span><span>${fmt(sol(i) * k, 1)} MW</span></div>`, e.clientX, e.clientY); });
    hit.addEventListener("mouseleave", hideTip);
    host.append(s); host.insertAdjacentHTML("beforeend", legendHtml([...S.map(([n, c]) => [`var(${c})`, n]), ["var(--c-solar)", "Solar"]]));
  },

  nws(host) {
    ucHead(host, "Network 7 peak vs. rating", segCtl("nwp", [[0, "Baseline"], [1, "With portfolio"]], 1)); wireSeg(host);
    const on = ucvState.nwp === 1, yrs = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];
    const base = yrs.map((_, i) => 27.4 + i * 0.95 + (i > 3 ? 0.15 * (i - 3) : 0)), port = base.map((v, i) => v - Math.min(2.6, i * 0.55));
    const rating = 30.6, w = UCW(host), h = 240, ml = 40, mr = 16, mt = 14, mb = 26, lo = 24, hi = 37;
    const x = (i) => ml + i / (yrs.length - 1) * (w - ml - mr), y = (v) => mt + (hi - v) / (hi - lo) * (h - mt - mb);
    const s = mkSvg(w, h, "Peak load forecast versus rating");
    yAxis(s, ml, w - mr, y, [24, 28, 32, 36]); text(s, 2, mt - 2, "MW");
    svgEl("rect", { x: ml, y: y(hi), width: w - ml - mr, height: y(rating) - y(hi), fill: cssv("--crit"), opacity: 0.06 }, s);
    svgEl("line", { x1: ml, x2: w - mr, y1: y(rating), y2: y(rating), stroke: cssv("--crit"), "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s);
    text(s, ml + 6, y(rating) - 6, `Rating ${rating} MW`, { class: "t-ink" });
    const line = (arr, col, dash) => { svgEl("path", { d: arr.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(""), fill: "none", stroke: col, "stroke-width": 2.2, "stroke-dasharray": dash || "" }, s); arr.forEach((v, i) => { const c = svgEl("circle", { cx: x(i), cy: y(v), r: 4, fill: col, stroke: "#fff", "stroke-width": 2 }, s); hoverable(c, `<b>${yrs[i]}</b><div class="r"><span>Peak</span><span>${fmt(v, 1)} MW</span></div>`); }); };
    line(base, on ? cssv("--line-2") : cssv("--c-heat"), on ? "4 4" : "");
    if (on) line(port, cssv("--c-cool"));
    const cross = (arr) => arr.findIndex(v => v > rating);
    const cb = cross(base), cp = cross(port);
    svgEl("line", { x1: x(cb), x2: x(cb), y1: y(hi), y2: h - mb, stroke: cssv("--c-heat"), "stroke-width": 1, "stroke-dasharray": "2 3" }, s);
    text(s, x(cb) + 4, y(hi) + 12, `Overload ${yrs[cb]}`, { class: "t-2" });
    if (on && cp > 0) { svgEl("line", { x1: x(cp), x2: x(cp), y1: y(hi), y2: h - mb, stroke: cssv("--c-cool"), "stroke-width": 1, "stroke-dasharray": "2 3" }, s); text(s, x(cp) + 4, y(hi) + 26, `Deferred to ${yrs[cp]} · 2.6 MW relief`, { class: "t-ink" }); }
    yrs.forEach((yv, i) => { if (i % 2 === 0) text(s, x(i), h - 6, yv, { "text-anchor": "middle" }); });
    host.append(s); host.insertAdjacentHTML("beforeend", legendHtml([["var(--c-heat)", "Baseline forecast"], ["var(--c-cool)", "With managed charging, thermostat DR and batteries"]]));
  },


  highbill(host) {
    ucHead(host, "What the CSR sees before saying hello");
    host.insertAdjacentHTML("beforeend", win("CSR desktop · Account 40021887", `
      <div class="mock-row"><div><div class="muted">August bill</div><div class="big">$194 <span class="up">▲ $52</span></div></div><span class="pill">${icon("check")}No billing anomaly</span></div>
      <div class="lbl">Why it changed</div>
      ${drv("Cooling (heat wave)", 38, 40, "--c-cool")}${drv("EV charging", 9, 40, "--c-ev")}${drv("Rate change", 6, 40, "--c-wh")}${drv("3 extra days", 3, 40, "--c-other")}${drv("Lighting", -4, 40, "--c-ao")}
      <div class="mock-row"><span class="muted">Suggest</span><span class="pill-row"><span class="pill">TOU-EV plan</span><span class="pill">Pre-cool before 4pm</span></span></div>
      <div class="mock-row"><span class="muted">Same answer in</span><span class="pill-row"><span class="tag">Web</span><span class="tag">App</span><span class="tag">IVR</span><span class="tag">Chat</span></span></div>`));
  },

  flex(host) {
    ucHead(host, "Day-ahead DR event prep");
    automation(host, {
      name: "DR event prep agent", trigger: "Runs when tomorrow's forecast peak > 95°F",
      steps: [["weather", "Heat forecast", "Weather feed"], ["battery", "Size flexible kW", "UtilityAI Pro engines"], ["pin", "Rank feeders", "GIS"], ["send", "Notify 6,420 customers", "Marketing cloud"], ["chart", "Measure kW delivered", "DERMS"]],
      log: [["06:00", "Peak 98°F forecast for 4-8pm"], ["06:01", "1.84 MW shiftable on F-2231, 1.51 MW on F-1187"], ["06:02", "6,420 unenrolled high-flex customers selected"], ["06:05", "Pre-event messages queued"], ["20:15", "Delivered 2.9 MW, report sent to program team"]],
      output: `<div class="oh">${icon("check")}Event summary</div><div class="mock-row"><span>Feeders covered</span><b>7</b></div><div class="mock-row"><span>kW per enrollee</span><b>2.4×</b></div>`,
    });
  },

  trend(host) {
    ucHead(host, "Always-on DER trend monitor");
    automation(host, {
      name: "DER trend monitor", trigger: "Runs after every nightly model run",
      steps: [["ev", "New EV & solar detected", "Disaggregation"], ["clipboard", "Match interconnections", "Your records"], ["pin", "Roll up by network", "GIS"], ["bell", "Alert planners", "Microsoft Teams"]],
      log: [["02:10", "318 new EV chargers, 96 new solar arrays"], ["02:11", "212 have no interconnection record"], ["02:12", "N-18 crossed 14% EV adoption"], ["02:12", "Alert posted to #distribution-planning"]],
      output: `<div class="oh">${icon("chat")}Teams · #distribution-planning</div><div><b>N-18 EV adoption hit 14.2%</b>, up 4.1 pts since January. 212 unreported chargers attached for review.</div>`,
    });
  },

  rates(host) {
    ucHead(host, "Rate coaching, in the customer's pocket");
    host.insertAdjacentHTML("beforeend", `<div class="phones">${phone(`
      <div class="notif"><span class="app">${icon("bolt")}Your Utility · now</span><b>Save $420 a year on TOU-EV</b><span>Charging after 11pm already fits the plan.</span></div>
      <div class="lbl">Your annual cost</div>
      ${drv("Standard (now)", 2280, 2300, "--c-other", "")}${drv("TOU", 1990, 2300, "--c-cool", "")}${drv("TOU-EV", 1860, 2300, "--c-ev", "")}
      <button class="btn dark" type="button" style="justify-content:center">Switch plan</button>`)}</div>`);
  },

  assistant(host) {
    ucHead(host, "Solar what-if, inside your app");
    host.insertAdjacentHTML("beforeend", `<div class="phones">${phone(`
      <div class="msg user" style="max-width:100%">Is solar worth it for my home?</div>
      <div class="notif"><span class="app">${icon("sun")}Solar estimate · 8.4 kW</span>
        <div class="mock-row"><span>Net cost</span><b>$12,900</b></div><div class="mock-row"><span>Saves</span><b>$1,820/yr</b></div><div class="mock-row"><span>Payback</span><b>7.1 yrs</b></div></div>
      <div style="height:54px;border-radius:10px;background:linear-gradient(90deg,rgba(208,59,59,.15) 0 28%,rgba(237,161,0,.25) 28% 100%);position:relative"><span style="position:absolute;left:28%;top:0;bottom:0;width:2px;background:var(--navy)"></span><span class="xs" style="position:absolute;left:31%;top:6px">break-even</span><span class="xs" style="position:absolute;right:8px;bottom:6px"><b>+$32,600</b> in 25 yrs</span></div>`)}</div>`);
  },

  alert(host) {
    ucHead(host, "The email that arrives mid-cycle");
    host.insertAdjacentHTML("beforeend", win("Inbox", `
      <div class="hdr"><span><b>From</b> Your Utility</span><span><b>Subject</b> Your bill is trending higher than usual</span></div>
      <div class="banner"><span class="muted">Projected bill</span><span class="big">$171 <span class="up">+42%</span></span><span class="muted">Usually about $120 · 15 days left in your cycle</span></div>
      <div class="lbl">What's driving it</div>${drv("Cooling", 38, 40, "--c-cool")}${drv("EV charging", 9, 40, "--c-ev")}
      <div class="tip-row">${icon("snow")}<span>Raise your thermostat 2°F between 2 and 7pm to save about $19.</span></div>
      <div class="tip-row">${icon("clock")}<span>Pre-cool before 4pm while prices are lower.</span></div>`, "email"));
  },

  web(host) {
    ucHead(host, "Energy details in your app");
    const segs = [["--c-cool", 88], ["--c-ev", 31], ["--c-ao", 24], ["--c-pool", 18], ["--c-wh", 14], ["--c-other", 19]];
    let acc = 0; const stops = segs.map(([c, v]) => { const a = acc; acc += v / 194 * 100; return `var(${c}) ${a}% ${acc}%`; }).join(",");
    host.insertAdjacentHTML("beforeend", `<div class="phones">${phone(`
      <div class="mock-row"><b>August</b><span class="muted">by appliance</span></div>
      <div class="donut" style="background:conic-gradient(${stops})"><b>$194</b></div>
      ${[["Cooling", 88, "--c-cool"], ["EV charging", 31, "--c-ev"], ["Always on", 24, "--c-ao"], ["Pool pump", 18, "--c-pool"]].map(([n, v, c]) => `<div class="mock-row"><span style="display:flex;align-items:center;gap:6px"><span class="sw" style="background:var(${c})"></span>${n}</span><b>${money(v)}</b></div>`).join("")}
      <span class="pill">${icon("flame")}Cooling is 24% above similar homes</span>`)}</div>`);
  },

  targeting(host) {
    ucHead(host, "Heat pump campaign, built by an agent");
    automation(host, {
      name: "Campaign agent", trigger: "Asked in Copilot: “build a heat pump list”",
      steps: [["brain", "Filter on model outputs", "Attributes · Income"], ["clipboard", "Exclude enrolled", "Program history"], ["dash", "Simulate uptake", "Analytics Workbench"], ["export", "Push the segment", "Salesforce Marketing Cloud"]],
      log: [["09:02", "1.2M homes → 412k electric heat → 318k no heat pump"], ["09:02", "61,300 likely income-qualified"], ["09:03", "18,240 not yet enrolled"], ["09:04", "Est. 1,460 enrollments, 3.1 GWh/yr savings"], ["09:04", "Segment hp_lmi_q4 sent"]],
      output: `<div class="oh">${icon("target")}hp_lmi_q4</div><div class="mock-row"><span>Homes</span><b>18,240</b></div><div class="mock-row"><span>Expected enrollments</span><b>1,460</b></div>`,
    });
  },

  analyst(host) {
    ucHead(host, "Ask the data, get the query");
    const rows = [["N-18", 1204], ["N-04", 988], ["N-12", 760], ["N-07", 512]];
    host.insertAdjacentHTML("beforeend", win("Energy Analyst · governed workspace", `
      <div class="tip-row">${icon("search")}<span>How many homes added an EV this year, by network?</span></div>
      <div class="cmd"><code>SELECT network, COUNT(*) FROM upro.ev_detections WHERE first_seen &gt;= '2026-01-01' GROUP BY 1</code><button type="button">Copy</button></div>
      <table class="tbl"><thead><tr><th>Network</th><th>New EV homes</th><th></th></tr></thead><tbody>${rows.map(([n, v]) => `<tr><td>${n}</td><td>${v.toLocaleString()}</td><td style="width:50%"><div class="bar"><i style="width:${v / 1300 * 100}%"></i></div></td></tr>`).join("")}</tbody></table>`));
    host.querySelector(".cmd button").addEventListener("click", (e) => copyText(e.target.previousElementSibling.textContent, e.target));
  },

  revenue(host) {
    ucHead(host, "From anomaly to work order");
    automation(host, {
      name: "Revenue protection agent", trigger: "Runs weekly on revenue loss model outputs",
      steps: [["shield", "Flag anomalies", "Revenue loss model"], ["table", "Rank & match events", "Meter events"], ["wrench", "Create work orders", "Maximo / SAP"], ["check", "Learn from outcomes", "Field results"]],
      log: [["Mon 05:00", "14 priority-1 cases found"], ["Mon 05:01", "M-55120: usage −58%, cover-open event"], ["Mon 05:02", "14 work orders created"], ["Fri 17:00", "9 confirmed, thresholds tuned"]],
      output: `<div class="oh">${icon("wrench")}WO-88213 · M-55120</div><div class="mock-row"><span>Category</span><b>Tampering</b></div><div class="mock-row"><span>Est. unbilled</span><b>410 kWh/mo</b></div>`,
    });
  },
};
