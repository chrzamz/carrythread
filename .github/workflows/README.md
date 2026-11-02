# Workflow boundaries

## CI

`ci.yml` runs typecheck, unit tests, and production build on Ubuntu 24.04 x64, macOS 15 arm64, and Windows Server 2025 x64. The macOS job also runs the source/development driver, `pnpm exec tsx tests/e2e.ts`, against Electron and a synthetic localhost AI provider. Its native-dialog return is stubbed while the real UI→IPC path and clipboard bytes are checked; this is distinct from production-package testing. The website job verifies the four-language static site and generates original brand icons.

No public live-provider credentials are used. Synthetic screenshots are short-lived Actions artifacts. The workflow has `contents: read`; it cannot push source or publish releases. Pull requests do not deploy Pages or access signing secrets.

## Static website

`pages.yml` builds the explicit `site/dist` allowlist, checks the site, and uses the official Pages actions. The repository owner must first select **GitHub Actions** as the Pages build source. The workflow does not request an administrative token or automatically change that setting.

Build permissions: `contents: read`, `pages: read`. Deployment permissions: `pages: write`, `id-token: write`. Deployment uses the `github-pages` environment and only runs for `chrzamz/carrythread` on `main`.

The expected project-site path is `/carrythread/`. Asset paths are relative. `scripts/build-site.mjs` validates configured repository/release URLs and local resources; it does not pretend to verify an unpublished remote installer. The final release audit must check actual public URLs.

## Release builds

`release.yml` accepts a `v*` tag push or a manual run. It packages four native targets:

| Runner | Artifact target |
|---|---|
| `macos-15` | macOS arm64 DMG + ZIP |
| `macos-15-intel` | macOS x64 DMG + ZIP |
| `windows-2025` | Windows x64 NSIS + portable |
| `ubuntu-24.04` | Linux x64 AppImage + DEB |

Node 24 and the pnpm version from `packageManager` are used. A version tag must match `package.json`. After packaging, each native runner discovers the actual unpacked application instead of assuming a filename: macOS uses the app bundle Info.plist; Windows/Linux inspect builder output and match the configured application name. That executable is passed through `CARRYTHREAD_EXECUTABLE` to `tests/packaged.e2e.ts`. All unpacked, installed, and Windows packaged-startup preflight checks use this hardened driver: it spawns the production program directly and connects to Chromium renderer CDP, without Node inspector or a main-process test hook. It uses a fresh isolated profile and synthetic localhost provider. Linux uses Xvfb; the test driver adds `--no-sandbox` only for isolated CI Linux tests. This does not verify sandboxed production startup.

Before unpacked and installed E2E, `scripts/verify-fuses.mjs` reads the actual executable and writes separate verification records. It checks the five requested production fuse values; it does not flip them. The build record stores these as `productionFuses.packaged` and `productionFuses.installed`, and the draft gate requires both `verified` values to be true for every target.

Only after the required fuse, GUI, installer, and cleanup gates succeed does the job upload installers, SHA-256 sums, and a JSON build record. `sourceE2E`, `packagedE2E`, and `installerInstallation` are separate fields; macOS has source and packaged runs, while Windows/Linux have packaged runs. Synthetic screenshots are separate diagnostic artifacts.

### What the two E2E drivers establish

- **Source — `tests/e2e.ts`:** development Electron driver, including native-dialog return stubs and exact clipboard-byte checks through the real UI→IPC chain. Its test instrumentation is not shipped-package evidence.
- **Production package — `tests/packaged.e2e.ts`:** raw process spawn plus renderer CDP, with the production fuses left enabled. It checks the application workflow, four languages, state continuity and normal exit, and verifies the handoff file plus registered continuation prompt. It does not use Node inspector or a main-process test hook.
- **Portable data in the hardened test:** an offline Store roundtrip followed by a UI restart. This is not a claim that native import/export dialogs were exercised end to end. Native-picker stubs and clipboard-byte assertions belong to the source test, not this hardened path.

The flags disable RunAsNode, Node-options environment handling and Node CLI inspection, and enable ASAR-only loading plus embedded-ASAR-integrity configuration. Embedded runtime ASAR validation is supported on macOS with Electron 16+ and Windows with Electron 30+; this project uses Electron 45. Linux may report the fuse bit as Enabled, but Linux runtime ASAR integrity is not covered or claimed. Linux CI's test-only `--no-sandbox` also does not validate normal production sandbox startup.

**These initial artifacts have no configured developer-identity signing or notarization.** macOS explicitly uses `identity: "-"` for valid ad-hoc bundle integrity, with the builder's default hardened runtime and Electron entitlements. The unpacked app, DMG-installed copy and extracted ZIP must pass strict `codesign` verification. Ad-hoc signing is not Developer ID signing or Gatekeeper trust. The workflow disables certificate auto-discovery and does not consume signing secrets; adding verified developer signing is a separate release-engineering change.

Tag pushes and ordinary manual runs upload Actions artifacts only. They do not create or publish a GitHub release. A manual run may explicitly set `create_draft: true` and an existing tag; only then does the final job receive `contents: write` and create a draft after verifying checksums and consistent build commits. It refuses to overwrite an existing release. It never publishes the draft automatically.

The unpacked packaged executable gets a GUI test first. Then a separate installer path runs on every native target:

- macOS: mount the actual DMG read-only, copy its application with `ditto` into an owned `RUNNER_TEMP` directory, locate the binary through `Info.plist`, run E2E from that copy, and detach/remove it.
- Windows: run the actual NSIS setup with `/S` and a final unquoted `/D=` pointing to an owned temporary directory. Locate the installed executable and uninstaller, run E2E, then uninstall with `/S` and final `_?=` so cleanup waits for the uninstaller. This follows the [NSIS command-line rules](https://nsis.sourceforge.io/Docs/Chapter3.html#installerusage).
- Linux: read the DEB package name, refuse to replace a preinstalled package, install the actual DEB with `apt-get`, locate its package-owned main executable using `dpkg-query -L`, run E2E under Xvfb, then purge that package.

The installed executable must differ from the unpacked path. Cleanup runs even after a failed test. Install, installed-app GUI E2E, and cleanup must all succeed before `installerInstallation.status` becomes `passed` and distribution artifacts are uploaded. The draft job checks all four records again. Source, unpacked, and installed screenshots remain separate.

These are controlled CI-runner installation checks, not a promise about every end-user setup. Gatekeeper/SmartScreen/quarantine prompts, AppImage runtime, the Windows portable wrapper, live external-provider calls, production Linux sandbox startup, and actual native-agent receipt remain explicit limits. Complete `docs/RELEASE-CHECKLIST.md` before making a draft public.

Linux DEB packaging needs project homepage and author email or an explicit `linux.maintainer`; use approved public metadata, not a private account address.

## Official action pins

Release versions and their commit SHAs were checked against the official repositories on **2026-11-03**. Workflows pin the full commit, with the version as a comment.

- [actions/checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [actions/setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)
- [pnpm/action-setup v6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0)
- [actions/upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
- [actions/download-artifact v8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2)
- [actions/configure-pages v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0)
- [actions/upload-pages-artifact v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0)
- [actions/deploy-pages v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1)

Runner labels and architectures were checked in [actions/runner-images](https://github.com/actions/runner-images). Re-check support before updating pinned versions or changing runner labels.

## 中文

CI在三系统运行核心检查，macOS另跑tests/e2e.ts的source/development Electron driver与合成本地模型；其中原生对话框返回值使用stub，并检查真实UI→IPC和剪贴板字节，不冒充生产包验收。网站单独检查四语言、响应式与交互。PR不部署、不发布、不使用签名凭证。

Pages构建只读取代码与Pages元信息，部署任务才获得`pages: write`和`id-token: write`。仓库所有者需先将Pages来源设为GitHub Actions。静态白名单构建不打包测试脚本、私有资料或开发文档，也不会把配置链接验证冒充实际下载验证。

发布构建提供macOS arm64/x64、Windows x64、Linux x64四目标。默认只上传Actions安装包、SHA-256和真实构建记录；tag推送不会自动创建Release。只有手动明确勾选`create_draft`并指定已有匹配版本tag，才创建草稿，绝不自动公开或覆盖已有Release。

初始构建明确为未配置开发者身份签名、未公证，不使用签名secret；平台运行时可能存在的临时签名不等于正式签名。四个目标打包后都会从实际产物定位程序，再以隔离数据和本地合成HTTP模型运行GUI端到端；Linux使用Xvfb，no-sandbox仅用于CI合成测试，不能证明生产沙箱启动。sourceE2E、packagedE2E与installerInstallation分别记录。随后单独实际挂DMG并复制应用、NSIS静默装到临时目录、apt安装DEB；从安装结果定位与unpacked不同的程序跑GUI端到端，再卸载/清理。安装、GUI与清理三步都成功才将installerInstallation标passed。不能据此声称已验收最终用户的Gatekeeper/SmartScreen、AppImage运行或Windows portable包装程序。真实外部模型与目标Agent收件也仍需单独验证。完成发布清单后，再由负责人决定公开。

生产包、安装后程序和Windows packaged-startup preflight统一使用`tests/packaged.e2e.ts`：直接spawn实际程序，通过Chromium renderer CDP操作，生产fuses保持开启，不使用Node inspector或主进程testhook。它覆盖完整业务流程、四语和正常退出，验证handoff文件与已登记的接续提示。其portable data roundtrip使用离线Store加重启后的UI，不代表原生导入/导出Dialog全UI验收；原生picker stub与剪贴板字节检查属于source E2E。

解包后及安装后E2E前，`scripts/verify-fuses.mjs`分别读回五项fuse并落盘，BUILD记录为`productionFuses.packaged/installed`，draft gate要求每个目标两份记录的`verified`都为true。读取脚本不修改fuse。嵌入式ASAR运行时验证仅支持macOS上的Electron16+与Windows上的Electron30+；Linux即使读到Enabled，也不宣称已覆盖运行时ASAR完整性。
