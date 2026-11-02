# Workflow boundaries

## CI

`ci.yml` runs typecheck, unit tests, and production build on Ubuntu 24.04 x64, macOS 15 arm64, and Windows Server 2025 x64. The macOS job also runs `pnpm exec tsx tests/e2e.ts` against a real Electron process and a synthetic localhost AI provider. The website job verifies the four-language static site and generates original brand icons.

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

Node 24 and the pnpm version from `packageManager` are used. A version tag must match `package.json`. Each build uploads installers, target-specific SHA-256 sums, and a JSON record of the exact commit and tested/unverified surfaces.

**These initial artifacts are unsigned distributions, without configured developer-identity signing or notarization.** The workflow disables identity auto-discovery and does not consume signing secrets. Embedded platform/runtime ad-hoc signatures are not claimed as developer signing. Adding verified signing is a separate release-engineering change.

Tag pushes and ordinary manual runs upload Actions artifacts only. They do not create or publish a GitHub release. A manual run may explicitly set `create_draft: true` and an existing tag; only then does the final job receive `contents: write` and create a draft after verifying checksums and consistent build commits. It refuses to overwrite an existing release. It never publishes the draft automatically.

Clean installer testing, Windows/Linux GUI behavior, live external-provider calls, and actual native-agent receipt are not established by packaging alone. Complete `docs/RELEASE-CHECKLIST.md` before making a draft public.

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

CI在三系统运行核心检查，macOS另跑真实Electron和合成本地模型的端到端测试；网站单独检查四语言、响应式与交互。PR不部署、不发布、不使用签名凭证。

Pages构建只读取代码与Pages元信息，部署任务才获得`pages: write`和`id-token: write`。仓库所有者需先将Pages来源设为GitHub Actions。静态白名单构建不打包测试脚本、私有资料或开发文档，也不会把配置链接验证冒充实际下载验证。

发布构建提供macOS arm64/x64、Windows x64、Linux x64四目标。默认只上传Actions安装包、SHA-256和真实构建记录；tag推送不会自动创建Release。只有手动明确勾选`create_draft`并指定已有匹配版本tag，才创建草稿，绝不自动公开或覆盖已有Release。

初始构建明确为未配置开发者身份签名、未公证，不使用签名secret；平台运行时可能存在的临时签名不等于正式签名。打包通过不能代替干净设备安装、Windows/Linux界面、真实外部模型与目标Agent收件验收。完成发布清单后，再由负责人决定公开。
