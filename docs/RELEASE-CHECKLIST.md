# v0.1.0 release evidence

[**Public release**](https://github.com/chrzamz/carrythread/releases/tag/v0.1.0) · published **2026-11-03 04:14:41 UTC** · GitHub `draft=false`, `prerelease=false`.

This ledger separates completed release checks from compatibility and service paths that remain unverified. Test data and model responses in CI are synthetic; no native agent is started by the release E2E.

## Reproducible references

| Record | Evidence |
|---|---|
| Application source / fixed tag | `v0.1.0` → `8be44946a94c8bdd13f3a0b8db5d094fc00a3fee` |
| Core CI | [41574690615](https://github.com/chrzamz/carrythread/actions/runs/41574690615): 130/130 tests, typecheck/build, source E2E and site checks passed |
| Native release and draft gates | [41575726233](https://github.com/chrzamz/carrythread/actions/runs/41575726233): all four native targets and draft creation passed |
| Workflow revision | `adee0f32be24638063ca918814030a6c87ba4122`; workflow-only output-directory fix, with each build checking out the fixed application tag |
| Distribution | Eight binaries, four `BUILD-*.json` records and five checksum files uploaded; eight binary SHA-256 values matched GitHub asset digests |
| Checksums | [Combined SHA256SUMS.txt](https://github.com/chrzamz/carrythread/releases/download/v0.1.0/SHA256SUMS.txt), plus four platform-specific files on the release |
| Public download check | Anonymous HEAD: all eight binaries HTTP 200 with matching Content-Length; `/releases/latest` HTTP 200 resolves to v0.1.0; downloaded public checksum file matches its GitHub digest |
| Website | [Pages 41577839374](https://github.com/chrzamz/carrythread/actions/runs/41577839374) deployed site commit `fdda45602d016b963c8b9d38037e1e5acf491738`; public index/scripts/styles match source bytes, four languages show v0.1.0 and the correct download URL, walkthrough works, no browser errors |

Application and workflow commits are intentionally different. All four published build records identify the fixed application commit and `v0.1.0`; later documentation and website updates do not move that tag.

## Platform evidence

All results below come from the final native release run, not an earlier candidate.

| OS / architecture | Published formats | Unpacked GUI E2E | Actual installation + installed GUI E2E + cleanup | Five production fuses | Build record |
|---|---|---|---|---|---|
| macOS arm64 | DMG, ZIP | Passed | Passed: read-only DMG mount → app copy → E2E → detach/cleanup | Passed, unpacked + installed | [BUILD-mac-arm64.json](https://github.com/chrzamz/carrythread/releases/download/v0.1.0/BUILD-mac-arm64.json) |
| macOS x64 | DMG, ZIP | Passed | Passed: read-only DMG mount → app copy → E2E → detach/cleanup | Passed, unpacked + installed | [BUILD-mac-x64.json](https://github.com/chrzamz/carrythread/releases/download/v0.1.0/BUILD-mac-x64.json) |
| Windows x64 | NSIS, portable | Passed | Passed: NSIS silent install → E2E → uninstall/cleanup | Passed, unpacked + installed | [BUILD-win-x64.json](https://github.com/chrzamz/carrythread/releases/download/v0.1.0/BUILD-win-x64.json) |
| Linux x64 | AppImage, DEB | Passed | Passed: DEB apt install → E2E → purge/cleanup | Passed, unpacked + installed | [BUILD-linux-x64.json](https://github.com/chrzamz/carrythread/releases/download/v0.1.0/BUILD-linux-x64.json) |

The installed executable is distinct from the unpacked executable. Build records retain separate `sourceE2E`, `packagedE2E`, `installerInstallation` and `productionFuses` results. Runners were native macOS 15 arm64/x64, Windows 2025 x64 and Ubuntu 24.04 x64. The macOS package declares macOS 13.0 minimum; this is not testing of every intervening OS version. Linux GUI tests use Xvfb and test-only `--no-sandbox`; normal sandboxed startup remains unverified.

## Signing, fuses and credentials

- **macOS:** the app bundle, DMG-installed copy and extracted ZIP passed strict ad-hoc signature verification, including hardened-runtime metadata. This is **not developer-identity signing or notarization**. Windows and Linux distributions are unsigned.
- **Five fuse readbacks passed on every target**, before unpacked and installed E2E: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` and `EnableNodeCliInspectArguments` disabled; `OnlyLoadAppFromAsar` and `EnableEmbeddedAsarIntegrityValidation` enabled. Electron supports runtime ASAR integrity on macOS from Electron 16 and Windows from Electron 30; this app uses Electron 45. An enabled Linux bit does **not** establish Linux runtime ASAR integrity.
- **Both Mac architectures, unpacked and installed:** `nativeKeyMode=encrypted`, encrypted save/restart/localhost HTTP authentication passed; the same-signed short-lived helper rejected a non-app parent. Each E2E recorded four normal exits, with no driver kill or forced cleanup. The helper uses anonymous pipes and has no window, Store or network; presence display does not decrypt.
- **Windows/Linux native keystore: not exercised.** Their synthetic E2E uses an unauthenticated localhost test provider. No cross-platform encrypted-storage claim is made.
- A separate local, test-owned helper SIGSTOP injection produced session fallback in 4.165 seconds and exit 0 in 89 ms during the suspended operation, with no forced cleanup. These are individual diagnostic observations, not latency guarantees.

## What the tests cover

Core tests cover supported source formats and partial-coverage reporting, evidence validation, scope boundaries, lifecycle corrections, registered handoff continuity, credential isolation and error cases. Source E2E covers synthetic import → selected localhost review → correction/pause → handoff → follow-up association, cancellation/restart, portable data, exact clipboard bytes, four languages and dark appearance. The mock deliberately omits `existingId` in a registered follow-up; the original item remains linked without duplication and retains the manual pause.

`tests/e2e.ts` uses development Electron's Node driver and stubs the native-picker return while exercising the real UI→IPC chain. `tests/packaged.e2e.ts` starts the production executable with renderer Chromium CDP, **without Node inspector or main-process test hooks**. It covers the business workflow, four languages, handoff file/registered prompt and normal shutdown. Its portable-data roundtrip uses an offline Store operation plus restarted UI; it is not a claim of native import/export dialog automation. Neither driver certifies human interaction with every OS picker.

The released-state website passed four-language key parity (198 leaves per locale), desktop/mobile widths, keyboard/copy interaction and GitHub Pages subpath checks. After Pages deployment, anonymous byte comparisons verified index.html, app.js, messages.js, release.js and styles.css against the site commit. A separate browser verified all four public languages, v0.1.0/download links, project/handoff interactions and desktop/mobile layout with no runtime errors.

## Known limits and follow-up validation

- **Real provider HTTP and Ollama:** no direct external API-key HTTP semantic pass or real local Ollama inference pass. Three protocols are tested with controlled responses. The attempted Ollama diagnostic stopped before model loading/inference. A separate real-model continuity check passed through a Codex CLI bridge into `runReview`; it does not validate shipped provider HTTP or add subscription login.
- **Native handoff:** one separate bundled-CLI diagnostic read a synthetic context file and returned its nonce/project/state. This does not certify all desktop deep links, CLI versions, launch paths or receipt callbacks. Opening/prefilling and confirmed reading remain distinct.
- **Installer surfaces:** end-user Gatekeeper/SmartScreen/quarantine prompts, Windows portable-wrapper execution and AppImage runtime remain unverified. CI installation is not coverage of every desktop environment, OS version or security policy.
- **Source formats:** OpenCode v2 `session_message` is reported partial rather than parsed. Pi v1–v3 relies on synthetic format fixtures; Finch runtime snapshots can lack timestamps. The reader does not imply every historical or future tool version is supported.
- **Data/privacy:** the local workspace database is not wholly encrypted. AI review is opt-in for selected evidence and linked work context. Whole-workspace export includes private evidence and excludes provider keys/settings and the local handoff registry. Cross-device imports do not restore trusted marker links automatically.
- **Licensing/distribution:** Apache-2.0 and bundled dependency notices are included; public fixtures and screenshots are synthetic. No hosted sync, paid tier, automatic publishing or general agent orchestration is included.

## 中文

[v0.1.0 已正式发布](https://github.com/chrzamz/carrythread/releases/tag/v0.1.0)，发布时间为 2026-11-03 04:14:41 UTC；不是草稿或 GitHub prerelease。8 个二进制、4 份构建记录和 5 份校验文件已上传，二进制 SHA-256 与 GitHub 资产摘要一致。8 个公开下载匿名 HEAD 均为 200 且大小一致，latest 正确指向 v0.1.0，公开校验文件摘要也已复核。

应用标签固定为 `8be44946`；执行发布的 workflow 来自后续仅修正输出目录创建的 `adee0f32`，各平台仍构建同一应用标签，未移动 tag。130 项核心测试、类型检查、构建与源码 E2E 已通过；四目标的解包后 GUI、实际 DMG/NSIS/DEB 安装、安装后 GUI、清理和五项 fuse 读回全部通过。macOS 两架构的 app、DMG 副本和 ZIP 严格 ad-hoc 签名检查通过，但没有开发者身份签名或公证。

两 Mac 在解包后及安装后都验证了 encrypted 密钥保存、重启和 localhost 认证；每轮 4 次正常退出，没有测试驱动杀进程或强制清理。Windows/Linux 的原生安全存储未测。Linux 的 fuse 位通过不代表运行时 ASAR 完整性支持，CI 的 no-sandbox 也不代表正常沙箱启动验收。

真实云 API-key HTTP、真实本地 Ollama 推理、全部原生 Agent 收件路径、人工系统选择器、下载安全提示、Windows portable 与 AppImage 执行等边界仍明确保留。源码 E2E 的原生选择器是返回值 stub；加固生产包使用 renderer CDP，不开放 Node inspector 或主进程测试钩子。最新发布文案由 Pages 41577839374 部署（站点提交 fdda4560）；匿名读取五个公开文件与源码字节一致，四语版本标记、下载链接、演示及桌面/移动端检查通过，浏览器错误0。
