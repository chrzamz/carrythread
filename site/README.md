# Carrythread public website

A static, buildless website with English, Simplified Chinese, Spanish, and Japanese catalogues. All browser assets are local. The page performs no analytics, backend requests, or AI calls; it stores only the selected language in local storage.

## Publish

The deployable file allowlist is:

- `index.html`
- `styles.css`
- `app.js`
- `messages.js`
- `release.js`
- `assets/`

Copy these to `site/dist/` in the root site's build command and publish that directory with GitHub Pages. There is no compilation step or third-party CDN dependency. All asset URLs are relative, including when served under `/carrythread/`.

Root owns release and deployment. Keep `release.js` at `pre-release` until the release audit is complete. Download buttons link to GitHub Releases; no installer URL is fabricated. To use `/releases/latest` after a verified publication, set `stage: 'released'`.

## Check

From the repository root, with the repository's Playwright dependency installed:

```sh
node site/check.mjs
node site/check.mjs --screenshots /tmp/carrythread-site-review
```

The checker runs its own headless Chromium instance and an ephemeral localhost HTTP server. It checks translation leaf parity, source asset equality, page errors, 1440/1100/390/360 widths in all languages, keyboard tabs, project and language state, clipboard handoff, and a GitHub Pages-style subpath. It never opens or controls a user's existing browser tabs.

Screenshots use synthetic examples only. The walkthrough is not a screenshot of the live desktop app. Clicking its handoff control copies example text; it never opens an agent or sends a message.

## 中文

这是无需构建工具的静态宣传站，包含英语、简体中文、西班牙语和日语。浏览器资源全部来自本站；不请求后端或模型，不做统计追踪，仅在本地记住语言。

发布时只复制上方列出的页面、样式、脚本和`assets/`到`site/dist/`，由根项目发布到GitHub Pages。`release.js`在发布审计完成前保持`pre-release`，下载入口只指向实际GitHub Releases页面。网站支持部署在`/carrythread/`子路径。

运行上述检查命令，会启动独立无头浏览器和临时本地HTTP服务，不接管用户现有标签页。检查四语词条一致性、品牌资源副本、浏览器错误、四种宽度、键盘操作、切换语言保持选择、示例复制及子路径资源。

演示中的项目与对话都是合成数据，不读取真实文件，也不是桌面应用的实际截图。交接按钮仅复制示例文字，不打开Agent或发送消息。
