/* ---------- init ---------- */
buildEnvChips(); renderStack(); renderLayer();
buildModelTabs();
buildOutcomes(); buildUCTabs(); renderUC(); initAsk();
$("#brand-logo").src = BIDGELY_LOGO;
$("#model-close").addEventListener("click", () => $("#model-dlg").close());
$("#model-dlg").addEventListener("click", (e) => { if (e.target.id === "model-dlg") e.target.close(); });

let rz, lastVW = VW();
addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if ($("#model-dlg").open && Math.abs(VW() - lastVW) > 8) { lastVW = VW(); renderModel(); } drawUCViz(); }, 140); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawUCViz(); });
$("#eng-close").addEventListener("click", () => $("#eng-dlg").close());
$("#eng-dlg").addEventListener("click", (e) => { if (e.target.id === "eng-dlg") e.target.close(); });
const setFull = (on) => { document.body.classList.toggle("plat-full", on); const b = $("#full-btn"); b.setAttribute("aria-pressed", on); b.textContent = on ? "✕ Exit full screen" : "⤢ Full screen"; };
$("#full-btn").addEventListener("click", () => setFull(!document.body.classList.contains("plat-full")));
addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("plat-full") && !document.querySelector("dialog[open]")) setFull(false); });
$("#top-search").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#top-q").value; $("#top-q").value = ""; $("#ask").scrollIntoView({ behavior: "smooth" }); ask(q); });
