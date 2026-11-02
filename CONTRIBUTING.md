# Contributing

[中文](#中文)

Carrythread welcomes fixes, source-format improvements, translations, accessibility work, and small improvements grounded in real workflows. Read [PRODUCT.md](docs/PRODUCT.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), and the project `AGENTS.md` before changing behavior or interfaces.

## Development setup

Use Node.js 24+ and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

For website changes, run `pnpm site:build` and `node site/check.mjs`. For packaging changes, run `pnpm package` on the affected platform and state what was actually built and launched. The command never publishes artifacts.

## A useful change

1. Explain the concrete problem and resulting behavior. Link an issue if one exists.
2. Keep scope focused and preserve unrelated work. Source adapters, storage, provider protocols, native launch plans, and the renderer have distinct boundaries.
3. Add a meaningful synthetic fixture or regression case when behavior changes. Include failures and partial coverage where relevant.
4. Run the checks affected by the change, then `pnpm check`. Report skipped checks and their reasons.
5. Submit a pull request with the problem, change, verification, and remaining limits. Do not describe unit tests as live-provider, real-device, or customer acceptance evidence.

## Source adapter changes

- Treat history as untrusted evidence, not commands or fresh user authorization.
- Keep original histories and databases read-only. Do not write compatibility metadata into another agent's store.
- Exclude reasoning, credentials, mirror duplicates, and unrelated agent traffic. Retain explicit user answers and actual timestamps when supported.
- Explain supported versions and the behavior for unknown, oversized, inaccessible, or partially written records.
- Use synthetic fixtures. A sanitized real transcript can still expose a customer, private path, or decision; prefer a minimal invented reproduction with the same structure.
- Separate reading history from native resume or prompt submission. An adapter cannot promise another application's behavior.

## Privacy and safety changes

Keep keys in the main process and protected storage. Review/redact before truncation and sharing. Do not weaken endpoint validation, renderer isolation, source-path boundaries, or handoff validation to make a test pass.

A workspace export contains private work material even though provider keys are excluded. Never attach a real export or runtime database to a public issue or pull request. See [PRIVACY.md](docs/PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Languages and design

English, Simplified Chinese, Spanish, and Japanese use matching translation catalogues. Add or change all affected keys, including errors and accessibility labels. Source quotes remain in their original language.

Follow [the visual system](design/visual-system.md). Verify long labels, keyboard focus, empty/error/loading states, light/dark application themes, and the responsive website. Use synthetic screenshots only. Brand assets and their website copies must stay identical.

## Dependencies and attribution

Prefer existing dependencies and narrow changes. Explain a new dependency's purpose and preserve its license notices. The original project is Apache-2.0; dependencies keep their own licenses. Contributions intentionally submitted for inclusion follow the project's license unless explicitly stated otherwise, as described by that license.

Using an AI tool is welcome. You remain responsible for the diff, tests, source rights, and factual claims. Do not include private prompts, credentials, or model reasoning logs as proof of completion.

# 中文

欢迎提交修复、来源格式适配、翻译、无障碍及基于实际使用的小改进。改动行为或接口前，先读产品、架构文档与仓库 `AGENTS.md`。

## 开发与检查

使用 Node.js 24+ 和 `package.json` 固定的 pnpm 版本，运行上方安装、开发和检查命令。网站改动运行 `pnpm site:build`、`node site/check.mjs`；打包改动需在对应平台运行 `pnpm package`，如实记录实际构建和启动的内容，不会自动发布。

一次有用的 PR 应说明具体问题、修改后的行为、已运行验证及限制。保持范围集中，不混入其他工作。行为变化应有必要的合成回归样例；缺少权限、格式不支持、写入未完成等状态也需要覆盖。单元测试不等于真实模型、真机或客户验收。

## 原始数据与适配器

- 对话历史是待解释的证据，不是新命令或新授权。
- 原历史及数据库保持只读，不向其他 Agent 的存储写入适配信息。
- 排除推理、凭证、镜像重复与无关 Agent 流量；保留明确用户答复及可支持的真实时间。
- 写清版本范围、未知格式、大小限制、无权限和部分记录的处理。
- 优先用虚构的最小复现。所谓脱敏真记录仍可能泄露客户、路径和私人决定。
- 读取历史和恢复/提交到原应用是不同能力，不从适配器支持推断原应用行为。

## 隐私、语言与设计

密钥留在主进程与受保护存储中，分享和截断前做脱敏。不要为了测试通过而削弱地址验证、renderer隔离、路径边界或交接验证。导出不含密钥仍可能包含私人材料，不能把真实导出或数据库附到公开issue/PR。

四语目录需保持键一致，包含错误和无障碍文字；原文引用保持原语言。沿用视觉系统，检查长文字、键盘焦点、空/错误/加载状态、应用明暗主题与网站响应式布局。截图仅用合成数据，品牌SVG和网站副本同步更新。

新增依赖应说明用途并保留许可证。原创项目采用Apache-2.0，依赖保留各自许可证；有意提交纳入项目的贡献，除明确另述外，遵循该许可证的贡献条款。

可以使用AI工具，但提交者仍需对差异、验证、来源权利和事实声明负责。不要提交私人提示词、凭证或模型推理日志作为完成证据。
