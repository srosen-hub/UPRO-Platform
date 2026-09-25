# UtilityAI Pro Platform Overview

Interactive, single-page overview of Bidgely UtilityAI Pro, built from the concepts in the
Southern Company SOW (Sep 2026) and the Con Edison enterprise proposal (Sep 2026), generalized
so it can be shown to any utility.

## What's on the page

1. **Platform stack**: an isometric stack of four layers, each with its own look (data foundation in
   your lake, core ML models, engines + APIs + MCPs, apps and agents), wired up to Claude, ChatGPT,
   Copilot and Gemini at the top. Pick the cloud and data lake to relabel it. Click a layer to list
   its components; click a model or an engine/API/MCP to open its deep dive. A Full screen button
   expands the platform view.
2. **Ask the model outputs**: a demo of questions answered from (synthetic) model outputs, each
   with the outputs it queried and a result table. The header search bar feeds the same chat. In the claude.ai viewer it
   answers live through the artifact `sample` capability (the viewer's Claude account); elsewhere
   the suggested questions return prewritten answers.
3. **Use cases**: a grid of cards. Opening one shows its visual (CSR desktop, customer app, email,
   agent automation run, or chart), a "Connect to your AI tools" panel with setup for Claude,
   ChatGPT, Copilot Studio, Gemini and developers, a replayable conversation showing the MCP tool
   call, and the recipe with icons.

AI-forward light theme: aurora gradients, glass surfaces, Bidgely navy #04121f and Bidgely blue
#29abe2, the official Bidgely logo, Sora + Manrope, and three text sizes (`--fs-1`, `--fs-2`,
`--fs-3` in `src/styles.css`).

## Structure

```
src/styles.css   design tokens (light + dark) and layout
src/body.html    static page structure
src/brand.js     Bidgely logo (from the official logo PNG) as a data URI
src/logos.js     cloud, data platform and AI assistant marks (Simple Icons)
src/icons.js     line icons and the keyword picker for recipe items
src/data.js      content: environments, platform nodes and layers, use cases, accuracy table
src/mcp.js       MCP servers and the sample Claude conversation for each use case
src/core.js      helpers, synthetic household data, SVG chart helpers
src/stack.js     environment picker and the isometric platform stack
src/models.js    model deep dives (shown in a dialog)
src/engines.js   engines, APIs and MCPs explorer (dialog)
src/usecases.js  use case cards, visuals and automations, MCP connect panel and chat replay
src/ask.js       Ask UtilityAI Pro chat (sample capability with prewritten fallback)
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
