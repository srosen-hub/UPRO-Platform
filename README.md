# UtilityAI Pro Platform Overview

Interactive, single-page overview of Bidgely UtilityAI Pro, built from the concepts in the
Southern Company SOW (Sep 2026) and the Con Edison enterprise proposal (Sep 2026), generalized
so it can be shown to any utility.

## What's on the page

1. **Platform stack** (top of page): an isometric stack of the five layers (data foundation in your
   lake, core ML models, engines, APIs/MCPs/apps, applications and agents) standing on your cloud
   tenant. Pick the cloud (Azure, Google Cloud, AWS, Oracle Cloud) and data lake (Databricks,
   Snowflake, cloud-native) to relabel it. Click a layer to list its components; click a model to
   open its deep dive.
2. **Model deep dives**: eight tabs with interactive visuals on a synthetic household.
3. **Use cases & MCP**: twelve use cases, each with its own interactive visual, a "Connect it to
   Claude" panel (Claude app, Claude Code, other agents) with copyable server URL and command, a
   replayable Claude conversation showing the MCP tool call, the recipe, and how it runs.
4. **Deployment**: cloud + data lake service mapping and the security model.

Light theme with Bidgely navy #04121f and Bidgely blue #29abe2, Sora + Manrope, and three text
sizes (`--fs-1`, `--fs-2`, `--fs-3` in `src/styles.css`).

## Structure

```
src/styles.css   design tokens (light + dark) and layout
src/body.html    static page structure
src/logos.js     cloud and data platform marks (Simple Icons)
src/data.js      content: environments, platform nodes and layers, use cases, accuracy table
src/mcp.js       MCP servers and the sample Claude conversation for each use case
src/core.js      helpers, synthetic household data, SVG chart helpers
src/stack.js     environment picker and the isometric platform stack
src/models.js    model deep dives
src/usecases.js  use case tabs, per-use-case visuals, MCP connect panel and chat replay
src/deploy.js    deployment mapping
src/init.js      startup and resize handling
scripts/build.sh assembles src/ into index.html and dist/upro-platform.html
```

Edit content in `src/data.js`, then run `./scripts/build.sh`. Open `index.html` in a browser.
`dist/upro-platform.html` is the same page without the html/head wrapper, for publishing as a
claude.ai artifact.

## Notes

- Household data on the page is synthetic and generated deterministically in the browser.
- Pricing and business-case figures from the proposals are intentionally left out.
- MCP server URLs are placeholders (`upro.your-utility.com`) and tool names are illustrative.
- Cloud service mappings for GCP, OCI and AWS are reference mappings, to be confirmed per deployment.
