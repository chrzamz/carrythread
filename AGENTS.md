# Carrythread development

Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `design/visual-system.md`, and `PROGRESS.md` before changing scope or interfaces.

## Product invariants
- This is a real local desktop application, not a sample dashboard. Sample mode is explicitly labelled and never mixed with imported work.
- Original agent histories are read-only. Never edit their SQLite databases or JSONL files.
- No private user transcripts, customer names, credentials, local account paths, or generated review snapshots belong in this repository. Tests and screenshots use synthetic fixtures.
- AI analysis is opt-in for an explicit selection. Saved provider keys are confined to the native credential path: the main process plus a same-signed, short-lived helper in packaged macOS builds, using anonymous pipes. The helper creates no window, Store, or network client. Key-presence display never decrypts; retrieve a key only for actual use. Unavailable or timed-out storage falls back visibly to session-only keys, never plaintext persistence; no telemetry.
- Preserve evidence IDs, dates, user corrections, paused/cancelled states, and unknown outcomes. Agent completion does not prove deployment or customer acceptance.
- Handoffs use a previewable, redacted context file. Opening, pre-filling, submitting, and confirmed reading are distinct states. Never claim receipt without evidence.
- English and Simplified Chinese are release requirements for all interface text, errors, onboarding, privacy and core documentation. Spanish and Japanese are planned in the v1 translation catalogue and must pass key parity if shipped.
- Source adapters must disclose incomplete coverage and unsupported formats. Never infer that an unread source had no activity.

## Collaboration
- Shared contracts live in `src/core/contracts.ts`. Coordinate contract changes before editing another agent's module.
- Root owns integration, renderer, packaging, release, and version control. Subagents own their assigned paths only.
- Use `jj` for version control. Never include another project's files or private runtime data.
- Current user has authorized development, a new public GitHub repository, and release. Do not re-request ordinary implementation approvals.
- Update `PROGRESS.md` with actual checks and remaining work. Green unit tests are not a release audit.
- Production packages disable RunAsNode, NODE_OPTIONS and Node inspector fuses, require app.asar, and enable embedded ASAR integrity where Electron supports it (macOS/Windows; do not claim Linux runtime integrity). Do not weaken these to make packaged tests pass. Source E2E may use the development Electron driver; packaged E2E must use renderer CDP without Node inspector or main-process test hooks.
- Run focused tests for behavior changes, then the release checks. Do not hide failures, replace real adapters with fixtures, or call an unsigned artifact notarized.

## Commands
`pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm package`, `pnpm site:build`.

