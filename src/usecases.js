/* ---------- use cases: tabs, visuals, MCP connect + assistant chat ---------- */
const ASSISTANTS = {
  claude:  { name: "Claude", dot: "#d97757" },
  chatgpt: { name: "ChatGPT", dot: "#10a37f" },
  copilot: { name: "Microsoft Copilot", dot: "#0078d4" },
  gemini:  { name: "Gemini", dot: "#4285f4" },
  dev:     { name: "Your agent", dot: "#04121f" },
};
let ucId = "highbill", mcpTab = "claude", chatTimer = null;
const UC_ORDER = ["highbill", "forecast", "flex", "nws", "trend", "rates", "assistant", "alert", "web", "targeting", "analyst", "revenue"];
const UCW = (host) => Math.max(280, Math.round(host.clientWidth || 600));
const CHECK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const money = (v) => "$" + Math.round(v).toLocaleString();

function buildUCTabs() {
  const c = $("#uc-tabs"); c.innerHTML = "";
  UC_ORDER.forEach(id => {
    const u = USE_CASES.find(x => x.id === id);
    const b = el("button", { type: "button", class: "uc-tab", "data-id": id, "aria-pressed": id === ucId }, `<b>${esc(u.short)}</b><span>${esc(u.group)}</span>`);
    b.addEventListener("click", () => { ucId = id; renderUC(); });
    c.append(b);
  });
}

function renderUC() {
  document.querySelectorAll(".uc-tab").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === ucId));
  const u = USE_CASES.find(x => x.id === ucId), m = UC_MCP[ucId], S = MCP_SERVERS[m.server];
  const used = new Set(m.turns.filter(t => t[0] === "tool").map(t => t[1]));
  const ing = (cls, title, dot, items) => `<div class="ing ${cls}"><h6><i style="background:${dot}"></i>${title}</h6><ul>${items.map(i => `<li>${esc(sub(i))}</li>`).join("")}</ul></div>`;
  const url = `https://upro.your-utility.com/mcp/${S.path}`;
  $("#uc-card").innerHTML = `<article class="uc-card">
    <div class="uc-hero">
      <div class="panel">
        <span class="eyebrow">${esc(u.group)}</span>
        <h3>${esc(u.title)}</h3>
        <div class="chips">${u.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        <p>${esc(u.need)}</p>
        <ul class="value-list">${u.value.map(x => `<li>${CHECK}<span>${esc(x)}</span></li>`).join("")}</ul>
        ${u.proof ? `<p class="proof">${esc(u.proof)}</p>` : ""}
      </div>
      <div class="panel ucv" id="ucv"></div>
    </div>

    <div class="mcp">
      <div class="mcp-setup">
        <span class="eyebrow">Connect it to your AI assistant</span>
        <div class="srv"><span class="srv-ic"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7h12M4 13h12M7 4v12M13 4v12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
          <div><b>${esc(S.name)}</b><span>MCP server in ${esc(ENV().tenant)} · for ${esc(S.who)}</span></div></div>
        <div class="tool-chips">${S.tools.map(t => `<code class="${used.has(t) ? "used" : ""}">${t}</code>`).join("")}</div>
        <div class="seg" role="group" aria-label="Where to connect" style="flex-wrap:wrap">${Object.entries(ASSISTANTS).map(([k, v]) => `<button type="button" data-t="${k}" aria-pressed="${mcpTab === k}">${k === "dev" ? "Developers" : k === "copilot" ? "Copilot" : v.name}</button>`).join("")}</div>
        <div class="howto" id="howto"></div>
      </div>
      <div class="chat">
        <div class="chat-top"><span class="who"><i aria-hidden="true" id="chat-dot"></i><span id="chat-name">Claude</span> · connected to ${esc(S.id)}</span><button type="button" class="btn sm" id="chat-replay">Replay</button></div>
        <div class="chat-body" id="chat-body" aria-live="polite"></div>
      </div>
    </div>

    <div class="two">
      <div class="panel"><h4>The recipe</h4>
        <div class="recipe">
          ${ing("utility", "Your data", "var(--accent)", u.utility)}
          ${ing("", "Models", "var(--c-ev)", u.models)}
          ${ing("", "Engines", "var(--c-heat)", u.engines)}
          ${ing("", "APIs · MCPs · Apps", "var(--c-cool)", u.access)}
        </div>
      </div>
      <div class="panel"><h4>How it runs</h4>
        <ol class="steps">${u.steps.map(([t, who]) => `<li><span>${esc(sub(t))}<span class="who">${esc(who)}</span></span></li>`).join("")}</ol>
        <div class="split"><div><span class="lbl">Bidgely delivers</span><ul>${u.bidgely.map(x => `<li>${esc(x)}</li>`).join("")}<li>Reference implementation and orchestration guide</li></ul></div>
        <div><span class="lbl">You or your SI</span><ul>${u.you.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      </div>
    </div>
  </article>`;

  const setup = () => {
    const h = $("#howto");
    const e = ENV();
    if (mcpTab === "claude") h.innerHTML = `<ol><li>In Claude, open <b>Settings → Connectors</b> and choose <b>Add custom connector</b>.</li><li>Name it <b>${esc(S.name)}</b> and paste the server URL.</li><li>Sign in with your company SSO. Tools and data follow your existing roles.</li><li>Ask a question like the one on the right.</li></ol>${cmd(url)}`;
    else if (mcpTab === "chatgpt") h.innerHTML = `<ol><li>In ChatGPT (Business or Enterprise), an admin turns on developer mode under <b>Settings → Apps &amp; Connectors</b>.</li><li>Create a connector named <b>${esc(S.name)}</b> with the MCP server URL.</li><li>Authenticate with your company SSO, then enable the connector in a chat.</li></ol>${cmd(url)}`;
    else if (mcpTab === "copilot") h.innerHTML = `<ol><li>In <b>Microsoft Copilot Studio</b>, open your agent and go to <b>Tools → Add a tool</b>.</li><li>Choose <b>Model Context Protocol</b> and enter the server URL, with OAuth through Entra ID.</li><li>Publish the agent to Teams or Microsoft 365 Copilot.</li></ol>${cmd(url)}`;
    else if (mcpTab === "gemini") h.innerHTML = `<ol><li>In <b>Gemini Enterprise</b> or <b>Vertex AI Agent Builder</b>, add the server as an MCP tool for your agent.</li><li>Use Google Cloud identity or your SSO for authentication.</li><li>Share the agent with your teams in Gemini.</li></ol>${cmd(url)}`;
    else h.innerHTML = `<p>Any MCP client can connect, including ${esc(e.agentsInt)}, ${esc(e.agentsExt)} and agents you build yourself. Customer-scoped tools can also run as a sub-agent behind your web chat and IVR.</p>${cmd(`claude mcp add --transport http ${S.id} ${url}`)}${cmd(`{"mcpServers":{"${S.id}":{"type":"http","url":"${url}"}}}`)}`;
    const A = ASSISTANTS[mcpTab]; $("#chat-name").textContent = A.name; $("#chat-dot").style.background = A.dot;
    h.querySelectorAll(".cmd button").forEach(b => b.addEventListener("click", () => copyText(b.previousElementSibling.textContent, b)));
    document.querySelectorAll(".mcp .seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.t === mcpTab));
  };
  document.querySelectorAll(".mcp .seg button").forEach(b => b.addEventListener("click", () => { mcpTab = b.dataset.t; setup(); }));
  setup();
  $("#chat-replay").addEventListener("click", () => playChat(true));
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
  return `<details class="msg tool" open><summary><span class="dot"></span>Used <code>${esc(t[1])}</code><span class="srvname">${esc(S.id)}</span></summary><pre>Request  ${esc(pretty(t[2]))}\nResponse ${esc(pretty(t[3]))}</pre></details>`;
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

/* ---------- per-use-case visuals ---------- */
let ucvState = {};
function drawUCViz() { const host = $("#ucv"); if (!host) return; host.innerHTML = ""; (UCV[ucId] || (() => {}))(host); }
function ucHead(host, title, note, controls = "") {
  host.append(el("div", { class: "ucv-h" }, `<h4>${esc(title)}</h4>${controls}`));
  if (note) host.append(el("span", { class: "xs muted" }, esc(note)));
}
function segCtl(key, opts, def) {
  if (ucvState[key] == null) ucvState[key] = def;
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-seg="${key}" data-v="${v}" aria-pressed="${String(ucvState[key]) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
}
function wireSeg(host) { host.querySelectorAll("[data-seg]").forEach(b => b.addEventListener("click", () => { const v = b.dataset.v; ucvState[b.dataset.seg] = isNaN(+v) ? v : +v; drawUCViz(); })); }
function legendHtml(items) { return `<div class="legend">${items.map(([c, n]) => `<span><span class="sw" style="background:${c}"></span>${esc(n)}</span>`).join("")}</div>`; }

const UCV = {
  forecast(host) {
    ucHead(host, "Network 12 design day, by end use", "Hourly MW on the summer design day. Hover for the stack at any hour.", segCtl("fy", [[2026, "2026"], [2030, "2030 forecast"]], 2026)); wireSeg(host);
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

  flex(host) {
    ucHead(host, "Shiftable load by feeder, 4 to 8pm", "Unenrolled customers only. Feeders marked with a dot are at or near their rating.");
    const rows = [["F-2231", 846, 755, 239, 1], ["F-1187", 700, 610, 200, 1], ["F-3020", 560, 590, 90, 0], ["F-0914", 520, 480, 150, 1], ["F-2210", 430, 470, 60, 0], ["F-1702", 380, 350, 110, 0], ["F-0455", 300, 360, 40, 0]];
    const w = UCW(host), rh = 30, ml = 70, mr = 60, mt = 6, h = mt + rows.length * rh + 22, mx = 2000;
    const x = (v) => ml + v / mx * (w - ml - mr);
    const s = mkSvg(w, h, "Stacked bars of flexible kW per feeder");
    [0, 500, 1000, 1500, 2000].forEach(t => { svgEl("line", { x1: x(t), x2: x(t), y1: mt, y2: h - 18, class: "grid-l" }, s); text(s, x(t), h - 4, t ? `${t / 1000} MW` : "0", { "text-anchor": "middle" }); });
    const C = [["EV charging", "--c-ev"], ["HVAC", "--c-cool"], ["Batteries", "--c-wh"]];
    rows.forEach((r, i) => {
      const cy = mt + i * rh; let acc = 0;
      text(s, ml - 10, cy + rh / 2 + 4, r[0], { "text-anchor": "end", class: "t-ink" });
      C.forEach(([n, c], j) => { const v = r[1 + j]; const rect = svgEl("rect", { x: x(acc) + (j ? 1 : 0), y: cy + 6, width: Math.max(1, x(acc + v) - x(acc) - 1), height: rh - 12, rx: j === 2 ? 4 : 0, fill: cssv(c) }, s); hoverable(rect, `<b>${r[0]}</b><div class="r"><span>${n}</span><span>${v.toLocaleString()} kW</span></div>`); acc += v; });
      text(s, x(acc) + 8, cy + rh / 2 + 4, `${(acc / 1000).toFixed(2)} MW`, {});
      if (r[4]) svgEl("circle", { cx: ml - 58, cy: cy + rh / 2, r: 4, fill: cssv("--crit") }, s);
    });
    host.append(s); host.insertAdjacentHTML("beforeend", legendHtml(C.map(([n, c]) => [`var(${c})`, n])));
  },

  nws(host) {
    ucHead(host, "Network 7 peak vs. rating", "Forecast summer peak. Toggle the flexibility portfolio to see the deferral.", segCtl("nwp", [[0, "Baseline"], [1, "With portfolio"]], 1)); wireSeg(host);
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

  trend(host) {
    if (ucvState.tm == null) ucvState.tm = 20;
    ucHead(host, "EV adoption by network", "Share of homes with detected EV charging. Drag the slider through time; outlined networks are above 10%.");
    const nets = Array.from({ length: 24 }, (_, i) => { const r = rng(100 + i); const b = 0.015 + r() * 0.03, g = 0.0005 + r() * 0.0014; return { id: `N-${String(i + 1).padStart(2, "0")}`, b, g }; });
    nets[17] = { id: "N-18", b: 0.05, g: 0.0031 }; nets[3] = { id: "N-04", b: 0.045, g: 0.0024 };
    const months = Array.from({ length: 21 }, (_, i) => { const d = new Date(Date.UTC(2025, i, 1)); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; });
    const grid = el("div", { style: "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px" }); host.append(grid);
    const ctl = el("div", { class: "range" }, `<label for="tm" class="small">Month</label><input id="tm" type="range" min="0" max="20" step="1" value="${ucvState.tm}"><span class="small" id="tmv" style="min-width:64px">${months[ucvState.tm]}</span>`); host.append(ctl);
    const draw = () => {
      const t = ucvState.tm, zero = cssv("--hm-zero"), hue = cssv("--c-ev"); grid.innerHTML = "";
      nets.forEach(n => {
        const v = n.b + n.g * t * (1 + t / 40), rgb = mix(zero, hue, clamp(v / 0.15, 0.05, 1)), hot = v >= 0.1;
        const tile = el("div", { style: `background:rgb(${rgb});border-radius:10px;padding:8px;font-size:var(--fs-3);border:2px solid ${hot ? "var(--navy)" : "transparent"};color:${v > 0.09 ? "#fff" : "var(--ink)"}` }, `<b>${n.id}</b><div>${(v * 100).toFixed(1)}%</div>`);
        grid.append(tile);
      });
      $("#tmv").textContent = months[t];
    };
    $("#tm").addEventListener("input", (e) => { ucvState.tm = +e.target.value; draw(); });
    draw();
  },

  highbill(host) {
    ucHead(host, "Why the August bill went up $52", "Bill change decomposed against the prior month. Every channel shows this same explanation.");
    const steps = [["July bill", 142, "base"], ["Cooling", 38, "--c-cool"], ["EV charging", 9, "--c-ev"], ["Rate change", 6, "--c-wh"], ["Extra days", 3, "--c-other"], ["Lighting", -4, "--c-ao"], ["August bill", 194, "base"]];
    const w = UCW(host), h = 250, ml = 44, mr = 10, mt = 16, mb = 40, lo = 100, hi = 200;
    const bw = (w - ml - mr) / steps.length, y = (v) => mt + (hi - v) / (hi - lo) * (h - mt - mb);
    const s = mkSvg(w, h, "Waterfall of bill change drivers"); yAxis(s, ml, w - mr, y, [100, 125, 150, 175, 200], (t) => "$" + t);
    let run = 0;
    steps.forEach(([n, v, c], i) => {
      const xx = ml + i * bw + 6, ww = bw - 12; let a, b;
      if (c === "base") { a = lo; b = v; run = v; } else { a = run; b = run + v; run = b; }
      const top = Math.max(a, b), bot = Math.min(a, b);
      const r = svgEl("rect", { x: xx, y: y(top), width: ww, height: Math.max(2, y(bot) - y(top)), rx: 4, fill: c === "base" ? cssv("--navy") : cssv(c) }, s);
      hoverable(r, `<b>${esc(n)}</b><div class="r"><span>${c === "base" ? "Total" : "Change"}</span><span>${c === "base" ? money(v) : (v > 0 ? "+" : "−") + money(Math.abs(v))}</span></div>`);
      text(s, xx + ww / 2, y(top) - 6, c === "base" ? money(v) : (v > 0 ? "+" : "−") + money(Math.abs(v)), { "text-anchor": "middle", class: "t-ink" });
      const words = n.split(" "); text(s, xx + ww / 2, h - 24, words.slice(0, 2).join(" "), { "text-anchor": "middle" }); if (words.length > 2) text(s, xx + ww / 2, h - 10, words.slice(2).join(" "), { "text-anchor": "middle" });
    });
    host.append(s);
  },

  alert(host) {
    ucHead(host, "Bill projection through the cycle", "The projection is recomputed at checkpoints. The alert fires when it passes the threshold.");
    const w = UCW(host), h = 240, ml = 44, mr = 14, mt = 14, mb = 26, hi = 200;
    const x = (d) => ml + (d - 1) / 29 * (w - ml - mr), y = (v) => mt + (hi - v) / hi * (h - mt - mb);
    const s = mkSvg(w, h, "Month-to-date cost and projected bill"); yAxis(s, ml, w - mr, y, [0, 50, 100, 150, 200], (t) => "$" + t);
    const mtd = Array.from({ length: 21 }, (_, i) => { const d = i + 1; return d * (3.6 + (d > 8 ? 2.4 : 0) * Math.min(1, (d - 8) / 5)); });
    svgEl("path", { d: mtd.map((v, i) => `${i ? "L" : "M"}${x(i + 1)},${y(v)}`).join("") + `L${x(21)},${y(0)}L${x(1)},${y(0)}Z`, fill: cssv("--c-cool"), opacity: 0.12 }, s);
    svgEl("path", { d: mtd.map((v, i) => `${i ? "L" : "M"}${x(i + 1)},${y(v)}`).join(""), fill: "none", stroke: cssv("--c-cool"), "stroke-width": 2 }, s);
    svgEl("line", { x1: ml, x2: w - mr, y1: y(120), y2: y(120), stroke: cssv("--muted"), "stroke-dasharray": "4 4" }, s); text(s, w - mr, y(120) + 14, "Baseline projection $120", { "text-anchor": "end" });
    svgEl("line", { x1: ml, x2: w - mr, y1: y(168), y2: y(168), stroke: cssv("--crit"), "stroke-width": 1.5, "stroke-dasharray": "5 4" }, s); text(s, w - mr, y(168) - 6, "Alert threshold +40% ($168)", { "text-anchor": "end", class: "t-ink" });
    [[10, 138], [15, 171], [20, 176]].forEach(([d, v]) => { const hot = v > 168; const c = svgEl("circle", { cx: x(d), cy: y(v), r: 6, fill: hot ? cssv("--crit") : cssv("--navy"), stroke: "#fff", "stroke-width": 2 }, s); hoverable(c, `<b>Day ${d} checkpoint</b><div class="r"><span>Projected bill</span><span>${money(v)}</span></div>`); text(s, x(d), y(v) - 12, money(v), { "text-anchor": "middle", class: "t-ink" }); });
    text(s, x(15) + 10, y(171) + 22, "Alert email sent, day 15", { class: "t-2" });
    [1, 10, 15, 20, 30].forEach(d => text(s, x(d), h - 6, `Day ${d}`, { "text-anchor": "middle" }));
    host.append(s); host.insertAdjacentHTML("beforeend", legendHtml([["var(--c-cool)", "Month-to-date cost"], ["var(--navy)", "Checkpoint projection"], ["var(--crit)", "Over threshold"]]));
  },

  rates(host) {
    ucHead(host, "Annual cost on each eligible plan", "Based on this home's actual interval data.", segCtl("shift", [[0, "As is"], [1, "Charge EV after 11pm"]], 1)); wireSeg(host);
    const on = ucvState.shift === 1, plans = [["Standard", 2280, 2280], ["TOU", 2150, 1990], ["TOU-EV", 2090, 1860]];
    const w = UCW(host), h = 220, ml = 50, mr = 10, mt = 20, mb = 28, hi = 2500;
    const bw = (w - ml - mr) / plans.length, y = (v) => mt + (hi - v) / hi * (h - mt - mb);
    const s = mkSvg(w, h, "Annual cost by rate plan"); yAxis(s, ml, w - mr, y, [0, 500, 1000, 1500, 2000, 2500], (t) => "$" + t.toLocaleString());
    const vals = plans.map(p => on ? p[2] : p[1]), best = Math.min(...vals);
    plans.forEach((p, i) => { const v = vals[i], xx = ml + i * bw + bw * 0.22, ww = bw * 0.56; const r = svgEl("rect", { x: xx, y: y(v), width: ww, height: y(0) - y(v), rx: 5, fill: v === best ? cssv("--accent") : cssv("--surface-3") }, s); hoverable(r, `<b>${p[0]}</b><div class="r"><span>Annual</span><span>${money(v)}</span></div>`); text(s, xx + ww / 2, y(v) - 6, money(v), { "text-anchor": "middle", class: "t-ink" }); text(s, xx + ww / 2, h - 8, p[0] + (i === 0 ? " (current)" : ""), { "text-anchor": "middle" }); });
    host.append(s); host.insertAdjacentHTML("beforeend", `<div class="kpis"><div class="kpi"><b>${money(2280 - best)}/yr</b><span>savings on the best plan</span></div><div class="kpi"><b>${on ? "70%" : "38%"}</b><span>of EV charging off-peak</span></div><div class="kpi"><b>${on ? "TOU-EV" : "TOU-EV"}</b><span>recommended plan</span></div></div>`);
  },

  assistant(host) {
    ucHead(host, "Rooftop solar payback, 8.4 kW", "Cumulative savings minus net system cost, from the customer's own usage and rates.");
    const w = UCW(host), h = 240, ml = 54, mr = 14, mt = 14, mb = 26, lo = -15000, hi = 35000;
    const pts = Array.from({ length: 26 }, (_, yv) => -12900 + Array.from({ length: yv }, (_, k) => 1820 * Math.pow(0.995, k) * Math.pow(1.02, k) * 0.93).reduce((a, b) => a + b, 0));
    const k = 32600 / pts[25]; const P = pts.map(v => v < 0 ? v : v * (v > 0 ? k : 1));
    const x = (i) => ml + i / 25 * (w - ml - mr), y = (v) => mt + (hi - v) / (hi - lo) * (h - mt - mb);
    const s = mkSvg(w, h, "Solar cumulative net savings over 25 years"); yAxis(s, ml, w - mr, y, [-10000, 0, 10000, 20000, 30000], (t) => (t < 0 ? "−$" : "$") + Math.abs(t / 1000) + "k");
    svgEl("path", { d: P.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("") + `L${x(25)},${y(0)}L${x(0)},${y(0)}Z`, fill: cssv("--c-solar"), opacity: 0.18 }, s);
    svgEl("path", { d: P.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(""), fill: "none", stroke: cssv("--c-solar"), "stroke-width": 2.4 }, s);
    const pb = 7.1; svgEl("circle", { cx: x(pb), cy: y(0), r: 6, fill: cssv("--navy"), stroke: "#fff", "stroke-width": 2 }, s); text(s, x(pb) + 10, y(0) + 18, "Pays back in 7.1 years", { class: "t-ink" });
    svgEl("circle", { cx: x(25), cy: y(P[25]), r: 5, fill: cssv("--c-solar"), stroke: "#fff", "stroke-width": 2 }, s); text(s, x(25) - 8, y(P[25]) - 10, "+$32,600", { "text-anchor": "end", class: "t-ink" });
    [0, 5, 10, 15, 20, 25].forEach(t => text(s, x(t), h - 6, `Yr ${t}`, { "text-anchor": "middle" }));
    host.append(s); host.insertAdjacentHTML("beforeend", `<div class="kpis"><div class="kpi"><b>$12,900</b><span>net cost after rebates</span></div><div class="kpi"><b>$1,820/yr</b><span>first-year savings</span></div><div class="kpi"><b>21 × 400 W</b><span>about 200 sq ft of roof</span></div></div>`);
  },

  web(host) {
    ucHead(host, "August bill by appliance", "What the customer sees in your app, from the Energy Details API.");
    const rows = [["Cooling", 88, "--c-cool"], ["EV charging", 31, "--c-ev"], ["Always on", 24, "--c-ao"], ["Pool pump", 18, "--c-pool"], ["Water heating", 14, "--c-wh"], ["Lighting & other", 19, "--c-other"]];
    const w = UCW(host), rh = 34, ml = 120, mr = 70, h = rows.length * rh + 8, mx = 100, x = (v) => ml + v / mx * (w - ml - mr);
    const s = mkSvg(w, h, "Bill breakdown by appliance");
    rows.forEach(([n, v, c], i) => { const cy = i * rh + 4; text(s, ml - 10, cy + rh / 2 + 3, n, { "text-anchor": "end", class: "t-ink" }); svgEl("rect", { x: ml, y: cy + 8, width: x(mx) - ml, height: rh - 16, rx: 6, fill: cssv("--surface-2") }, s); const r = svgEl("rect", { x: ml, y: cy + 8, width: x(v) - ml, height: rh - 16, rx: 6, fill: cssv(c) }, s); hoverable(r, `<b>${n}</b><div class="r"><span>Cost</span><span>${money(v)} · ${Math.round(v / 194 * 100)}%</span></div>`); text(s, x(v) + 8, cy + rh / 2 + 3, `${money(v)} · ${Math.round(v / 194 * 100)}%`, {}); });
    host.append(s); host.insertAdjacentHTML("beforeend", `<div class="kpis"><div class="kpi"><b>$194</b><span>total energy charges</span></div><div class="kpi"><b>+24%</b><span>cooling vs. similar homes</span></div><div class="kpi"><b>3 tips</b><span>ranked for this home</span></div></div>`);
  },

  targeting(host) {
    ucHead(host, "Heat pump outreach segment", "Each filter is a model output or your own program data.");
    const st = [["Residential customers", 1200000, "All accounts"], ["Electric resistance heat", 412000, "Attributes: heating fuel"], ["No heat pump yet", 318000, "Attributes: heat pump detection"], ["Likely income-qualified", 61300, "Customer income model"], ["Not already enrolled", 18240, "Your program history"]];
    const w = UCW(host), rh = 42, h = st.length * rh + 6, max = st[0][1];
    const s = mkSvg(w, h, "Funnel of segment filters");
    st.forEach(([n, v, src], i) => { const bw = Math.max(60, (w * 0.62) * Math.pow(v / max, 0.35)), xx = (w * 0.62 - bw) / 2, cy = i * rh + 4; const r = svgEl("rect", { x: xx, y: cy, width: bw, height: rh - 8, rx: 8, fill: i === st.length - 1 ? cssv("--accent") : `rgb(${mix(cssv("--hm-zero"), cssv("--c-cool"), 0.2 + i * 0.13)})` }, s); hoverable(r, `<b>${n}</b><div class="r"><span>Homes</span><span>${v.toLocaleString()}</span></div><div>${src}</div>`); text(s, w * 0.31, cy + (rh - 8) / 2 + 4, v.toLocaleString(), { "text-anchor": "middle", class: "t-ink" }); text(s, w * 0.64, cy + 14, n, { class: "t-ink" }); text(s, w * 0.64, cy + 29, src, {}); });
    host.append(s);
  },

  analyst(host) {
    ucHead(host, "New EV homes this year, top networks", "The answer the assistant returned, with the governed query it ran.");
    const rows = [["N-18", 1204], ["N-04", 988], ["N-12", 760], ["N-07", 512]];
    const w = UCW(host), h = 200, ml = 40, mr = 10, mt = 20, mb = 26, hi = 1400, bw = (w - ml - mr) / rows.length, y = (v) => mt + (hi - v) / hi * (h - mt - mb);
    const s = mkSvg(w, h, "Bar chart of new EV homes by network"); yAxis(s, ml, w - mr, y, [0, 400, 800, 1200]);
    rows.forEach(([n, v], i) => { const xx = ml + i * bw + bw * 0.25, ww = bw * 0.5; const r = svgEl("rect", { x: xx, y: y(v), width: ww, height: y(0) - y(v), rx: 5, fill: cssv("--c-ev") }, s); hoverable(r, `<b>${n}</b><div class="r"><span>New EV homes</span><span>${v.toLocaleString()}</span></div>`); text(s, xx + ww / 2, y(v) - 6, v.toLocaleString(), { "text-anchor": "middle", class: "t-ink" }); text(s, xx + ww / 2, h - 8, n, { "text-anchor": "middle" }); });
    host.append(s); host.insertAdjacentHTML("beforeend", `<div class="cmd"><code>SELECT network, COUNT(*) FROM upro.ev_detections WHERE first_seen &gt;= '2026-01-01' GROUP BY 1</code><button type="button">Copy</button></div>`);
    host.querySelector(".cmd button").addEventListener("click", (e) => copyText(e.target.previousElementSibling.textContent, e.target));
  },

  revenue(host) {
    ucHead(host, "Meter M-55120, metered vs. expected", "Expected range comes from the meter's own history, weather response and similar premises.");
    const r = rng(5), n = 120, drop = 78, exp = [], act = [];
    for (let d = 0; d < n; d++) { const e = 34 + 14 * Math.sin(2 * Math.PI * (d + 40) / 180) + (r() - 0.5) * 5; exp.push(e); act.push(d < drop ? e * (0.93 + r() * 0.14) : e * (0.38 + r() * 0.1)); }
    const w = UCW(host), h = 220, ml = 36, mr = 10, mt = 12, mb = 22, top = 60, x = (d) => ml + d / (n - 1) * (w - ml - mr), y = (v) => mt + (top - v) / top * (h - mt - mb);
    const s = mkSvg(w, h, "Daily consumption with flagged drop"); yAxis(s, ml, w - mr, y, [0, 20, 40, 60]); text(s, 2, mt - 2, "kWh/day");
    svgEl("rect", { x: x(drop), y: mt, width: x(n - 1) - x(drop), height: h - mt - mb, fill: cssv("--crit"), opacity: 0.06 }, s);
    svgEl("path", { d: exp.map((e, i) => `${i ? "L" : "M"}${x(i)},${y(e * 1.12)}`).join("") + exp.slice().reverse().map((e, i) => `L${x(n - 1 - i)},${y(e * 0.88)}`).join("") + "Z", fill: cssv("--muted"), opacity: 0.15 }, s);
    svgEl("path", { d: act.map((a, i) => `${i ? "L" : "M"}${x(i)},${y(a)}`).join(""), fill: "none", stroke: cssv("--c-cool"), "stroke-width": 2 }, s);
    svgEl("circle", { cx: x(drop), cy: y(act[drop]), r: 5, fill: cssv("--crit"), stroke: "#fff", "stroke-width": 2 }, s);
    text(s, x(drop) + 8, mt + 12, "Tampering suspected · usage down 58%", { class: "t-ink" });
    host.append(s); host.insertAdjacentHTML("beforeend", legendHtml([["var(--c-cool)", "Metered"], ["rgba(102,119,136,.35)", "Expected range"], ["var(--crit)", "Flag"]]));
  },
};
