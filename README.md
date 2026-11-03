<p align="center"><img src="resources/brand/logo.svg" width="302" alt="Carrythread"></p>

# Carrythread · 续迹

**Keep the context. Carry the work forward.**

[简体中文](README.zh-CN.md) · [Website](https://chrzamz.github.io/carrythread/) · [Releases](https://github.com/chrzamz/carrythread/releases) · [Privacy](docs/PRIVACY.md) · [Contributing](CONTRIBUTING.md)

Carrythread is a local desktop workspace for people working across AI agents and projects. Read your existing conversation records, recover decisions and unfinished work, and prepare the context needed to continue in the tool you choose.

A completed response is not always a completed delivery. Carrythread keeps creation, testing, publication, and acceptance distinct, with evidence you can inspect and state you can correct.

> **v0.1.0 is available.** [Download for macOS, Windows, or Linux](https://github.com/chrzamz/carrythread/releases/tag/v0.1.0). These builds have no developer-identity signature; macOS bundles use ad-hoc signing and are not notarized. See the [checksums and verification record](docs/RELEASE-CHECKLIST.md) before installing.

## What it does

- **Read across tools:** local Codex, Claude Code, OpenCode, Pi, Finch, and explicit JSON/JSONL/Markdown imports.
- **Review actual work:** selected evidence becomes work items with decisions, current stage, uncertainties, completion criteria, and a next action.
- **Keep the evidence:** source excerpts, message references, dates, and coverage gaps remain visible.
- **Correct the record:** edit, merge, or split items. Manual overrides and paused or cancelled work are protected during later reviews.
- **Continue with context:** preview a registered handoff, choose a destination and working directory, then open, resume, launch, or copy using the available path. Re-import the resulting conversation to connect matching follow-up work to the original item.
- **Keep control of data:** local SQLite storage, explicit AI requests, your provider key or local model, and portable workspace exports without provider keys.

The interface and public website include **English, Simplified Chinese, Spanish, and Japanese**. Source text remains in its original language; AI review descriptions use the selected output language.

## Run from source

Requirements: **Node.js 24 or newer**, **pnpm 10.34.4** (pinned in `package.json`), and a desktop environment capable of running Electron.

```sh
git clone https://github.com/chrzamz/carrythread.git
cd carrythread
pnpm install --frozen-lockfile
pnpm dev
```

If pnpm is not installed, install the version named in the `packageManager` field using your preferred package-manager setup. Keep the lockfile; do not replace it with an unreviewed dependency refresh.

```sh
pnpm check       # Typecheck, focused tests, production build
pnpm build       # Build the desktop application
pnpm start       # Preview that build locally
pnpm package     # Build and package locally; never publishes
pnpm site:build  # Prepare the static website
```

v0.1.0 includes macOS DMG/ZIP, Windows NSIS/portable, and Linux AppImage/DEB downloads. Native packaged-app and DMG/NSIS/DEB installation tests passed for the four distributed targets; alternate wrappers and other limits are listed in the [platform matrix](docs/RELEASE-CHECKLIST.md#platform-evidence). Local packaging does not publish or provide developer signing/notarization.

## Installing a published build

Download [v0.1.0](https://github.com/chrzamz/carrythread/releases/tag/v0.1.0), choose your OS and architecture, and compare the file with [SHA256SUMS.txt](https://github.com/chrzamz/carrythread/releases/download/v0.1.0/SHA256SUMS.txt). The release includes platform build records and verification limits.

- **macOS:** the current package declares macOS 13.0 or later; checks on the development machine and CI macOS 15 do not cover every OS version. Open the downloaded DMG and drag Carrythread into Applications. This ad-hoc-signed, non-notarized build may be blocked on first launch. After verifying the source and checksum, macOS may offer **System Settings → Privacy & Security → Open Anyway** for that specific app. No global Gatekeeper disablement is required or recommended.
- **Windows:** download the matching NSIS setup executable and follow its installer. An unsigned build may trigger a publisher or SmartScreen warning; it does not carry a verified publisher signature. Inspect the official release and checksum before deciding to proceed. Portable-wrapper verification is listed separately.
- **Linux:** use the published DEB on a compatible Debian/Ubuntu system, through its package installer or `sudo apt install ./downloaded-package.deb` with the actual downloaded filename. AppImage runtime and normal sandboxed startup have their own verification status; CI's test-only `--no-sandbox` is not an installation instruction.

## First review

1. Open **Sources**. Detect known local history locations or explicitly select a source directory/file. Enable only what you intend to import.
2. Refresh sources and inspect the coverage report. Partial, inaccessible, unsupported, and empty sources are different states.
3. Open **AI connections**. Choose a preset or custom endpoint, enter a model and your key if needed, and run the synthetic connection test.
4. Choose **Review with AI**, preview the selected scope and related items, check the conversation selection and provider, then start. Selected messages, available session metadata, and associated existing work-item context are sent for reconciliation; the preview shows the related items.
5. Review the result. Keep suggestions as candidates, correct an unsupported conclusion, and use evidence before marking a delivery complete.
6. Prepare a handoff. Confirm the current instruction, target, and working directory, inspect the context file, and launch or copy it using the action shown.

Reviews use up to eight batches, each bounded to 120 messages and 60,000 characters of evidence. A selection beyond those limits is rejected before any network call; narrow the scope and try again.

A source refresh reads local files; it does not itself run an AI review. Optional automatic refresh is off by default and only refreshes enabled sources while the app is running.

## Source support and limits

| Source | Implemented reader | Current boundary |
|---|---|---|
| Codex | Local JSONL conversation/event records; mirrored entries deduplicated | Local records only. Unknown formats and unsupported files are reported. No claim to import every cloud or compressed-history format. |
| Claude Code | Project JSONL visible messages and supported user-answer records | No Claude web-account connection. Reasoning/system records are not treated as user work. |
| OpenCode | Legacy JSON, v1 SQLite, supported CLI-export JSON | Newer `session_message` table records are not parsed; detected content yields partial coverage. |
| Pi | Saved JSONL session formats v1–v3, including tree relationships | Synthetic format fixtures are covered; broader installed-version compatibility needs release-specific verification. |
| Finch | Native Pi-format logs, with runtime-v1 snapshots as fallback | Native logs win. Snapshots may lack event timestamps; those gaps are retained. |
| Generic | Explicit JSON, JSONL, or Markdown files | Importing a document is not proof of when its described events happened. |

The scanner operates on selected sources, refuses the filesystem/home root, skips symlinks and known credential/configuration paths, and reports parsing and size limits. It never edits the original histories or their databases. A removed source or a narrower scan window does not automatically erase previously indexed records; use the local-data controls when you want to clear the workspace.

## AI providers: bring your own credentials

Three protocols are implemented: **OpenAI-compatible chat completions**, **Anthropic Messages**, and **Ollama**. Presets include OpenAI, Anthropic, Google Gemini (OpenAI-compatible), OpenRouter, xAI / Grok, DeepSeek, Qwen / Alibaba Cloud Model Studio, GLM / Zhipu, Moonshot / Kimi, Doubao / Volcengine Ark, SiliconFlow, Ollama, and a custom endpoint. Presets are conveniences, not an endorsement or proof every hosted model is compatible.

The default hosted presets point to **ordinary API endpoints**. Carrythread does not log in through, reuse, or automatically switch to a ChatGPT, Claude, or vendor Coding Plan subscription. Choose the endpoint and credentials allowed for your account. Provider usage and billing belong to that provider.

Enter the exact model your account can use. Model-list discovery is optional; lack of a model-list endpoint does not invalidate a working manually entered model. Hosted endpoints require HTTPS; HTTP is allowed only for explicit localhost addresses. Redirects are not followed with your API key. Changing a connection's endpoint or protocol clears its old key; enter a key for the new destination deliberately. The xAI preset uses its Chat Completions compatibility path; Responses-only features are not implied.

The connection test sends a small synthetic prompt, not your imported conversations. It may still use provider quota. Actual review quality, model availability, and successful live-provider testing are separate from protocol unit tests.

## Handoff means a specific action

Reading a history file does not guarantee the original application can reopen it. Carrythread detects targets and prepares a bounded, redacted Markdown file with your current request, decisions, state, uncertainties, selected excerpts, and source pointers.

| Target path | Implemented behavior | What is not implied |
|---|---|---|
| Codex desktop on macOS | New-chat deep link with prompt; existing-thread deep link with context prompt copied | Opening/prefilling is not submission or confirmed reading. |
| Codex, Claude Code, OpenCode, Pi CLI | Launch a detected CLI in a terminal with new/resume arguments and a handoff prompt | A prompt argument may start execution. Native CLI version behavior must be verified; launch is not receipt. |
| Finch desktop on macOS | New-chat deep link; existing-chat deep link with copied context | New-chat links may start execution. Existing-chat context may require pasting. |
| Manual / other tools | Copy a handoff prompt and export Markdown | You choose how to attach or paste the material. |

Launching is an explicit action after the preview. Before first starting an agent task in a directory, confirm that directory through the native folder picker. Approved directories are remembered; imported `cwd` metadata is only a hint, not permission to launch there. Historical instructions do not become new authorization. If an item changes after a handoff is prepared, regenerate the package. If a target, session, or working directory is unavailable, use the manual export path rather than assuming delivery succeeded.

Portable context contains source pointers, not copies of every project file. On another computer, make the exported file and relevant project files available and verify the working directory.

### From a local record to a follow-up conversation

The chain is **local record → reviewed work item → registered context package → chosen agent → imported follow-up record**. Copy the complete continuation prompt: its first-line reference identifies a handoff registered in this local Carrythread workspace.

When the new user message is imported, Carrythread checks the marker's handoff ID, item ID, revision, and target against that registry. A valid reference can carry the current original item's decisions into a selected review even when the agent, conversation title, or directory has changed. It does not reopen an older item revision or add the unselected original conversation's messages to the request. New topics in the same conversation are not automatically the same task.

Keep the reference line intact when using the prepared prompt. Missing, altered, unknown, or assistant-quoted markers do not establish this link. The marker is continuity evidence—not new permission, a cryptographic receipt, or proof that the destination read the context file. Inspect the reconciled result and correct it when needed.

When available, session context includes the agent, title, a directory-name project hint, and a normalized workspace hash. This is optional source metadata, not a separate user-facing switch or a global project identity. A full working-directory path is not sent as that dedicated metadata field; message text and handoff files can still contain paths.

Workspace export does not include the local handoff registry. A context file remains readable on another computer, but importing it or a portable workspace alone does not recreate trusted marker associations there.

## Privacy and local data

Original histories are read-only. Carrythread stores its index, work items, corrections, settings, and prepared handoffs in its own local application-data directory. The workspace database is **not encrypted as a whole**. Provider keys use OS-backed encryption when available. Packaged macOS uses a same-signed short-lived helper over anonymous pipes, with no window, Store or network; presence display does not decrypt. Actual use retrieves the key, with bounded session-only fallback instead of plaintext persistence.

AI review is opt-in. Selected evidence, available session metadata, and the associated existing work context go to the provider you choose. A registered handoff can associate a new selected conversation with an existing item without uploading the unselected old conversation. Local Ollama can keep inference local. Redaction is a safeguard, not complete anonymization: names, project text, source paths, and other sensitive details can still appear in records and exports.

**Export workspace exports the whole indexed workspace**, including sessions, evidence, items, and their change history. It excludes provider settings/keys and prepared handoff records. Keep exports private. Clearing local Carrythread data does not delete original agent histories, previously exported files, or copies already sent to other tools/providers.

Read [Privacy / 隐私说明](docs/PRIVACY.md) and [Security / 安全报告](SECURITY.md).

## Development and contribution

Use synthetic fixtures and screenshots. Do not commit real conversations, customer information, credentials, or local runtime databases. Changes to parsers should disclose supported formats and preserve unknowns rather than inventing missing history.

See [Contributing](CONTRIBUTING.md), [Architecture](docs/ARCHITECTURE.md), [Product](docs/PRODUCT.md), and the [release checklist](docs/RELEASE-CHECKLIST.md). Website checks are available with `node site/check.mjs`.

The free core and possible future optional services are described in [Monetization](docs/MONETIZATION.md). No paid tier or hosted sync is implemented in the current scope.

## License

Carrythread's original code, documentation, and artwork are licensed under [Apache-2.0](LICENSE). Bundled dependencies retain their own licenses; see [NOTICE](NOTICE). Carrythread is independent of the agent providers it integrates with.
