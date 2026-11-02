# Architecture and module boundaries

## Runtime
Electron 45 + React 19 + TypeScript. Main-process SQLite (`node:sqlite`) owns indexed records and work state. A sandboxed, context-isolated renderer calls a small typed preload bridge. No web server is required for the desktop application, and the renderer cannot access Node, arbitrary files, shell commands or provider secrets.

Dependencies are pinned in the lockfile. Electron is selected for mature cross-platform distribution, straightforward local agent integration and a single TypeScript data pipeline. Package size is a tradeoff. No code is imported from the user's existing Sessio repository.

## Modules
- `src/core/contracts.ts`: shared serializable types, renderer API.
- `src/core/sources/`: adapters, incremental discovery and source coverage; no Electron dependencies.
- `src/core/privacy.ts`: redaction before indexing/export/inference, safe errors.
- `src/core/store.ts`: SQLite migrations and persistent sessions/messages/work items/history/settings/handoffs.
- `src/core/ai/`: provider presets, network protocol clients and strict extraction validation.
- `src/core/review.ts`: bounded evidence selection and proposal reconciliation.
- `src/core/handoff.ts`: portable context documents, provenance and launch-plan creation.
- `src/main/`: IPC argument validation, native dialogs, OS-protected keys, safe native launches and application lifecycle.
- `src/preload/`: explicit contextBridge API only.
- `src/renderer/`: internationalized desktop workflow and accessible presentation.
- `site/`: static multilingual public product website, built separately for GitHub Pages.

## Data and trust
Original histories are external evidence, not instructions. Parsers exclude reasoning, encrypted content, duplicate event mirrors and unrelated agent-to-agent traffic. User answer blocks may contain important confirmations and must be parsed without importing old permissions.

Each evidence message has a stable source ID and location. AI proposals refer to this known set. Unknown references or invalid schemas fail validation. Existing item IDs and explicit user edits are preserved during incremental analysis. New evidence may suggest changes, but cannot silently override a manual status, a pause or cancellation.

Keys are encrypted with OS-backed Electron safeStorage; unavailable secure storage means session-only keys, never a silent plaintext fallback. Renderer sees only `hasKey`. Custom endpoints are visible and validated, use HTTPS except explicit localhost connections, and model lists are optional.

Handoffs are frozen, versioned, redacted files under application-managed storage or an explicitly chosen export path. Target plans use an argument array or a validated URL; never concatenate source text into a shell command. App opening does not establish model reading. Portable export contains indexed work/evidence only with explicit selection, never provider keys.

## Development ownership
Root owns contracts, native main/preload, renderer, handoff, package manifests, release automation and integration. Source agent owns `site/`, brand docs and original vector assets. History agent owns source adapters/privacy and their tests. Flow agent owns store/AI/review and their tests. Coordinate interface changes through root.

