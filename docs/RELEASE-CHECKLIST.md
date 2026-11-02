# v0.1.0 release checklist

[中文](#中文)

This is the release evidence ledger. Record the tested commit, OS/architecture, command, artifact, and result. A checkbox without evidence does not establish release readiness. Update this file when the final release audit changes the status below.

**Current status:** pre-release freeze. Recorded local/source/model diagnostics are listed below; the final local candidate passed 109/109 tests, typecheck/build, and updated Electron E2E; latest-head cross-platform builds still await execution. No public binary, completed latest-head CI installer run, direct provider-key HTTP pass, or signing result is claimed.

## Evidence currently recorded

| Area | Status at documentation handoff | Evidence / limit |
|---|---|---|
| Core implementation | Present | Local adapters, SQLite work state, AI protocols, reconciliation, edits/merge/split, and handoff planning/launch paths exist. |
| Core checks | Earlier CI and local checkpoint passed | [Initial three-system CI](https://github.com/chrzamz/carrythread/actions/runs/41499244785) passed. Frozen local candidate: 109/109 tests, typecheck and build, including four continuity-tolerance regressions. Final-head cross-platform CI remains pending. |
| Static website | Checked locally | `node site/check.mjs`: 4 languages × 198 translation leaves, 1440/1100/390/360 widths, keyboard tabs, project selection, copy, language-state preservation, relative GitHub Pages subpath, identical SVG assets, no page errors. |
| Site visual review | Checked locally | English/Spanish desktop and Chinese/Japanese mobile synthetic walkthrough screenshots inspected. |
| Local macOS source end-to-end | Passed at recorded checkpoint | Real Electron + synthetic localhost HTTP: 2 sessions → 1 item, 5 provider requests, cross-agent follow-up association, pause protection, cancellation, restart, export/clear/import, clipboard, four languages and dark appearance; zero page errors. `nativeAgentStarted=false`. Native picker return is stubbed, with real UI→IPC. Final local rerun also passed with the model deliberately omitting `existingId`; the uniquely linked original item and pause remained intact. |
| Remaining end-to-end boundaries | Pending | Human native-picker interaction, all target-app launch/receipt paths, and latest-head cross-platform packaged/installer runs require separate evidence. |
| Real-model continuity diagnostic | Passed, limited route | One 35.1-second synthetic test through bundled Codex CLI bridged a real model into `runReview`; agent/title/cwd changed, manual override off, existing ID and decisions retained, exact evidence validated, no duplicate or false done. It did not test ordinary provider-key HTTP. |
| Native handoff diagnostic | Passed, limited route | A bundled Codex CLI read the synthetic file and returned its nonce/project/state. This does not certify all app deep links or a general receipt callback. |
| Direct provider HTTP / local Ollama | Unverified / not completed | No real API-key HTTP pass. The isolated Ollama attempt stopped before model download/load or inference; no semantic local-model pass. |
| macOS key storage | Passed with synthetic key | Real Electron safeStorage encrypted restart, endpoint/protocol clearing, export exclusion and test-provider removal passed. Other OS backends remain unverified. |
| Unpacked packaged-app GUI E2E | Workflow added; runs pending | Release builds locate the actual app and run the isolated synthetic E2E on four native targets. Record actual results below; workflow presence is not a pass. |
| Installer installation | Workflow added; CI runs pending | Actual DMG mount/copy, NSIS silent install, and DEB apt install each have installed-app E2E plus cleanup gates. Presence of the workflow is not evidence of passing. |
| Local macOS DMG check | Passed as reported | Release owner mounted the DMG read-only and ran E2E from its app. The new CI copy/install/cleanup path still needs its own run. |
| End-user prompts / alternate wrappers | Pending | Gatekeeper, SmartScreen, download quarantine, AppImage runtime, and Windows portable wrapper remain separate surfaces. |
| Public source repository | Published | [chrzamz/carrythread](https://github.com/chrzamz/carrythread); public push reported by release owner. |
| Public website | Earlier deployment verified | [Pages run](https://github.com/chrzamz/carrythread/actions/runs/41499244628) succeeded; [public site](https://chrzamz.github.io/carrythread/) remained pre-release. Final copy changes need their own deployment check. |
| Public binary release | Pending | Verify actual assets and the final release notes before changing download status. |

## Platform evidence

A configured target is not an available or verified artifact. Replace each pending result with evidence, or explicitly state that a target is not distributed in this release.

| OS / architecture | Targets | Artifact + checksum | Unpacked packaged GUI E2E | Installer installation | Native-agent receipt | Signing / notarization |
|---|---|---|---|---|---|---|
| macOS arm64 | DMG, ZIP | Pending | Pending | Pending | Pending | Unsigned distribution; not notarized |
| macOS x64 | DMG, ZIP | Pending | Pending | Pending | Pending | Unsigned distribution; not notarized |
| Windows x64 | NSIS, portable | Pending | Pending | Pending | Pending | Unsigned distribution |
| Linux x64 | AppImage, DEB | Pending | Pending; CI uses test-only no-sandbox | Pending, including AppImage runtime | Pending | Unsigned distribution |

For each distributed artifact, record its exact filename, SHA-256, build commit, build environment, minimum OS assumptions, and any known launch limitations. The release workflow records `sourceE2E` and `packagedE2E` independently. A successful unpacked-app GUI test does not validate installation. The separate installer workflow requires successful setup, installed-app E2E from a distinct path, and cleanup before recording `installerInstallation: passed`. AppImage execution and the Windows portable wrapper remain separate. Cross-building does not replace installing on the target OS.

## Core and data boundaries

- [ ] `pnpm install --frozen-lockfile` works from a clean checkout with the pinned pnpm and supported Node version.
- [ ] `pnpm check` passes on the release commit; final commands and test count are recorded.
- [ ] Import all claimed formats using synthetic fixtures; compare selected real-format structures separately without committing private data.
- [ ] Codex event mirrors do not create duplicate evidence; user-answer records and real event timestamps are preserved where supported.
- [ ] OpenCode v2 `session_message` and unknown schemas are reported as partial/unsupported rather than silently omitted as successful coverage.
- [ ] Finch native history takes precedence over runtime snapshots; missing timestamps remain explicit.
- [ ] Oversized, inaccessible, symlinked, incomplete, and credential/configuration paths produce safe coverage outcomes.
- [ ] Original JSONL and SQLite histories are unchanged after import, review, export, and clearing Carrythread data.
- [ ] Manual corrections survive incremental review. Paused/cancelled items do not reappear as fresh active duplicates.
- [ ] Invalid AI schemas, invented evidence IDs/quotes, and unsupported completion claims fail safely.
- [ ] Review context includes only selected messages, available selected-session metadata, and evidence/registered-handoff-linked existing items; unrelated items or unselected original conversation messages do not escape scope.
- [ ] A valid first-line marker user message can reconcile the intended item across agent/title/cwd changes. Unknown, forged, assistant-quoted, conflicting, or wrong-target markers do not establish a link.
- [ ] Cover a model omitting `existingId` while citing a valid marker user message; do not attach unrelated new topics in the same session.
- [ ] Workspace hashes are equality hints, not global project identity; missing metadata and cross-device registry limits are visible.
- [ ] Empty, failed, cancelled, and partial reviews remain understandable and do not erase healthy existing work.
- [ ] Workspace export/import retains evidence and history, excludes keys/provider settings/handoff records, and does not silently overwrite local item edits.
- [ ] Clear-data behavior matches privacy documentation, including app-managed handoffs and session-only keys.

## AI connection and review

- [ ] Verify each shipped protocol path: OpenAI-compatible, Anthropic Messages, and Ollama.
- [ ] Record which live providers/models/endpoints were actually tested. Label untested presets, regions, and models as unverified.
- [ ] Synthetic connection testing sends no user evidence and produces a useful success/failure message.
- [ ] Normal API presets and provider billing boundaries are visible; no subscription/Coding Plan login reuse is implied.
- [ ] Manual model entry works without a model-list endpoint.
- [ ] Authentication errors, quota limits, timeout, cancellation, invalid response, and output limits preserve existing work.
- [ ] Preview review scope; verify 120-message / 60,000-character batches, maximum eight batches, and over-limit rejection before the first network request.
- [ ] Changing endpoint or protocol clears the previous key and cannot send it to the new destination.
- [ ] HTTPS/local-HTTP validation and redirect refusal protect credentials; errors do not echo keys or request bodies.
- [ ] Native key storage is tested across restart. No secure backend means a visible session-only key, never plaintext persistence.

## Desktop end-to-end and handoff

- [x] Recorded local macOS source E2E: synthetic import, selected localhost-model review, registered follow-up association, manual pause, repeated review, cancellation, restart, export/clear/import, clipboard, four languages and dark appearance. No native agent started; picker return was stubbed.
- [x] Final local candidate rerun after continuity-tolerance changes: `pnpm check` passed 109/109 and updated real Electron E2E passed.
- [ ] Run CI/build/packaged/installer checks against the final submitted head; do not transfer earlier platform results to it.
- [ ] Record packaged GUI E2E against the discovered executable for macOS arm64/x64, Windows x64, and Linux x64. Preserve isolated synthetic results; never run against personal app data.
- [ ] Record the actual installer path for each native target: DMG mount/copy, NSIS silent installation, or DEB package installation. Verify the E2E executable differs from the unpacked path, run with isolated synthetic app data, and confirm detach/uninstall/cleanup.
- [ ] Separately complete native source-picker, search, evidence navigation, end-user installation prompts/quarantine, AppImage runtime, and Windows portable-wrapper checks. A CI silent-install pass does not prove these paths.
- [ ] For Linux, record the CI-only `--no-sandbox` limitation and separately verify normal sandboxed startup / AppImage runtime.
- [ ] Correct an item, merge two matching items, split one item, pause/cancel an item, then review new evidence without losing those decisions.
- [ ] Prepare a handoff and inspect goal, confirmed decisions, current state, open questions, and references.
- [ ] Verify a real supported destination reads the intended package when explicitly asked; do not infer reading from window creation.
- [ ] First task launch in a directory requires native folder-picker confirmation; imported `cwd` is not trusted as launch authorization. Verify the remembered-directory path separately.
- [ ] Distinguish open, prefilled, execution-triggering, submitted, and receipt states in wording. Native CLI and Finch-new paths may start work.
- [ ] Test missing CLI/app, stale package, mismatched session, missing cwd, special characters, cancelled native dialogs, and failed target launch.
- [ ] Existing-session copy paths explain the required paste; manual export works without the target installed.
- [ ] Test cross-device export with a reachable handoff file and project directory; original machine paths are not assumed valid.

## Languages, accessibility, and privacy

- [ ] English, Simplified Chinese, Spanish, and Japanese key parity passes in the app, including error and accessibility strings.
- [ ] Language changes preserve selected work. Generated review language follows the choice while source quotes remain unchanged.
- [ ] Verify keyboard navigation, focus return, scrolling, dialog states, long labels, and light/dark appearance in the actual desktop app.
- [ ] Inspect website at desktop/mobile sizes in all four languages; run `node site/check.mjs` after final copy changes.
- [ ] Privacy copy matches the final code: local database is not wholly encrypted; external review is selected; whole-workspace export contains private evidence.
- [ ] All shipped fixtures, screenshots, examples, and release logs are synthetic or demonstrably free of private data.
- [ ] No provider keys, private account paths, customer names, runtime databases, exports, or real conversation snapshots enter tracked files or artifacts.

## Licensing and distribution

- [ ] `LICENSE` is the full, unmodified official Apache-2.0 text; package metadata agrees.
- [ ] `NOTICE` retains the bundled React/Scheduler, Lucide/Feather, Zod, and Electron notices; review transitive/runtime notices when dependencies change.
- [ ] Inspect packaged output for the Electron/Chromium license set, not only the app's `LICENSE` and `NOTICE` inside its archive.
- [ ] Brand assets are original and website copies match; no unlicensed fonts, competitor graphics, or fabricated testimonials.
- [ ] `pnpm package` is local-only. Publish only explicitly selected, checked artifacts with truthful signing status.
- [ ] Source repository is public at the intended URL, contains no private history, and has a reproducible version tag.
- [ ] CI result corresponds to the exact release commit; include checksums and limitations in release notes.
- [ ] Verify the public Releases page and actual downloads after upload.
- [ ] Build and publish Pages, then verify the public URL, relative assets, all language switches, and release links.
- [ ] Only after release verification, update `site/release.js`, README status, and the platform table to describe what is available.

## Release record template

```text
Version / commit:
Date:
Build environment:
Checks and results:
Artifact names + SHA-256:
Installation/runtime evidence by OS:
Live provider/model checks:
Native handoff evidence:
Signing/notarization status:
Known limits / unverified surfaces:
Public release URL:
Public website URL:
```

# 中文

本文件记录发布证据。填写实际提交、系统/架构、命令、安装包及结果；仅勾选不能证明已验收。当前仍在发布验证中，不能从源码存在、测试通过或配置了构建目标推断已发布、已签名或全平台可用。

当前已记录：核心实现已具备；冻结候选已通过类型检查、构建及109/109测试，最新头跨平台CI仍待执行。宣传站四语各198词条、四种宽度、键盘、复制、语言切换保持选择、GitHub Pages子路径与资源副本检查通过，并检查了合成截图。已完成的本地macOS源码端到端覆盖2会话归并为1事项、5次本地合成HTTP请求、注册交接关联、暂停/重复回顾、取消、重启、导出清空再导入、剪贴板、四语及暗色，页面错误0；未启动真实Agent。原生选择器返回值使用stub，真实UI→IPC链路已跑，但不是人工OS选择器交互验收。最后连续性容错修复后的E2E已再次通过：模型故意漏existingId仍关联原事项、未重复且保留暂停。另有35.1秒真实模型连续性诊断通过配套Codex CLI桥接到原runReview，保留原ID与决定且未重复/误标完成；这不是真实key HTTP服务验证。原生CLI合成文件收件及macOS合成密钥存储有独立通过记录，Ollama未完成。四目标解包后程序及实际安装器GUI端到端已接入发布workflow，最新头CI结果仍待记录；安装器必须经过实际DMG复制/NSIS安装/DEB安装、不同路径GUI测试和卸载清理才可标通过。本机只读挂载DMG并从镜像内应用运行E2E已有负责人报告通过，但不代替新的CI流程。AppImage、Windows portable、系统下载安全提示、生产沙箱启动、签名及公开下载仍需单独记录。此前源码仓库和Pages已公开，不能把早期CI或网站成功套到最新代码与安装包。

## 必须分别核验

- **数据链路：** 支持格式真实读取、镜像去重、用户答复、时间、未知格式与覆盖缺口；原文件不变；手动纠正和暂停不被后续回顾覆盖。
- **AI边界：** 可预览范围、每批最多120消息/60,000字符、最多八批、超限在网络前拒绝；地址或协议改变清旧key。三协议分别验证；记录实际服务/模型，不把mock当真实调用；仅发送所选依据与关联事项；模型结构、证据、完成声明不合规时安全失败。
- **密钥：** OS保护存储的实际重启行为；无安全后端时明确仅会话存储；不泄露请求、密钥或敏感报错。
- **交接：** 首次发起任务使用原生目录选择器确认，不直接信任导入cwd；预览后实际打开目标、让目标读取正确材料；区分打开/预填/触发执行/提交/收到；检查失效会话、目录、特殊字符、缺失应用及手动回退。
- **用户体验：** 四语完整、切换不丢工作、原文引用不改；桌面明暗主题、焦点、键盘、长文字和错误状态；网站移动端与发布入口。
- **平台：** 在上方表逐项填安装包、SHA-256、解包后GUI端到端、实际安装器安装、原生Agent收件、签名/公证。sourceE2E、packagedE2E和installerInstallation分别记录；Linux合成CI使用的no-sandbox不能代表生产沙箱验收。跨平台构建不等于目标系统实测；不提供的目标也须明确写出。
- **发布资料：** 隐私说明和最终实现一致；不含真实对话、凭证、客户信息、私有账号路径或运行数据库；依赖许可证和Electron/Chromium完整许可材料保留。
- **公网结果：** 最终提交CI、版本标签、实际下载、校验值、限制与签名说明；发布后独立查看Releases和Pages。只有确认可用后，才更新网站状态和README。

最终记录应包含版本/提交、日期、构建环境、检查、安装包与校验、平台运行、模型与交接实测、签名状态、已知限制、发布链接和网站链接。任何未测项保持明确，不能靠一条“全部通过”覆盖。
