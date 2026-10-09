#!/usr/bin/env bash
# Assembles src/ into dist/rfp-engine.html (artifact page content, no html/head wrapper)
# and index.html (standalone page for local viewing).
set -euo pipefail
cd "$(dirname "$0")/.."

JS_ORDER="core workspace style ai knowledge drive figma ingest pipeline views-a views-b canvas export sample app"
CDN='<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js"></script>'

{
  echo '<title>RFP Engine</title>'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Public+Sans:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&display=swap">'
  echo '<style>'; cat src/styles.css; echo '</style>'
  cat src/body.html
  echo "$CDN"
  echo '<script>'
  for f in $JS_ORDER; do echo "/* ---- $f.js ---- */"; cat "src/$f.js"; echo; done
  echo '</script>'
} > dist/rfp-engine.html

{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<style>html,body{margin:0}body{font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  cat dist/rfp-engine.html
  echo '</body></html>'
} > index.html

echo "Built dist/rfp-engine.html ($(wc -c < dist/rfp-engine.html) bytes) and index.html"
