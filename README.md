# UtilityAI Pro Platform Overview

Interactive, single-page overview of Bidgely UtilityAI Pro, built from the concepts in the
Southern Company SOW (Sep 2026) and the Con Edison enterprise proposal (Sep 2026), generalized
so it can be shown to any utility.

## What's on the page

1. **Platform map**: your data sets, the UtilityAI Pro data layer, models, engines and interfaces
   inside a dashed "your cloud tenant" boundary, and the channels and agents that consume them.
   Click any component for details; pick a use case to trace its path; switch the target cloud
   (Azure + Databricks, GCP, OCI, AWS) to relabel services.
2. **Model deep dives**: eight tabs with interactive visuals on a synthetic household
   (heatmap small multiples, hourly stacked breakdown, published accuracy table, attributes,
   HVAC inefficiency, lifestyle archetypes, DER propensity, premise-level income, similar-home
   comparison, revenue loss).
3. **Use case recipes**: twelve use cases, each shown as your data + models + engines +
   APIs/MCPs/apps, with orchestration steps, value, and the Bidgely vs. utility/SI split.
4. **Deployment**: cloud service mapping, security model (what does and does not cross the
   boundary), enterprise vs. SaaS options, and the reference implementation plan.
5. **Results** at PSEG Long Island, APS and NV Energy.

## Structure

```
src/styles.css   design tokens (light + dark) and layout
src/body.html    static page structure
src/data.js      all content: nodes, clouds, use cases, accuracy table, plan
src/app.js       synthetic meter data, interactions and charts (no libraries)
scripts/build.sh assembles src/ into index.html and dist/upro-platform.html
```

Edit content in `src/data.js`, then run `./scripts/build.sh`. Open `index.html` in a browser.
`dist/upro-platform.html` is the same page without the html/head wrapper, for publishing as a
claude.ai artifact.

## Notes

- Household data on the page is synthetic and generated deterministically in the browser.
- Pricing and business-case figures from the proposals are intentionally left out.
- Cloud service mappings for GCP, OCI and AWS are reference mappings, to be confirmed per deployment.
