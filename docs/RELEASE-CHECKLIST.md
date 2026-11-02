# v0.1.0 release checklist

[中文](#中文)

This is the release evidence ledger. Record the tested commit, OS/architecture, command, artifact, and result. A checkbox without evidence does not establish release readiness. Update this file when the final release audit changes the status below.

**Current status:** release validation in progress; no public binary, completed platform run, live-provider result, or signing result is asserted by this document.

## Evidence currently recorded

| Area | Status at documentation handoff | Evidence / limit |
|---|---|---|
| Core implementation | Present | Local adapters, SQLite work state, AI protocols, reconciliation, edits/merge/split, and handoff planning/launch paths exist. |
| Core checks | Reported passing | Integration reported typecheck and unit tests passing. Rerun against the actual release commit and record the final result/count. |
| Static website | Checked locally | `node site/check.mjs`: 4 languages × 196 translation leaves, 1440/1100/390/360 widths, keyboard tabs, project selection, copy, language-state preservation, relative GitHub Pages subpath, identical SVG assets, no page errors. |
| Site visual review | Checked locally | English/Spanish desktop and Chinese/Japanese mobile synthetic walkthrough screenshots inspected. |
| Local macOS source end-to-end | Passed | Real Electron + synthetic localhost HTTP provider: import → review → correction → handoff file/copy; four languages and dark appearance. `nativeAgentStarted=false`. |
| Remaining end-to-end boundaries | Pending | Actual native-agent task receipt, new evidence reconciliation, clean packaged installation, and other OS GUI paths require separate evidence. |
| Live AI provider calls | Pending | Protocol mocks and a built connection-test UI are not proof of a live-provider run. |
| Packaged installers / runtime | Pending | Complete the platform table below. |
| Public GitHub release / Pages | Pending | Record actual release and website URLs after publication. |

## Platform evidence

A configured target is not an available or verified artifact. Replace each pending result with evidence, or explicitly state that a target is not distributed in this release.

| OS / architecture | Configured targets | Artifact built + checksum | Clean installation / launch | Native handoff checked | Signing / notarization |
|---|---|---|---|---|---|
| macOS / record actual architecture | DMG, ZIP | Pending | Pending | Pending | Unknown; do not claim signed/notarized |
| Windows / record actual architecture | NSIS, portable | Pending | Pending | Pending | Unknown; do not claim signed |
| Linux / record actual architecture | AppImage, DEB | Pending | Pending | Pending | Record actual distribution/signature policy |

For each distributed artifact, record its exact filename, SHA-256, build commit, build environment, minimum OS assumptions, and any known launch limitations. Cross-building does not replace installing on the target OS.

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
- [ ] Review context includes only selected evidence and associated existing work; unrelated evidence-free items do not escape the scope.
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

- [x] Local macOS source E2E with a seeded synthetic profile: import, selected localhost-model review, manual correction, handoff preview/copy, four languages, and dark appearance. No real native agent was started.
- [ ] Complete native source-picker, search, evidence navigation, and clean installed-profile checks on each distributed OS.
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

当前已记录：核心实现已具备；集成报告类型检查与单元测试通过，仍需在最终发布提交重跑并记录最终数量。宣传站四语各196词条、四种宽度、键盘、复制、语言切换保持选择、GitHub Pages子路径与资源副本检查通过，并检查了合成截图。本地macOS源码端到端已通过真实Electron与合成localhost HTTP模型，覆盖导入、回顾、手动纠正、交接预览/复制、四语和暗色；未启动真实Agent。原生目标收件、真实外部模型、安装包、其他系统运行、签名及公网发布仍需单独记录。

## 必须分别核验

- **数据链路：** 支持格式真实读取、镜像去重、用户答复、时间、未知格式与覆盖缺口；原文件不变；手动纠正和暂停不被后续回顾覆盖。
- **AI边界：** 可预览范围、每批最多120消息/60,000字符、最多八批、超限在网络前拒绝；地址或协议改变清旧key。三协议分别验证；记录实际服务/模型，不把mock当真实调用；仅发送所选依据与关联事项；模型结构、证据、完成声明不合规时安全失败。
- **密钥：** OS保护存储的实际重启行为；无安全后端时明确仅会话存储；不泄露请求、密钥或敏感报错。
- **交接：** 首次发起任务使用原生目录选择器确认，不直接信任导入cwd；预览后实际打开目标、让目标读取正确材料；区分打开/预填/触发执行/提交/收到；检查失效会话、目录、特殊字符、缺失应用及手动回退。
- **用户体验：** 四语完整、切换不丢工作、原文引用不改；桌面明暗主题、焦点、键盘、长文字和错误状态；网站移动端与发布入口。
- **平台：** 在上方表逐项填安装包、SHA-256、实际安装启动、原生交接、签名/公证。跨平台构建不等于目标系统实测；不提供的目标也须明确写出。
- **发布资料：** 隐私说明和最终实现一致；不含真实对话、凭证、客户信息、私有账号路径或运行数据库；依赖许可证和Electron/Chromium完整许可材料保留。
- **公网结果：** 最终提交CI、版本标签、实际下载、校验值、限制与签名说明；发布后独立查看Releases和Pages。只有确认可用后，才更新网站状态和README。

最终记录应包含版本/提交、日期、构建环境、检查、安装包与校验、平台运行、模型与交接实测、签名状态、已知限制、发布链接和网站链接。任何未测项保持明确，不能靠一条“全部通过”覆盖。
