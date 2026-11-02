# Privacy and data boundaries

[中文](#中文)

This document describes the local application and the static public website. It is a description of implemented data boundaries, not a claim that every conversation becomes anonymous or that every platform has completed release verification.

## Local import and storage

Source discovery checks known local history locations. It does not open conversations or credentials merely to list candidates. You choose enabled sources, then refresh them. Automatic refresh is off by default and, if enabled, runs only while the app is open; it does not run an AI review.

Adapters read supported history files and databases without modifying them. The scanner refuses the filesystem root and the entire home directory, skips symlinks and recognized credential/configuration locations, and limits file counts, depth, and record size. Coverage shows skipped or unsupported material rather than treating it as no activity.

Carrythread stores a separate `carrythread.db` and prepared handoff files in Electron's application-data directory. The database contains indexed visible messages, source references and paths, work items, change history, coverage, review-run metadata, settings, and prepared handoff records. **The database is not encrypted as a whole.** Use OS account permissions and disk protection appropriate to the sensitivity of your work.

Removing a source or reducing the scan window does not automatically delete previously indexed evidence. The clear-data control described below is separate.

## Redaction and remaining sensitive content

Recognizable private keys, bearer/basic tokens, common API-key shapes, token-bearing URLs, and named credential fields are redacted before indexing or sharing. This is heuristic protection, not complete detection or anonymization.

Names, project details, ordinary message text, file paths, and uncommon secrets may remain. Inspect selected records and exported material before sharing them. Do not assume a redaction count proves that the rest is safe to publish.

System/developer and reasoning blocks are not presented as work evidence. Supported explicit user answers are retained because they can contain important decisions. Incomplete formats or unknown timestamps stay marked as such.

## When information leaves the device

| Action | Data sent or exposed | Recipient |
|---|---|---|
| Refresh local sources | No network request by the importer | Local filesystem / local index |
| Test AI connection | A short synthetic test prompt and configured API credentials | The selected provider endpoint |
| Run an AI review | Bounded selected message text, roles, dates, evidence IDs, plus existing work items linked to the selected conversations for reconciliation | The selected provider endpoint |
| Use localhost Ollama | Review data sent to the local Ollama process | Local service; check any model/service configuration separately |
| Open or launch a handoff | A prepared context-file path and current instruction; some paths also copy a prompt to the OS clipboard | Chosen native application or CLI, which may then process it using its own provider settings |
| Export a workspace or handoff | A local JSON or Markdown file containing private work context | A file destination you choose; subsequent sharing is your action |
| Open documentation / GitHub | Normal browser navigation | The linked website under its own policies |

AI review is explicitly started. Source refresh and importing records do not trigger it. The review scope can be previewed before sending. A review uses at most eight batches, each limited to 120 messages and 60,000 characters of evidence. Oversized selections are rejected before any network request so the user can narrow the scope; coverage limits remain visible. The associated existing-item context helps avoid duplicates and preserve decisions. Unrelated items without selected evidence must not be silently added to that context.

The main process makes provider requests. Hosted endpoints use HTTPS, credentials cannot appear in endpoint URLs, and authenticated requests do not follow redirects. Changing a provider endpoint or protocol clears the previous key so it cannot silently move to the new destination. Custom endpoints remain your choice and have their own retention, access, and billing policies.

The presets are ordinary API services. Carrythread does not reuse agent subscription sign-ins or secretly route requests through a Coding Plan. It is your responsibility to choose an endpoint and credential allowed for that service.

Before first starting a native agent task in a directory, confirm it with the OS folder picker. The application remembers approved directories. A working-directory path found in imported evidence is not authorization to execute there.

## Provider keys

Provider keys stay in the main process. When secure storage is available, Electron `safeStorage` encrypts them using OS-backed facilities. The renderer receives key-presence and storage-status information, not the stored secret.

If secure storage is unavailable, keys remain only in process memory for the current session. Linux backends reported as `basic_text` or `unknown` are not accepted as secure storage. There is no silent plaintext persistence fallback. After restarting, a session-only key must be supplied again.

This does not encrypt the entire workspace. Protect OS credentials, backups, and local access separately.

## Export, import, and deletion

**Export workspace contains the whole indexed workspace:** sessions and their visible evidence, work items, and item change history. It includes source pointers and may contain identifying paths or message text. It does **not** include provider settings/keys or prepared handoff records. There is no claim of per-item selective workspace export in this version.

**Export handoff** writes the prepared Markdown context for the chosen item. It may contain excerpts and local file paths. It does not package every referenced source or project file. To continue on another device, make the exported file and needed project files available there.

**Import workspace** restores supported portable data. Existing local item edits win item-ID collisions; it is not transparent cloud synchronization or a general overwrite operation.

**Clear local Carrythread data** clears the application's index, work records/history, review records, settings, stored keys, and app-managed handoff files. Original agent histories are not changed. It does not erase earlier exports, clipboard contents, OS backups, terminal history, or material already sent to providers or other apps. Deletion is not a guarantee of forensic erasure from storage media.

There is no hosted account or cloud data store in the current application scope.

## Public website

The static site contains synthetic examples. It does not read local histories, call AI services, upload files, or send analytics. It uses local storage only to remember the chosen language. Its example handoff copies invented text to the clipboard only when clicked.

GitHub Pages serves the site and external links open their respective services; those hosts may maintain ordinary request logs under their own policies. Carrythread does not add tracking code or third-party fonts to the site.

## Questions and reports

Use [public issues](https://github.com/chrzamz/carrythread/issues) for a question with synthetic examples. For a potential disclosure or vulnerability, follow [SECURITY.md](../SECURITY.md) and do not attach a real workspace export or credential.

# 中文

本说明覆盖本地应用与静态宣传站，描述数据边界，不代表所有对话已匿名化，也不代表全部平台已完成发布验证。

## 本地导入与保存

来源检测仅检查已知本地历史位置，不会为了列出候选就读取对话或凭证。由你启用来源并刷新。自动刷新默认关闭，开启后仅在应用运行时执行，不会自动触发AI回顾。

适配器只读支持的历史文件和数据库，不修改原件。扫描器拒绝整个用户目录和文件系统根目录，跳过符号链接及识别出的凭证/配置位置，并限制文件数量、深度和大小。不支持、跳过或不完整的材料会显示覆盖缺口，不能当作没有发生工作。

Carrythread 在自己的Electron应用数据目录保存`carrythread.db`与交接文件。数据库包含可见消息索引、来源引用/路径、事项、变更历史、覆盖信息、回顾元信息、设置与交接记录。**数据库并非整体加密**，应按工作敏感程度保护操作系统账号与磁盘。移除来源或缩小扫描范围不会自动删除已索引证据。

## 脱敏与残留信息

索引或分享前会过滤可识别的私钥、Bearer/Basic凭证、常见API密钥形状、含凭证的URL与具名凭证字段。这是启发式保护，不是完整检测或匿名化。

姓名、项目内容、普通正文、文件路径和少见密钥仍可能保留。发送或导出前请检查；脱敏数量不能证明其他内容可公开发布。系统/开发者及推理块不作为工作证据，支持的明确用户答复会保留。格式或时间不完整会如实标记。

## 什么时候离开设备

| 操作 | 发送或暴露的内容 | 接收方 |
|---|---|---|
| 刷新本地来源 | 导入器不发起网络请求 | 本地文件系统与索引 |
| AI连接测试 | 很小的合成提示与配置凭证 | 选定模型服务地址 |
| AI回顾 | 有上限的所选消息、角色、时间、证据ID，以及与所选会话关联的既有事项上下文 | 选定模型服务地址 |
| 本机Ollama | 将分析内容发送给本地Ollama进程 | 本地服务；模型/服务自身配置需另行确认 |
| 打开或启动交接 | 已准备上下文文件的路径和当前指令；部分路径会复制到系统剪贴板 | 选定应用/CLI，后者可能按自己的配置调用模型 |
| 导出工作区或交接 | 包含私人工作内容的本地JSON/Markdown文件 | 你选择的位置；之后分享由你控制 |
| 打开文档/GitHub | 正常浏览器访问 | 相应网站及其政策 |

AI回顾需明确启动，刷新或导入不会触发。发送前可预览范围；一次回顾最多八批，每批依据最多120条消息、60,000字符。超过边界会在任何网络请求前拒绝，让用户缩小范围；覆盖限制保持可见。关联事项用于去重并保留决定，没有所选证据的无关事项不应悄悄附加到请求。

模型请求由主进程发送；托管地址使用HTTPS，URL中不能嵌入凭证，带凭证请求不跟随重定向。修改服务地址或协议会清除旧密钥，避免悄悄带到新地址。自定义服务的保存期限、访问和计费规则由该服务商决定。预设是普通API服务，不复用Agent订阅登录，也不偷偷切换Coding Plan地址；请按账号权限选择地址和密钥。

首次在某个目录发起原生Agent任务前，通过系统文件夹选择器确认。应用会记住已确认目录；导入依据中的工作路径不是执行许可。

## 模型密钥

密钥留在主进程中。安全存储可用时，Electron `safeStorage` 使用操作系统设施加密；界面只拿到密钥是否存在及存储状态，不获得已保存密钥正文。

安全存储不可用时，只在当前进程内存保留密钥。Linux的`basic_text`或`unknown`后端不当作安全存储，不会静默退回明文保存；重启后需重新输入会话密钥。这不等于整个工作区加密。

## 导出、导入与清除

**导出工作区是整个已索引工作区**：含会话及可见依据、事项与变更历史，保留来源指针，可能含可识别路径或正文；不含服务设置/密钥或已准备的交接记录。本版本不宣称可逐事项精选导出工作区。

**导出交接**保存所选事项准备好的Markdown，可能含摘录和路径，不打包所有源文件/项目文件。换设备时应让导出的文件与必要项目内容在新设备可访问。

**导入工作区**读取受支持的可携带数据；事项ID冲突时现有本地编辑优先，不是透明云同步或全面覆盖。

**清除Carrythread本地数据**会清掉索引、事项/历史、回顾、设置、密钥及应用管理的交接文件，不改Agent原历史，也不清除之前的导出、剪贴板、OS备份、终端历史或已经发出的副本。不能把此操作当作存储介质的取证级擦除。当前范围没有托管账号或云端数据存储。

## 宣传站与反馈

静态站使用合成数据，不读取历史、不调用AI、不上传文件、不发送分析统计，仅在本地记住语言。点击示例复制时才把虚构文字放入剪贴板。

站点由GitHub Pages提供，外部链接打开各自服务，托管方可能按其政策保留普通访问日志；Carrythread没有加追踪脚本或第三方字体。

普通问题可提交带合成示例的[公开issue](https://github.com/chrzamz/carrythread/issues)。涉及泄露或漏洞时遵循[安全报告说明](../SECURITY.md)，不要附真实工作区导出或凭证。
