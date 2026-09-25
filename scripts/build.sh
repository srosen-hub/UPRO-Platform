#!/usr/bin/env bash
# Assemble src/ into two outputs:
#   dist/upro-platform.html  page fragment (for claude.ai Artifact publishing, which adds its own skeleton)
#   index.html               standalone page (open locally or host anywhere)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
{
  echo '<title>UtilityAI Pro Platform</title>'
  echo '<meta name="description" content="Interactive overview of the Bidgely UtilityAI Pro platform: models, engines, APIs and MCPs deployed in the utility cloud.">'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">'
  echo '<style>'; cat src/styles.css; echo '</style>'
  cat src/body.html
  echo '<script>(() => {"use strict";'; for f in brand logos icons data mcp core stack engines models usecases cases ask init; do cat src/$f.js; echo; done; echo '})();</script>'
} > dist/upro-platform.html
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  cat dist/upro-platform.html
} > index.html
echo "built dist/upro-platform.html and index.html"
