/* ---------- init ---------- */
buildEnvChips(); renderStack(); renderLayer();
buildModelTabs(); renderModel();
buildUCTabs(); renderUC();
renderDeploy();

let rz, lastVW = VW();
addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(VW() - lastVW) > 8) { lastVW = VW(); renderModel(); } drawUCViz(); }, 140); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { renderModel(); drawUCViz(); });
