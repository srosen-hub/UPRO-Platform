# RFP Engine

A single-page tool that turns a client's documents (RFP, RFI, security questionnaire, SOW request) and the team's
knowledge into a formatted, drafted response.
It runs as a claude.ai artifact: AI steps use the viewer's Claude account (`sample` capability), product images
come from a linked Figma file through the viewer's Figma connector (`mcp` capability), and files are saved with
the `downloads` capability. Outside claude.ai the page still opens, with AI, Figma and downloads turned off.

## Steps

1. **Inputs**: upload RFP files (PDF, DOCX, XLSX, CSV, TXT) and library files, link the Figma product library,
   add bid context, and set the voice and style rules.
2. **Requirements**: every requirement extracted with its source (file, page, RFP section), type, mandatory flag
   and response type. Matrix-style rows can be answered row by row with a confidence score.
3. **Format**: recommended structure, in this order of precedence: the RFP's mandated order, then the evaluation
   criteria, then a standard layout. Drag, rename, indent, merge, or describe a change in plain language. New client
   input (addenda, Q&A) is proposed as a list of changes: client input beats user edits, user edits beat the engine.
   Rejected client changes are logged as compliance risks.
4. **Outline**: per section, the requirements, key points, chosen library blocks with a usage mode (verbatim,
   tailored, synthesized), gaps, and suggested visuals and tables.
5. **Draft**: section by section, summaries last. Verbatim blocks go in word for word, locked blocks survive a redraft,
   and every passage keeps its sources.
6. **Canvas**: paper pages with draggable text, image, table and callout blocks, half and full width, page counts
   against limits, and working vs customer view.
7. **Export**: pre-export checks, then a clean customer .docx, an internal source map (.csv), matrix answers (.xlsx)
   and a project file (.json).

## Google Drive first

Every input and output prefers Google Drive (through the viewer's Google Drive connector); uploads and downloads
are the fallback.

- **In**: client documents (pick files or the whole RFP folder), library files and folders, non-product images, the
  style guide, pinned team sources and project files, through a Drive picker with recent files, search, folder
  browsing and pasted links.
- **Current**: "Check Drive for updates" re-reads changed files. Library passages keep their ids when their heading
  is unchanged; a changed client document is read again and goes through the format change review.
- **Out**: the response is saved as a Google Doc, the source map and matrix answers as Google Sheets, and the
  project file as JSON, optionally into a chosen folder.
- **Auto start**: adding client documents reads them, fills the client and scope from them, and pulls the bid
  context from Salesforce and meeting notes for review.

## Knowledge sources

- **Uploads**: library files, each with a trust tier (approved, product thinking, past response, reference, discussion).
- **Company search** through the Glean connector (Drive, Confluence, Slack, email, meeting notes). Each section is
  researched when it is outlined; with tool use, Claude runs its own searches, otherwise one search per requirement.
- **Pinned team sources** (RFP library, boilerplate, roadmaps) are read in full, cached, and searched first.
- **Salesforce** (read-only connector) and meeting notes fill the bid context, with a review step before anything
  is written.
- Retrieval filters by topic, matches on requirement text, then weighs trust tier and freshness. Conflicting sources
  are listed on the outline. Roadmap items and facts from discussions are marked `[CONFIRM: ...]` and block export.

## Team workspace

Style guide, knowledge sources and templates are shared through the artifact database: editors change them, everyone
else reads them, and every project uses them. Outside claude.ai they are kept in the browser.

## Voice and style

The team style guide (tone, writing rules, formatting conventions, terminology, approved facts, banned phrases, a
sample of past writing) is sent with every drafting request. It can be imported from a file or a link. A checker flags banned phrases, dashes, rhetorical questions, uniform sentence rhythm, mentions of AI and
internal ids. "Fix style" rewrites flagged passages, and the export check blocks until they are resolved. The .docx
carries the company name as author and no tool metadata.

## Images

Product visuals come only from the linked Figma library (each image in its own top-level frame on a library page).
They are re-pulled from Figma at export, and frames removed from the library are flagged. Other images (team photos,
maps, org charts) can be uploaded.

## Structure

```
src/styles.css    tokens (light and dark) and layout
src/body.html     page shell
src/core.js       model, numbering, coverage, sanitizer, persistence (IndexedDB)
src/workspace.js  team style guide, sources, templates (shared through db)
src/knowledge.js  Glean search and reading, research, pinned sources, Salesforce bid context
src/drive.js      Google Drive picker, reading, refresh and saving
src/style.js      voice and style rules, checker, restyle pass
src/ai.js         Claude access and every prompt
src/figma.js      Figma library sync through the connector
src/ingest.js     file readers, library chunking, retrieval (tag filter, then BM25)
src/pipeline.js   extract, recommend format, format ops, outline, draft, matrix
src/views-a.js    app bar, step rail, Inputs, Requirements, Format
src/views-b.js    Outline, Draft, Export, source drawer, modals
src/canvas.js     canvas view, drag and drop, page measurement
src/export.js     .docx, .csv, .xlsx and project files
src/sample.js     example project (made-up utility and vendor)
src/app.js        rendering, actions, startup
scripts/build.sh  assembles dist/rfp-engine.html (artifact) and index.html
```

Run `./scripts/build.sh` after editing anything in `src/`.
