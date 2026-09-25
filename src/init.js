/* ---------- init ---------- */
buildEnvChips(); renderStack(); renderLayer();
buildModelTabs();
buildUCTabs(); renderUC(); initAsk();
$("#brand-logo").src = BIDGELY_LOGO;
$("#model-close").addEventListener("click", () => $("#model-dlg").close());
$("#model-dlg").addEventListener("click", (e) => { if (e.target.id === "model-dlg") e.target.close(); });

let rz, lastVW = VW();
addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if ($("#model-dlg").open && Math.abs(VW() - lastVW) > 8) { lastVW = VW(); renderModel(); } drawUCViz(); }, 140); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawUCViz(); });
