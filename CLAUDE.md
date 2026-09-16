# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This is a coursework repo (ENTP 6314) containing small, standalone demo web pages — not a single application. There is no build system, package manager, test suite, or linter (no `package.json`). Each subfolder is an independent, self-contained `index.html` with all CSS and JavaScript inlined in the one file (vanilla JS, no frameworks, no external dependencies).

Current subfolders (at the repo root, one level up from this file):
- `Session2_BadPrompt/` and `Session2_DetailedPrompt/` — two versions of the same "Tip Splitter" tool, built from a minimal prompt vs. a detailed prompt, used to compare AI-prompting outcomes. `Session2_DetailedPrompt` is the more feature-complete version (uneven per-person splits, rounding, copy-to-clipboard).
- `demo-app/` — a minimal single-page demo intended for deployment via Vercel.
- `ENTP6314ProjectA/` — this project. Contains `vacation-scheduler/`, a simple vacation-scheduling page built as separate `index.html` / `style.css` / `script.js` files (not inlined, unlike the pattern below) with data persisted via `localStorage`.
- `practice/` — currently an empty placeholder directory.

## Working with this repo

- Each `index.html` is fully self-contained: open it directly in a browser to preview (no dev server required). If a local server is preferred (e.g. for testing relative paths), any static file server works, e.g. `npx serve .` or `python -m http.server`.
- There is no build, lint, or test command — verify changes by opening the page in a browser and exercising the UI.
- When adding a new demo, follow the existing pattern: one folder per demo, with a single self-contained `index.html` (inline `<style>` and `<script>`, no external build tooling) unless the user asks for something else.
- `demo-app` is deployed via Vercel directly from this repo; treat changes there as user-facing/deployed.

## Rules
Explain changes in pain English. I am not a programmer.
- Prefer the simplest solution that works.
- Ask before adding any new service or library.
- Commit automatically at the end of each phase. Don't ask, don't just remind.
- Never leave the ENTP 6314 folder.