# Carrythread v0.1.0 — released

Goal: ship an open-source, multilingual desktop application and public product website for evidence-based cross-agent work review and context handoff.

[**v0.1.0 is public**](https://github.com/chrzamz/carrythread/releases/tag/v0.1.0), published 2026-11-03 at 04:14:41 UTC. Eight binaries, four build records, and five checksum files are uploaded. This is a normal release, not a draft or GitHub prerelease. Developer-identity signing and notarization are not provided.

## Original delivery goals

- [x] Independent open-source project and public repository.
- [x] Defined scenarios, delivery boundaries, Carrythread / 续迹 name and original brand assets.
- [x] Read-only Codex, Claude Code, OpenCode, Pi, Finch and generic adapters, with documented format limits.
- [x] Incremental local index, coverage reports, search and traceable evidence.
- [x] Selected-scope AI review, 13 provider presets and three protocols.
- [x] Persistent items, decisions, correction, merge/split, pause/cancel and history.
- [x] Previewable context packages, app/CLI/manual handoff and registered follow-up association.
- [x] English, Simplified Chinese, Spanish and Japanese UI; light/dark appearance.
- [x] Four-language public website, documentation, original logo and open-source monetization proposal.
- [x] Core/source checks and native packaged/installed E2E on all four distributed targets.
- [x] Versioned public downloads, build records and SHA-256 checksums.
- [x] Release evidence audit with explicit first-version limits, recorded in the [release ledger](docs/RELEASE-CHECKLIST.md).

## Final evidence

- Application/tag commit: `8be44946a94c8bdd13f3a0b8db5d094fc00a3fee` (`v0.1.0`). [Core CI 41574690615](https://github.com/chrzamz/carrythread/actions/runs/41574690615) passed: **130/130 tests**, typecheck/build, source E2E and site checks.
- [Native release run 41575726233](https://github.com/chrzamz/carrythread/actions/runs/41575726233) passed macOS arm64/x64, Windows x64 and Linux x64 packaging, unpacked GUI E2E, actual DMG/NSIS/DEB installation, installed GUI E2E, cleanup, production-fuse readback and draft gates.
- Release workflow commit: `adee0f32be24638063ca918814030a6c87ba4122`. This subsequent workflow-only change creates the diagnostic output directory; every artifact checks out the unchanged application tag above. Build records identify that application commit. The tag was not moved.
- macOS app, DMG copy and extracted ZIP passed strict ad-hoc signature checks with hardened runtime. Both Mac architectures passed encrypted key save/restart/localhost authentication, non-app-parent helper rejection and four normal exits without driver kill or forced cleanup. Windows/Linux native keystores were not exercised.
- The eight binary SHA-256 values match the published checksum files and GitHub asset digests. Anonymous HEAD requests returned HTTP 200 for all eight downloads, with Content-Length matching each release asset; `/releases/latest` resolved to v0.1.0, and the public checksum file matched its GitHub digest.
- The [public website](https://chrzamz.github.io/carrythread/) is deployed. Deployment and public verification of its final released-state copy remain pending; no earlier Pages run is claimed as that final check.

## First-version boundaries

The [release ledger](docs/RELEASE-CHECKLIST.md) is the authoritative compact record. Direct real API-key provider HTTP and real local Ollama inference remain unverified. A separate real-model continuity diagnostic used a Codex CLI bridge, not the shipped provider HTTP path. Human native-picker interaction, every native-agent launch/receipt path, end-user Gatekeeper/SmartScreen/quarantine, Windows portable execution, AppImage runtime and normal Linux sandboxed startup are not certified by CI.

Production fuses remain enabled. Linux fuse readback does not establish runtime ASAR-integrity support. The app database is not wholly encrypted; optional external AI receives selected evidence and related context. No cloud synchronization, paid tier, automatic publishing or general agent orchestration is shipped. All repository examples, test inputs and screenshots are synthetic.

## 中文

v0.1.0 已正式公开，原始交付目标已完成；未验证的兼容性和真实服务边界仍在[发布证据账本](docs/RELEASE-CHECKLIST.md#中文)中明确保留。应用标签固定为 `8be44946`，发布流程来自后续仅修正工作目录创建的 `adee0f32`，二者不混淆。最终网站发布文案的 Pages 部署与公网检查待负责人补录。
