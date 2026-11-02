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

## Native release build checkpoint

- Candidate `ab5c7365bf5760fe18d5ee1e1b6432dbb919b991` was pushed. Its [Pages deployment](https://github.com/chrzamz/carrythread/actions/runs/41521720484) passed, and the public four-language copy matched the source bytes.
- In [release build 41521730321](https://github.com/chrzamz/carrythread/actions/runs/41521730321), Linux passed core checks, packaging, unpacked GUI E2E, actual DEB installation, installed GUI E2E, and uninstall. Final artifact staging rejected the legitimate format-native architecture labels (`amd64` for DEB, `x86_64` for AppImage) because it required literal `x64`. The staging check now recognizes those exact format-specific labels while retaining architecture/signing validation; a new build run is required before distribution.
- Commit `73ee118fab16a886d0a606e54342482e92dbff63` passed [three-system core and site CI](https://github.com/chrzamz/carrythread/actions/runs/41523143092). Its native local macOS arm64 package passed both unpacked E2E and actual DMG copy → installed E2E → detach/cleanup; the app declares macOS 13.0 minimum.
- The earlier Windows package was built, but the first UI-button lookup timed out; the post-failure screenshot contained the normal main screen. This does not establish an application failure or a pass. The E2E driver now explicitly waits for its file navigation, preload bridge, synthetic profile and visible banner, and saves DOM diagnostics if it still fails. Its timeout and real click assertions are unchanged. Pending release runs were cancelled to avoid repeating the unexamined failure; a new native run is required.
- In [build 41524302102](https://github.com/chrzamz/carrythread/actions/runs/41524302102), both native macOS targets and Linux completed the full installer chain. Windows timed out in RAF-based `waitForFunction`, while direct evaluation immediately afterward found the bridge and a visible/focused, fully loaded window. Installed Playwright source confirmed its Electron launcher omits the background-scheduling switches used by its Chromium launcher. Windows CI tests now supply those same three switches; production window settings, the 30-second timeout, and real click assertions are unchanged. This is a bounded CI-environment correction to verify, not a claimed application fix or a proven single root cause.
- [Build 41527198330](https://github.com/chrzamz/carrythread/actions/runs/41527198330), commit `58adc3c852015d558d1acb519a1251d4216692d0`, passed all four native targets. Windows passed preflight, packaged and installed GUI E2E, actual NSIS installation and uninstall. Linux and both macOS architectures also passed their complete installer paths.
- Final local macOS integrity review found the unresigned bundle's inherited signature invalid, despite its local launch success. Explicit ad-hoc signing (`mac.identity: "-"`) fixes the bundle seal without developer certificates or notarization, retaining the builder's default hardened runtime and Electron entitlements. A separately rebuilt arm64 app passed strict deep signature verification and packaged E2E. Release gates now also verify the DMG-installed copy and extracted ZIP before publishing; the final tagged build must pass these new gates.
- The ad-hoc trial also passed actual DMG-copy GUI E2E and extracted-ZIP signature checks. A subsequent synthetic-key probe exposed an unbounded native-storage wait. Native key operations now have per-call deadlines, visible session-only fallback for newly supplied keys, preserved historical ciphertext on failed reads, and invalidation of late results. Provider changes block clearing until they settle, preventing metadata restoration after clear. The updated local candidate passed `pnpm check` with **117/117 tests** and the full source Electron E2E; its rebuilt packaged-key smoke and final tagged builds remain to be recorded.
