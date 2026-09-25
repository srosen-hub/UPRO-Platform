/* ---------- Ask UtilityAI Pro: a chat grounded in this page's content ---------- */
// Demo questions answered from (synthetic) model outputs. Each has a short answer, the outputs it
// queried, and a small result table.
const ASK_SUGG = [
  { q: "Which networks are adding EVs fastest?", src: [["ev", "EV detections"], ["pin", "GIS rollup"]],
    rows: [["N-18", 1204], ["N-04", 988], ["N-12", 760], ["N-07", 512]], unit: " new EV homes",
    text: "N-18 leads with 1,204 homes that started charging an EV this year, now 14.2% of homes. N-04 follows with 988. 212 of the new chargers have no interconnection record.\nLINKS: uc:trend, model:disagg" },
  { q: "What's driving the summer peak on Network 12?", src: [["brain", "Disaggregation"], ["gear", "Meter-to-asset aggregation"]],
    rows: [["Base load", 21.6], ["Cooling", 12.1], ["EV charging", 6.3], ["Heat pumps", 1.2]], unit: " MW",
    text: "The 6pm design-day peak is 41.2 MW. Cooling is 12.1 MW of it and EV charging 6.3 MW, and EV charging is the fastest growing piece, forecast at +3.4 MW by 2030.\nLINKS: uc:forecast, uc:nws" },
  { q: "How many homes are heat pump candidates?", src: [["brain", "Attributes"], ["user", "Customer income"], ["clipboard", "Program history"]],
    rows: [["Electric resistance heat", 412000], ["No heat pump yet", 318000], ["Likely income-qualified", 61300], ["Not enrolled", 18240]], unit: " homes",
    text: "318,000 homes heat with electric resistance and have no heat pump. 61,300 of them are likely income-qualified, and 18,240 aren't in any program yet, a ready-made outreach list.\nLINKS: uc:targeting, model:attr, model:inc" },
  { q: "Who would save the most on TOU-EV?", src: [["tag", "Rate comparison"], ["ev", "EV detections"]],
    rows: [["Save over $400/yr", 8120], ["$200 to $400", 21560], ["$100 to $200", 34900]], unit: " customers",
    text: "8,120 EV owners would save more than $400 a year on TOU-EV, mostly because their charging already happens after 9pm. Another 21,560 would save $200 to $400.\nLINKS: uc:rates, model:life" },
  { q: "Which homes may have a failing AC?", src: [["flame", "Appliance inefficiency"]],
    rows: [["Degrading", 14800], ["Saturating on hot days", 9300], ["Short cycling", 4100]], unit: " homes",
    text: "14,800 homes show AC degradation: energy per cooling degree up more than 15% over two summers. 9,300 hit a ceiling on the hottest days. These are good tune-up and replacement targets.\nLINKS: model:ineff, uc:targeting" },
  { q: "Does any customer data leave our cloud?", src: [["shield", "Platform security"]], rows: [], unit: "",
    text: "No. Models run as encrypted containers on confidential compute inside your tenant and read and write your data lake directly. Only the key attestation handshake and operational counts cross the boundary, with no PII or consumption data.\nLINKS: layer:found, layer:models" },
];
const DEMO_DATA = ASK_SUGG.filter(d => d.rows.length).map(d => `Q: ${d.q}\nData: ${d.rows.map(r => `${r[0]} = ${r[1].toLocaleString()}${d.unit}`).join("; ")}\nContext: ${d.text.split("\nLINKS")[0]}`).join("\n\n");
let askTurns = [], askCtl = null, askSample;

function askKnowledge() {
  const e = ENV();
  const nodes = Object.values(NODES).map(n => `- ${n.name} (${n.kind}): ${sub(n.desc)}`).join("\n");
  const ucs = USE_CASES.map(u => `- [uc:${u.id}] ${u.title}. ${u.need} Value: ${u.value.join("; ")}.${u.proof ? " Proof: " + u.proof : ""} Uses: ${[...u.models, ...u.engines, ...u.access].join(", ")}.`).join("\n");
  const acc = ACCURACY.map(a => `${a.a}: min ${a.days} days, precision ${a.p}%, recall ${a.r}%, accuracy ${a.acc}%, false positive ${a.fpr}, 100-MAPE ${a.est}±${a.pm}%`).join("\n");
  const models = MODEL_TABS.map(t => `[model:${t.id}] ${t.name}`).join(", ");
  const mcp = Object.values(MCP_SERVERS).map(s => `${s.name} (${s.id}): tools ${s.tools.join(", ")}`).join("\n");
  return `PLATFORM: Bidgely UtilityAI Pro, a self-hosted AI platform for utilities. 38M+ meters, 45+ utility customers, 26 patents. Layers bottom to top: [layer:found] utility data foundation, [layer:models] core ML models, [layer:engines] engines + APIs + MCPs, [layer:out] applications and agents. Viewer's environment: ${e.tenant}. Model runtime: ${e.compute}. Data: ${e.data}.
SECURITY: models are encrypted containers on attested confidential compute; keys released only to verified workloads; all processing in the utility tenant; only the key attestation handshake and operational telemetry counts (no PII, no consumption data) cross the boundary over ${e.network}. Validated against the utility's ground truth before each launch; regression tested each version.
DEPLOYMENT: enterprise license, self-hosted in the utility cloud (Azure, GCP, AWS, OCI) on Databricks, Snowflake or cloud-native lakes; or Bidgely-hosted SaaS. Phases: Define, core models + Analytics Workbench, remaining models + Energy Analyst, data layer + CX APIs/MCP, then use case build by the utility or SI with Bidgely support.
COMPONENTS:\n${nodes}
MODELS: ${models}
ACCURACY (15-minute data):\n${acc}
USE CASES:\n${ucs}
DEMO MODEL OUTPUTS (synthetic sample utility, use these numbers when asked about data):
${DEMO_DATA}
MCP SERVERS (connect to Claude, ChatGPT, Microsoft Copilot Studio, Gemini Enterprise or any MCP client; URLs are https://upro.<utility>.com/mcp/<server>; tool names illustrative):\n${mcp}`;
}
const ASK_RULES = () => `You are the UtilityAI Pro demo assistant. You answer questions a utility could ask of its UtilityAI Pro model outputs, using the synthetic demo data and page content below. Answer using ONLY that content; when you quote demo numbers, say which model outputs they come from. If the answer isn't there, say you don't have that detail and suggest asking the Bidgely team. Be brief: 2 to 4 short sentences, or up to 4 bullets starting with "- ". Plain text, no headings, no bold. Do not invent numbers, customers or prices.
After the answer, add one final line starting "LINKS:" listing up to 3 relevant ids from the content, like "LINKS: uc:highbill, model:disagg, layer:models". Omit the line if nothing fits.

PAGE CONTENT:
${askKnowledge()}`;

function fmtAnswer(t) {
  const lines = esc(t).split("\n"), out = []; let ul = false;
  lines.forEach(l => { if (/^\s*[-•]\s+/.test(l)) { if (!ul) { out.push("<ul>"); ul = true; } out.push(`<li>${l.replace(/^\s*[-•]\s+/, "")}</li>`); } else { if (ul) { out.push("</ul>"); ul = false; } if (l.trim()) out.push(`<p>${l}</p>`); } });
  if (ul) out.push("</ul>");
  return out.join("").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
function splitLinks(t) { const m = t.match(/\n?LINKS:\s*(.+)\s*$/i); return m ? [t.slice(0, m.index).trim(), m[1].split(/[,\s]+/).filter(Boolean)] : [t.trim(), []]; }
function linkChip(id) {
  const [kind, key] = id.split(":");
  if (kind === "uc") { const u = USE_CASES.find(x => x.id === key); return u ? `<button type="button" class="chip sm" data-go="${id}">${icon(UC_META[key][0])} ${esc(u.short)}</button>` : ""; }
  if (kind === "model") { const t = MODEL_TABS.find(x => x.id === key); return t ? `<button type="button" class="chip sm" data-go="${id}">${icon("brain")} ${esc(t.name)}</button>` : ""; }
  if (kind === "layer") { const b = BANDS.find(x => x.id === key); return b ? `<button type="button" class="chip sm" data-go="${id}">${icon("dash")} ${esc(b.name)}</button>` : ""; }
  return "";
}
function go(id) {
  const [kind, key] = id.split(":");
  if (kind === "uc") openUC(key);
  else if (kind === "model") openModel(key);
  else if (kind === "layer") { selBand = key; renderStack(); renderLayer(); $("#platform").scrollIntoView({ behavior: "smooth" }); }
}
function fillDemo(a, d) {
  fillBubble(a, d.text);
  const max = Math.max(1, ...d.rows.map(r => r[1]));
  const src = `<div class="q-src">Queried ${d.src.map(([ic, n]) => `<span class="tag">${icon(ic)}${esc(n)}</span>`).join("")}</div>`;
  const mini = d.rows.length ? `<div class="mini">${d.rows.map(([n, v]) => `<div class="drv"><span>${esc(n)}</span><span class="track"><i style="width:${v / max * 100}%;background:var(--grad)"></i></span><b style="text-align:right">${v.toLocaleString()}</b></div>`).join("")}<span class="muted">${esc(d.unit.trim())} · synthetic demo data</span></div>` : "";
  a.querySelector(".body").insertAdjacentHTML("beforebegin", src);
  a.querySelector(".body").insertAdjacentHTML("afterend", mini);
}
function answerBubble() {
  const a = el("div", { class: "a" }, `<span class="who"><span class="spark" aria-hidden="true"></span>UtilityAI Pro</span><div class="body"><span class="thinking" aria-label="Thinking"><i></i><i></i><i></i></span></div><div class="links"></div>`);
  $("#ask-thread").append(a); return a;
}
function fillBubble(a, text) {
  const [body, links] = splitLinks(text);
  a.querySelector(".body").innerHTML = fmtAnswer(body);
  const L = a.querySelector(".links"); L.innerHTML = links.map(linkChip).join("");
  L.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
}

async function ask(q) {
  q = q.trim(); if (!q) return;
  const input = $("#ask-input"), send = $("#ask-send");
  input.value = ""; autoGrow();
  $("#ask-thread").append(el("div", { class: "q" }, esc(q)));
  const a = answerBubble();
  const canned = ASK_SUGG.find(s => s.q === q);
  if (canned) { setTimeout(() => fillDemo(a, canned), 650); return; } // suggested questions use the fixed demo outputs
  if (!askSample) { // no live model in this view
    setTimeout(() => canned ? fillDemo(a, canned) : fillBubble(a, "Live answers need this page open in Claude. Try one of the suggested questions."), 650);
    return;
  }
  askTurns.push({ role: "user", content: q });
  askCtl?.abort(); askCtl = new AbortController(); send.disabled = true;
  try {
    const turns = [{ role: "user", content: ASK_RULES() }, ...askTurns.slice(-8)];
    const { text } = await askSample(turns, { cache: false, modelTier: "quick", signal: askCtl.signal, onText: ({ text }) => fillBubble(a, text) });
    fillBubble(a, text); askTurns.push({ role: "assistant", content: text });
  } catch (e) {
    askTurns.pop();
    if (e.code === "cancelled") return;
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e.code)) { askSample = null; }
    if (canned) return fillDemo(a, canned);
    fillBubble(a, e.code === "rate_limited" ? "Too many questions at once. Try again in a moment." : "That didn't go through. Try asking again.");
  } finally { send.disabled = false; }
}
function autoGrow() { const t = $("#ask-input"); t.style.height = "auto"; t.style.height = Math.min(160, t.scrollHeight) + "px"; }

function initAsk() {
  const sg = $("#ask-sugg");
  sg.innerHTML = ASK_SUGG.map(d => `<button type="button" class="chip">${icon(d.src[0][0])}${esc(d.q)}</button>`).join("");
  sg.querySelectorAll("button").forEach((b, i) => b.addEventListener("click", () => ask(ASK_SUGG[i].q)));
  $("#ask-form").addEventListener("submit", (e) => { e.preventDefault(); ask($("#ask-input").value); });
  $("#ask-input").addEventListener("input", autoGrow);
  $("#ask-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($("#ask-input").value); } });
  if (window.claude && window.claude.use) window.claude.use("sample").then(s => { askSample = s; }).catch(() => {});
}
