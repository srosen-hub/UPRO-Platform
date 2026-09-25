/* ---------- Ask UtilityAI Pro: a chat grounded in this page's content ---------- */
const ASK_SUGG = [
  ["Does any customer data leave our cloud?", "No. Models run as encrypted containers on confidential compute inside your tenant. They read inputs from your data lake and write outputs back to it as governed tables. Only two things cross the boundary: the attestation handshake that releases model keys, and operational counts such as job and row counts. Neither contains PII or consumption data.\nLINKS: layer:found, layer:models"],
  ["How accurate is EV detection?", "On 15-minute data, Level 2/3 EV charging is detected with 85% precision, 92% recall and 98% overall accuracy, capturing about 90% (±5%) of actual EV consumption. Level 1 charging is harder: 65% precision and 75% recall. EV detection needs about 180 days of history, and each model is validated against your own ground truth before launch.\nLINKS: model:disagg, uc:trend"],
  ["What helps with non-wires alternatives?", "Three use cases work together:\n- End-use load forecasting shows which appliances drive each network's peak.\n- Flexibility targeting sizes shiftable kW by feeder and customer.\n- NWS evaluation compares a build against a flexibility portfolio and returns pre- and post-program 8760s.\nLINKS: uc:nws, uc:forecast, uc:flex"],
  ["How do I connect it to Copilot or ChatGPT?", "Each use case is exposed through a UtilityAI Pro MCP server running in your tenant. In Copilot Studio, add it under Tools → Add a tool → MCP. In ChatGPT, turn on developer mode under Settings → Apps & Connectors and create a connector with the server URL. Sign-in goes through your SSO, so data access follows existing roles.\nLINKS: uc:highbill, uc:analyst"],
];
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
MCP SERVERS (connect to Claude, ChatGPT, Microsoft Copilot Studio, Gemini Enterprise or any MCP client; URLs are https://upro.<utility>.com/mcp/<server>; tool names illustrative):\n${mcp}`;
}
const ASK_RULES = () => `You are the UtilityAI Pro guide on Bidgely's platform page. Answer the visitor using ONLY the page content below. If the answer isn't there, say you don't have that detail and suggest asking the Bidgely team. Be brief: 2 to 4 short sentences, or up to 4 bullets starting with "- ". Plain text, no headings, no bold. Do not invent numbers, customers or prices.
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
  const canned = ASK_SUGG.find(s => s[0] === q);
  if (!askSample) { // no live model in this view: prewritten answers for the suggestions
    setTimeout(() => fillBubble(a, canned ? canned[1] : "Live answers need this page open in Claude. Try one of the suggested questions below."), 450);
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
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e.code)) { askSample = null; $("#ask-note").textContent = "Live answers are off for this view. Suggested questions still work."; }
    fillBubble(a, canned ? canned[1] : e.code === "rate_limited" ? "Too many questions at once. Try again in a moment." : "That didn't go through. Try asking again.");
  } finally { send.disabled = false; }
}
function autoGrow() { const t = $("#ask-input"); t.style.height = "auto"; t.style.height = Math.min(160, t.scrollHeight) + "px"; }

function initAsk() {
  const sg = $("#ask-sugg");
  sg.innerHTML = ASK_SUGG.map(([q]) => `<button type="button" class="chip">${icon("search")}${esc(q)}</button>`).join("");
  sg.querySelectorAll("button").forEach((b, i) => b.addEventListener("click", () => ask(ASK_SUGG[i][0])));
  $("#ask-form").addEventListener("submit", (e) => { e.preventDefault(); ask($("#ask-input").value); });
  $("#ask-input").addEventListener("input", autoGrow);
  $("#ask-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($("#ask-input").value); } });
  if (window.claude && window.claude.use) window.claude.use("sample").then(s => { askSample = s; if (s) $("#ask-note").textContent = "Answers come from this page, using Claude on your account."; }).catch(() => {});
}
