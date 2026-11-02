# Architecture and module boundaries

## Runtime
Electron 45 + React 19 + TypeScript. Main-process SQLite (`node:sqlite`) owns indexed records and work state. A sandboxed, context-isolated renderer calls a small typed preload bridge. No web server is required for the desktop application, and the renderer cannot access Node, arbitrary files, shell commands or provider secrets.

Dependencies are pinned in the lockfile. Electron is selected for mature cross-platform distribution, straightforward local agent integration and a single TypeScript data pipeline. Package size is a tradeoff.

## Modules
- `src/core/contracts.ts`: shared serializable types, renderer API.
- `src/core/sources/`: adapters, incremental discovery and source coverage; no Electron dependencies.
- `src/core/privacy.ts`: redaction before indexing/export/inference, safe errors.
- `src/core/key-storage.ts`: bounded credential operations, session-only fallback, stale-result invalidation and key-presence metadata.
- `src/main/mac-key-storage.ts`: packaged macOS credential helper, validated app-parent identity and anonymous-pipe transport; no window, Store or network.
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

Keys use OS-backed Electron safeStorage through the native credential path. In packaged macOS builds, the main process delegates bounded credential operations to a same-signed, short-lived helper over anonymous pipes. The helper creates no window, Store, or network client. Other runtime paths use the main-process backend. Saved secrets are not returned to the renderer. Presence/storage-status display does not decrypt; real connection or review use retrieves the key. A failed or timed-out backend falls back visibly to session-only storage for newly supplied keys, preserves existing ciphertext on failed reads, and ignores late results. Custom endpoints are visible and validated, use HTTPS except explicit localhost connections, and model lists are optional.

Handoffs are frozen, versioned, redacted files under application-managed storage or an explicitly chosen export path. Target plans use an argument array or a validated URL; never concatenate source text into a shell command. App opening does not establish model reading. An explicit whole-workspace export contains indexed work/evidence/history, never provider keys or the local handoff registry.

## Development ownership
Root owns contracts, native main/preload, renderer, handoff, package manifests, release automation and integration. Source agent owns `site/`, brand docs and original vector assets. History agent owns source adapters/privacy and their tests. Flow agent owns store/AI/review and their tests. Coordinate interface changes through root.


## Production runtime hardening and tests

Builder-managed fuses are applied before signing: `runAsNode=false`, `enableNodeOptionsEnvironmentVariable=false`, `enableNodeCliInspectArguments=false`, `onlyLoadAppFromAsar=true`, and `enableEmbeddedAsarIntegrityValidation=true`. Node-options disabling also disables `NODE_EXTRA_CA_CERTS`. ASAR remains enabled. macOS packages use explicit ad-hoc signing; this is not Developer ID signing or notarization.

Embedded ASAR runtime validation is supported on macOS with Electron 16+ and Windows with Electron 30+. This project uses Electron 45. Linux fuse bytes can be read, but Linux runtime ASAR integrity is not claimed. Verify the final binary's fuse values and signature/ASAR properties rather than treating configuration as proof.

`tests/e2e.ts` runs the source/development Electron driver. Its native-dialog result stub exercises UI→IPC but is not manual picker acceptance. `tests/packaged.e2e.ts` starts the actual production executable and drives renderer Chromium CDP; it does not use Node inspector or a main-process test hook. It exercises normal production fuses, synthetic records and a localhost HTTP model endpoint. Its macOS key path tests real encrypted save/restart/authentication; a synthetic HTTP response is not live model inference.

## 中文：密钥与生产包边界

密钥不再严格只经过主进程：macOS打包版由主进程通过匿名管道调用同签名短命helper，后者不创建窗口、Store或网络客户端。显示密钥是否存在不解密，实际连接或回顾时才读取；原生调用失败/超时可见地退回会话密钥，不落明文，旧密文不因读取失败丢失。

五项生产fuse关闭Node模式、Node环境注入和Node inspector，限制从app.asar加载，并开启支持平台的嵌入式完整性验证。支持起点是Electron版本：macOS为16+、Windows为30+；Linux不能据Enabled位声称已有运行时ASAR完整性。当前mac包是ad-hoc签名，非开发者身份签名/公证。

source E2E使用开发运行时，原生对话框返回值可stub；packaged E2E使用实际生产程序和renderer CDP，不使用Node inspector或主进程testhook。两者的结果不能互相冒充。
