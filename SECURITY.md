# Security

[中文](#中文)

Carrythread handles private work records. Its protections depend on explicit source selection, read-only adapters, a sandboxed renderer, narrow IPC, provider-key isolation, and reviewable handoffs. It is not a sandbox for the coding agents you launch.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/chrzamz/carrythread/security/advisories/new) **if enabled for this repository**. Include a synthetic reproduction, affected version/OS, expected and observed behavior, and whether original data or credentials could be exposed.

If that private channel is unavailable, open a minimal [issue](https://github.com/chrzamz/carrythread/issues) requesting a private reporting route. Do not publish exploit details, real conversations, provider keys, customer identifiers, or a workspace export in that issue. No private email address or response-time commitment is currently advertised.

Ordinary bugs can use public issues with synthetic data.

## Support status

The current development target is v0.1.0. Before a public release, fixes are best-effort on the development branch. After publication, the latest release is the first target for security fixes; any additional supported version must be named in release notes. There is no guaranteed response or patch SLA.

## Trust boundaries

- **Imported history:** untrusted text. It must not execute scripts, change settings, invoke tools, or convey fresh authorization.
- **Original files:** read-only. Symlink traversal, whole-home scans, credential locations, and unsupported formats require conservative handling.
- **Renderer:** no Node integration. Context isolation, sandboxing, IPC sender checks, argument validation, and restricted navigation must remain enabled.
- **AI providers:** explicitly selected endpoints. Keys stay in the main process; redirects cannot move a key to an unreviewed destination. External inference is an intentional data transfer.
- **Work state:** invalid model schemas or fabricated evidence references must not become authoritative records. Manual and stopped states must survive reconciliation.
- **Handoff:** source text is quoted data. The native launch plan must preserve argument boundaries, validate target/session/cwd, reject stale packages, and distinguish launch from receipt. Some native prompt paths may begin agent execution.
- **Local machine:** the workspace database and exported Markdown/JSON are not end-to-end encrypted. A compromised OS/user account or an agent with access to those files is outside the protections of UI isolation.

## Release expectations

Security-sensitive changes need negative tests: malicious source text, missing/unsupported records, unknown evidence IDs, key leakage, endpoint redirects, shell metacharacters, stale session IDs, and missing directories. Release checks must also exercise OS-backed storage and actual native launch behavior, because mocks do not establish those properties.

Packaged binaries must report signing/notarization status honestly. Do not ask users to disable platform protections as a general installation step. Preserve the Electron/Chromium and bundled-library notices in distributions.

# 中文

Carrythread 处理私人工作记录，其保护依赖明确选择来源、只读适配器、沙箱化界面、受限IPC、密钥隔离和可检查的交接材料。它不为你启动的Coding Agent提供执行沙箱。

## 报告漏洞

仓库启用时，请使用[GitHub私密漏洞报告](https://github.com/chrzamz/carrythread/security/advisories/new)，提供合成复现、受影响版本/系统、预期与实际行为，以及原始数据或密钥可能受到的影响。

若该入口不可用，可以建立最小[公开issue](https://github.com/chrzamz/carrythread/issues)请求私密报告渠道，但不要在其中发布利用细节、真实对话、密钥、客户标识或工作区导出。目前没有公布私人邮箱或响应时限承诺。普通问题可使用带合成数据的公开issue。

## 支持与边界

当前开发目标为v0.1.0，发布前在开发分支尽力修复；发布后优先修复最新版本，其他支持版本以发布说明为准，不提供固定响应或修复SLA。

- 导入历史是不可信文本，不能执行命令、修改配置、调用工具或传递新授权。
- 原始文件只读，保守处理符号链接、整个用户目录、凭证路径和未知格式。
- 保持界面无Node访问、context isolation、sandbox、IPC来源及参数校验、导航限制。
- AI地址由用户选择，密钥留在主进程，不跟随重定向转交密钥；外部推理是一次明确的数据发送。
- 无效模型结构或伪造证据不能成为正式事项；手动覆盖与停止状态需在归并后保留。
- 交接材料中的历史是引用数据，启动参数要保持边界，验证目标、会话、目录及版本；启动不等于收到，部分原生提示路径可能直接执行。
- 工作区数据库和导出文件不是端到端加密。操作系统/用户账号失陷，或可读取这些文件的Agent，不在界面隔离的保护范围内。

安全相关修改需要负例测试，覆盖恶意历史、未知证据、密钥泄漏、地址重定向、shell特殊字符、失效会话及缺失目录。OS密钥存储和真实目标应用还需实际验证，mock通过不能代替。

如实披露安装包签名/公证状态，不把关闭系统保护当作通用安装步骤；发布物保留Electron/Chromium和依赖许可证。
