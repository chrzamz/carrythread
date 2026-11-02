# Carrythread v0.1.0 progress

Goal: ship an open-source, multilingual desktop application and public product website for evidence-based cross-agent work review and context handoff.

## Release requirements
- [x] New isolated project directory and version-control repository created.
- [x] High-frequency scenarios and product boundaries established.
- [x] Carrythread / 续迹 name selected after lightweight collision checks.
- [x] Real read-only adapters: Codex, Claude Code, OpenCode, Pi, Finch, generic import (documented schema limitations).
- [x] Incremental local indexing, source coverage, search and traceable evidence (file cache, not persistent byte cursors).
- [x] AI extraction with 13 international/domestic/local/custom presets and three protocols.
- [x] Persistent work items with corrections, decision provenance, merge/split, pause/cancel and change history.
- [x] Context package preview/export and capability-aware app/CLI handoff; external receipt never inferred.
- [x] English/Chinese/Spanish/Japanese desktop UI, source diagnostics, handoff text and light/dark themes.
- [x] Original logo, four-language product website, documentation and open-source commercial proposal.
- [~] End-to-end, privacy, import, provider, migration and packaging checks; final-head cross-platform run pending.
- [~] Public GitHub source and website deployed; first CI passed. Versioned downloadable release pending.
- [ ] Final requirement-by-requirement release audit.

## Work allocation
- Root: architecture/contracts, desktop IPC/security, renderer, integration, QA and release.
- Source agent: naming, original vector identity and multilingual marketing website.
- History agent: read-only source adapters, credential filtering, synthetic fixtures and adapter tests.
- Flow agent: persistence, provider clients, AI review reconciliation and core tests.

## 2026-11-03 — initialization history
Repository was initialized in a new `carrythread` directory. Existing Sessio inspected for context only; new product has its own source and scope. No private conversation records have been copied. At that initial checkpoint, GitHub account access was available but the public repository had not yet been created. Native Sites tools were unavailable, so GitHub Pages was selected. The later public-repository and site results are recorded below.

Electron 45.2.1 and dependencies were installed, and native SQLite was checked. Shared contracts, security, settings, handoff and UI were incomplete at that early checkpoint; this historical paragraph is superseded by the integration and freeze checkpoints below.

## Integration checkpoint
- First public commit: `efb6f6c21e954c61639b38fb3ab133135715efc8`, repository `https://github.com/chrzamz/carrythread`.
- First CI succeeded on Linux/macOS/Windows core checks and macOS source Electron E2E: https://github.com/chrzamz/carrythread/actions/runs/41499244785 . Later hardening changes still require a new run.
- GitHub Pages enabled after its initial configuration failure. Re-run succeeded: https://github.com/chrzamz/carrythread/actions/runs/41499244628 . Public site: https://chrzamz.github.io/carrythread/ . Site remains labelled pre-release until downloadable artifacts are verified.
- Local source and a locally generated macOS arm64 DMG application passed import → synthetic HTTP provider → AI review → human pause correction → handoff file/copy → four-language and dark-mode checks. This was a localhost test endpoint, not a paid model or a claim that an external agent read the file.
- Independent audits fixed selected-scope leakage, old-key reuse after endpoint changes, remote Ollama privacy labelling, native session option injection, partial-secret truncation, and missing cross-project batching.
- The extended local source E2E subsequently passed repeat-review protection, cancellation, unchanged originals, restart persistence, portable export/clear/import, clipboard, four languages and dark appearance. A synthetic Claude-format follow-up linked to the original item: 2 imported sessions, 1 item, 5 localhost provider requests, zero page errors. The source-picker test stubs the native dialog return while exercising real UI→IPC; human interaction with an OS picker is not certified. No native agent was started by this E2E.
- Release workflows include separate unpacked-runtime and actual DMG/NSIS/DEB installation/E2E/cleanup gates. Their latest-head cross-platform runs are still pending; workflow code alone is not a pass.
- All published code and media use synthetic examples. Runtime data, local transcripts, provider credentials and work snapshots remain excluded.


## Release freeze checkpoint — 2026-11-03

- The frozen local candidate passed `pnpm check`: typecheck, build, and 109/109 tests, including four added continuity-tolerance regressions. The updated real Electron E2E passed again with a mock that deliberately omitted `existingId`: it retained the original item, avoided duplicates, and preserved the manual pause. Cross-platform checks must run against the final submitted head.
- Continuity now uses local records → reviewed items → registered handoff files/prompts → imported follow-up records. Only markers validated against the local registry provide explicit cross-agent/item links. Optional source metadata carries titles, agent identity, directory-name hints, and workspace hashes; full cwd is not a dedicated review-context field. A link is not permission or proof that an agent read the file.
- A bounded real-model diagnostic through the bundled Codex CLI bridge passed once in 35.1 seconds. With agent/title/workspace changed and manual override disabled, the original `runReview` path reused the existing item ID, retained decisions, validated new evidence, avoided duplicates, and did not mark unaccepted work done. This is not direct provider-key HTTP validation or a new subscription-login feature in the app.
- A separate earlier bundled-CLI diagnostic read a synthetic handoff and returned its exact nonce/project/state. It establishes receipt for that diagnostic only, not every desktop deep link or handoff.
- Native macOS safeStorage was exercised with a synthetic key: encrypted restart persistence, endpoint/protocol key clearing, key-free export, and removal passed. No real credentials or unrelated keychain entries were used. Other platform backends remain release-specific checks.
- The attempted isolated Ollama check did not start inference or download/load a model because startup was blocked in its constrained test environment. No local-model semantic result or direct hosted-provider HTTP pass is claimed.
- The final narrow fix handles a proposal citing the registered marker user message while omitting `existingId` after a title change. It attaches only the uniquely linked, directly evidenced item; unrelated topics in the same session remain separate. The added regressions and updated source E2E passed. The test launch is inside cleanup protection so failed starts still clean up.
- Downloads remain **pre-release**. Earlier source CI and Pages deployment are real completed checkpoints, while the latest source, packaged-runtime, installer, signing, and public-download evidence must be recorded separately.
