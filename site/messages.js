export const messages = {
  "en": {
    "meta": {
      "title": "Carrythread — Keep the context. Carry the work forward.",
      "description": "A local workspace for reviewing work across AI agents, preserving decisions, and carrying context into the next step."
    },
    "nav": {
      "workflow": "How it works",
      "sources": "Your tools",
      "privacy": "Privacy",
      "open": "Open source",
      "language": "Language",
      "github": "GitHub",
      "skip": "Skip to content"
    },
    "hero": {
      "eyebrow": "A workspace for work in progress",
      "preview": "Building v0.1 in public",
      "released": "Open source · v{version}",
      "title": "Pick up the work.",
      "accent": "Keep the whole story.",
      "body": "Turn scattered agent conversations into a clear view of decisions, unfinished work, and the next step. Then take the right context with you.",
      "previewCta": "Follow the release",
      "downloadCta": "View downloads",
      "demoCta": "Explore the walkthrough",
      "previewNote": "v0.1 is in preparation. The workflow below illustrates the release goals.",
      "releaseNote": "Windows · macOS · Linux targets. Check release notes for available builds and signing status."
    },
    "demo": {
      "title": "Your work, with the thread intact",
      "synthetic": "Synthetic example",
      "workspace": "My workspace",
      "projectsLabel": "Projects",
      "sidebar": "Local records.\nA clear next step.",
      "scope": "Since your last review",
      "heading": "A good place to pick up.",
      "tabs": [
        "Next step",
        "Evidence",
        "Handoff"
      ],
      "next": "A useful next step",
      "sources": "Sources",
      "updated": "Example state · no live data",
      "hint": "Try a project, inspect its evidence, or preview a handoff.",
      "note": "This interactive illustration uses invented projects and conversations. It never reads your files.",
      "target": "Continue with",
      "copy": "Copy sample context",
      "copied": "Sample context copied.",
      "copyFailed": "Copy unavailable here. Select and copy the preview text.",
      "handoffNote": "This demo only copies sample text. It does not open an agent or submit a message.",
      "packageLabels": [
        "Goal",
        "Confirmed state",
        "Next step",
        "Evidence"
      ],
      "evidenceLabel": "Example source excerpts",
      "you": "You",
      "assistant": "Agent",
      "reference": "Source references",
      "projects": [
        {
          "name": "Atlas desktop",
          "item": "Close out the desktop release",
          "status": "Verification needed",
          "states": [
            "Code ready",
            "Device check",
            "Published"
          ],
          "summary": "The implementation and automated checks are complete. The latest note still calls for a real-device check; publication is not confirmed.",
          "next": "Run the installer on a clean device and attach the result before publishing.",
          "evidence": [
            {
              "role": "assistant",
              "date": "Mon · 14:20",
              "text": "The implementation and automated tests are complete. The installer still needs a check on a clean device."
            },
            {
              "role": "you",
              "date": "Tue · 09:10",
              "text": "Keep this open until the device check is done. I have not published the release."
            }
          ]
        },
        {
          "name": "Fieldnotes",
          "item": "Bring the article to publication",
          "status": "Outcome unconfirmed",
          "states": [
            "Draft ready",
            "Final review",
            "Published"
          ],
          "summary": "The article and cover are ready. A later conversation changed the opening paragraph. There is no publication link in the selected records.",
          "next": "Check the final draft against the latest edit, then confirm whether it has already been published.",
          "evidence": [
            {
              "role": "assistant",
              "date": "Mon · 16:45",
              "text": "The article and cover are saved. They have not been uploaded in this conversation."
            },
            {
              "role": "you",
              "date": "Tue · 10:30",
              "text": "Use the shorter opening from this message. Keep the earlier examples."
            }
          ]
        },
        {
          "name": "Northstar proposal",
          "item": "Resolve the last proposal decision",
          "status": "Decision needed",
          "states": [
            "Scope set",
            "Price decision",
            "Accepted"
          ],
          "summary": "The three delivery stages are confirmed. The support fee remains a proposal, and no customer acceptance is recorded.",
          "next": "Choose the support fee and service window before preparing the final proposal.",
          "evidence": [
            {
              "role": "you",
              "date": "Mon · 11:00",
              "text": "Keep the three delivery stages. The annual support fee is still undecided."
            },
            {
              "role": "assistant",
              "date": "Mon · 11:12",
              "text": "The draft now reflects the agreed scope. Pricing is a proposal and has not been sent to the customer."
            }
          ]
        }
      ]
    },
    "bridge": [
      "Conversations",
      "Decisions & work",
      "The next useful step"
    ],
    "workflow": {
      "kicker": "01 / Follow the work",
      "title": "A conversation ends.\nThe work carries on.",
      "intro": "Carrythread follows the outcome across conversations, so a finished response does not become a forgotten delivery step.",
      "steps": [
        {
          "title": "Bring the records together.",
          "body": "Choose the local sources and time range you want to review. See what was read, what changed, and where coverage is incomplete.",
          "tags": [
            "Explicit scope",
            "Read-only histories"
          ]
        },
        {
          "title": "Recover what matters.",
          "body": "Review proposed work items with their decisions, evidence, and open questions. Correct, merge, or split them. Keep paused work paused.",
          "tags": [
            "Evidence attached",
            "Your corrections stay"
          ]
        },
        {
          "title": "Continue with context.",
          "body": "Prepare a handoff with the goal, confirmed decisions, current state, and source references. Preview it before choosing the next tool.",
          "tags": [
            "Preview before sharing",
            "Capability-aware handoff"
          ]
        }
      ],
      "statement": "“Finished writing” and “ready for the world” are different moments.",
      "statementBody": "Track creation, testing, publication, and acceptance separately. When the evidence is missing, the outcome stays unknown. A suggestion never quietly becomes your commitment."
    },
    "sources": {
      "kicker": "02 / Keep your tools",
      "title": "Different agents.\nOne view of the work.",
      "intro": "v0.1 targets local history from the tools below. Each adapter must report its coverage and format limits; release notes identify what has actually been verified.",
      "columns": [
        "Source",
        "Reading scope",
        "Boundary"
      ],
      "rows": [
        [
          "Codex",
          "Local conversation history",
          "Local CLI / desktop records where available. An indexed record does not guarantee a resumable session."
        ],
        [
          "Claude Code",
          "Local project conversations",
          "Reads saved conversation records. Does not connect to your Claude web account."
        ],
        [
          "OpenCode",
          "Legacy JSON, v1 SQLite, exports",
          "OpenCode v2 session_message tables are not parsed yet; detected v2 content is reported as partial."
        ],
        [
          "Pi",
          "Saved JSONL sessions (v1–v3)",
          "Tree relationships are retained. Verified with synthetic fixtures; custom paths require selection."
        ],
        [
          "Finch",
          "Native logs + snapshot fallback",
          "Native history is preferred. A snapshot may lack message dates; that gap remains explicit."
        ],
        [
          "JSON / JSONL / Markdown",
          "Files you choose",
          "Import explicit files for other tools or written work. Preserve the original source reference."
        ]
      ],
      "note": "Reading, opening the original conversation, native resume, and sending a new message are different capabilities. Carrythread shows the available action for each target. It never claims an agent has read a handoff just because a window opened."
    },
    "privacy": {
      "kicker": "03 / Deliberate boundaries",
      "title": "Your records.\nYour choice of AI.",
      "intro": "The release design keeps storage local and AI analysis explicit. Choose the evidence, the provider, and the moment to send it.",
      "points": [
        {
          "title": "Read the originals. Keep them intact.",
          "body": "Source histories are read-only. Carrythread stores its own index and work state separately; no account or telemetry is required."
        },
        {
          "title": "Review exactly what will be shared.",
          "body": "AI analysis runs on your selected evidence. Redaction reduces obvious credential exposure, and handoff packages are previewable. Review sensitive content before sharing."
        },
        {
          "title": "Use your key, or a local model.",
          "body": "External inference sends selected content to that provider under its policies. A locally running model can keep inference on your machine."
        }
      ],
      "providerTitle": "Provider protocols in the v0.1 scope",
      "providers": [
        [
          "OpenAI-compatible",
          "Custom endpoint + model"
        ],
        [
          "Anthropic",
          "Your API key"
        ],
        [
          "Ollama",
          "Local inference"
        ]
      ],
      "providerNote": "Bring your own credentials. Provider usage is billed by the provider. A manually entered model remains possible when model discovery is unavailable.",
      "keyNote": "Keys belong in OS-protected storage. If secure storage is unavailable, use session-only keys rather than a silent plaintext fallback."
    },
    "open": {
      "kicker": "04 / Built in the open",
      "title": "A useful core.\nYours to keep using.",
      "intro": "The core is open source with bring-your-own-model access. No paywall is planned for reading local history, reviewing work, or exporting a handoff.",
      "coreLabel": "Free open-source core",
      "coreTitle": "Your everyday workbench",
      "coreBody": "Read and organize local records, inspect evidence, and take a portable context package to the next tool.",
      "coreFeatures": [
        "Local import and review",
        "Decisions, corrections, and work history",
        "Handoff preview and portable export",
        "Your provider or local model"
      ],
      "coreCta": "Explore the repository",
      "futureLabel": "Possible future services",
      "futureTitle": "Optional help, when it earns its place.",
      "futureBody": "Hosted synchronization, team collaboration, and hands-on support may be explored later. They are ideas, not available plans or launch promises.",
      "futureItems": [
        "Hosted sync",
        "Team review & collaboration",
        "Setup and support"
      ],
      "futureState": "Exploring",
      "futureNote": "No billing, paid tiers, or cloud sync is implemented in this release scope."
    },
    "faq": {
      "kicker": "A few clear answers",
      "title": "Before you begin.",
      "items": [
        {
          "q": "Does Carrythread run my agents for me?",
          "a": "Agent execution stays in the tool you choose. Carrythread organizes evidence and prepares context; deployments, payments, publishing, and customer messages remain separate actions."
        },
        {
          "q": "What happens when the records disagree?",
          "a": "Sources and dates remain visible. AI proposes an interpretation for review; your explicit corrections and paused or cancelled states are preserved when new evidence arrives."
        },
        {
          "q": "Can I move my work to another computer?",
          "a": "The v0.1 scope includes explicit export and import of work and handoff material. It does not promise transparent cloud synchronization."
        },
        {
          "q": "Which languages and builds are available?",
          "a": "This website is available in English, Simplified Chinese, Spanish, and Japanese. App translations, OS builds, signing status, and tested adapters are listed with each release."
        }
      ]
    },
    "cta": {
      "title": "Return to the work, already oriented.",
      "body": "Keep the context. Carry the work forward.",
      "github": "View on GitHub"
    },
    "footer": {
      "caption": "An independent open-source project for people working across AI tools.",
      "docs": "Documentation",
      "issues": "Feedback & issues",
      "brand": "Brand assets",
      "privacy": "Data boundaries",
      "languageNote": "No tracking. This page uses local storage only for your language choice."
    },
    "installation": {
      "title": "Start with the work you choose.",
      "steps": [
        "Open Releases and choose an available build. Read its OS, signing, and verification notes.",
        "Open Carrythread and select a local history source or explicit import files.",
        "Inspect your records first. Configure an optional AI provider when you want a selected review."
      ],
      "note": "No published build yet? Follow the repository; source setup instructions live in the README."
    }
  },
  "zh-CN": {
    "meta": {
      "title": "Carrythread 续迹 — 接上工作脉络，把事情推进到结果",
      "description": "在本地回顾多个 Agent 的工作，保留决定与出处，发现未尽事项，并带着相关上下文继续。"
    },
    "nav": {
      "workflow": "如何使用",
      "sources": "支持的工具",
      "privacy": "隐私边界",
      "open": "开源计划",
      "language": "语言",
      "github": "GitHub",
      "skip": "跳到正文"
    },
    "hero": {
      "eyebrow": "给进行中的工作，一个接续处",
      "preview": "v0.1 公开开发中",
      "released": "开源 · v{version}",
      "title": "接上工作脉络，",
      "accent": "把事情推进到结果。",
      "body": "把散落在不同 Agent 中的对话，整理成清楚的决定、未尽事项和下一步。继续时，把相关上下文一起带上。",
      "previewCta": "关注版本发布",
      "downloadCta": "查看下载",
      "demoCta": "体验工作流程",
      "previewNote": "v0.1 正在准备中。下方展示的是本次发布目标与示意流程。",
      "releaseNote": "面向 Windows、macOS 和 Linux。实际安装包、签名与验证状态以发布说明为准。"
    },
    "demo": {
      "title": "事情有出处，继续有方向",
      "synthetic": "合成数据示例",
      "workspace": "我的工作区",
      "projectsLabel": "项目",
      "sidebar": "记录留在本地。\n下一步清楚可见。",
      "scope": "上次回顾之后",
      "heading": "从这里，接着做。",
      "tabs": [
        "下一步",
        "查看依据",
        "准备交接"
      ],
      "next": "现在可以推进的一步",
      "sources": "来源",
      "updated": "示意状态 · 非实时数据",
      "hint": "试着切换项目、查看依据，或预览一份交接材料。",
      "note": "此交互示意使用虚构项目和对话，不会读取你的文件。",
      "target": "交给哪个工具",
      "copy": "复制示例上下文",
      "copied": "示例上下文已复制。",
      "copyFailed": "此环境无法自动复制，请选中预览文字手动复制。",
      "handoffNote": "这里只复制示例文字，不会打开 Agent 或发送消息。",
      "packageLabels": [
        "目标",
        "已确认状态",
        "下一步",
        "依据"
      ],
      "evidenceLabel": "示例来源摘录",
      "you": "你",
      "assistant": "Agent",
      "reference": "来源引用",
      "projects": [
        {
          "name": "Atlas 桌面端",
          "item": "把桌面版本推进到交付",
          "status": "待验证",
          "states": [
            "代码已完成",
            "真机检查",
            "已发布"
          ],
          "summary": "实现与自动检查已经完成。最后一条记录仍要求真机检查，目前还没有发布确认。",
          "next": "在干净设备上运行安装包，记录结果后再发布。",
          "evidence": [
            {
              "role": "assistant",
              "date": "周一 · 14:20",
              "text": "实现与自动测试已完成，安装包还需要在干净设备上检查。"
            },
            {
              "role": "you",
              "date": "周二 · 09:10",
              "text": "真机检查完成前先保持未结。我还没有发布这个版本。"
            }
          ]
        },
        {
          "name": "Fieldnotes 文章",
          "item": "把文章推进到发布",
          "status": "结果待核实",
          "states": [
            "初稿已完成",
            "终稿核对",
            "已发布"
          ],
          "summary": "文章与封面已准备好，后续对话又修改了开头。所选记录中没有发布链接。",
          "next": "对照最新修改核对终稿，再确认文章是否已在其他地方发布。",
          "evidence": [
            {
              "role": "assistant",
              "date": "周一 · 16:45",
              "text": "文章和封面已保存。本次对话中没有上传到发布平台。"
            },
            {
              "role": "you",
              "date": "周二 · 10:30",
              "text": "采用这条消息里的简短开头，之前的例子保留。"
            }
          ]
        },
        {
          "name": "Northstar 合作稿",
          "item": "收口合作稿的最后一个决定",
          "status": "待决定",
          "states": [
            "范围已确认",
            "定价待决定",
            "客户已接受"
          ],
          "summary": "三个交付阶段已确认，服务费仍是提议，也没有记录表明客户已接受。",
          "next": "先确定服务费和服务时段，再准备合作终稿。",
          "evidence": [
            {
              "role": "you",
              "date": "周一 · 11:00",
              "text": "保留三个交付阶段，年度服务费还没有决定。"
            },
            {
              "role": "assistant",
              "date": "周一 · 11:12",
              "text": "草稿已按确认范围更新，价格仍为提议，尚未发给客户。"
            }
          ]
        }
      ]
    },
    "bridge": [
      "分散的对话",
      "决定与事项",
      "值得推进的下一步"
    ],
    "workflow": {
      "kicker": "01 / 跟着事情走",
      "title": "对话结束了，\n事情还在继续。",
      "intro": "Carrythread 跨对话追踪事情的结果，让一次回答完成之后，真正的交付步骤仍然可见。",
      "steps": [
        {
          "title": "把记录放到一起。",
          "body": "选择想回顾的本地来源和时间范围，清楚看到读取了什么、发生了什么变化，以及哪些来源还没覆盖。",
          "tags": [
            "范围明确",
            "原记录只读"
          ]
        },
        {
          "title": "找回关键的进展。",
          "body": "带着决定、出处和未决问题查看候选事项。可以纠正、合并或拆分；已经暂停的事情继续保持暂停。",
          "tags": [
            "结论有依据",
            "保留你的纠正"
          ]
        },
        {
          "title": "带着上下文继续。",
          "body": "将目标、已确认决定、当前状态和来源整理成交接材料。先预览，再选择接下来使用的工具。",
          "tags": [
            "分享前可预览",
            "如实显示交接能力"
          ]
        }
      ],
      "statement": "“写完了”和“交付了”，是两个不同的时刻。",
      "statementBody": "分别记录产出、测试、发布与验收。缺少证据时，结果保持未知；一条建议不会悄悄变成你的承诺。"
    },
    "sources": {
      "kicker": "02 / 继续用熟悉的工具",
      "title": "不同的 Agent，\n同一件事的脉络。",
      "intro": "v0.1 计划读取下列工具的本地历史。每个适配器都需说明覆盖与格式限制，具体已验证范围以发布说明为准。",
      "columns": [
        "来源",
        "读取范围",
        "能力边界"
      ],
      "rows": [
        [
          "Codex",
          "本地对话历史",
          "读取可用的 CLI / 桌面端本地记录。能检索不等于原会话仍可恢复。"
        ],
        [
          "Claude Code",
          "本地项目对话",
          "读取已保存的对话记录，不连接 Claude 网页账号。"
        ],
        [
          "OpenCode",
          "旧版 JSON、v1 SQLite、导出文件",
          "暂不解析 OpenCode v2 的 session_message 表；检测到该格式时报告部分覆盖。"
        ],
        [
          "Pi",
          "已保存的 JSONL 会话（v1–v3）",
          "保留树形会话关系，已做合成样例验证；自定义路径需要明确选择。"
        ],
        [
          "Finch",
          "原生日志 + 快照回退",
          "优先读取原生历史。快照可能缺少消息日期，相关缺口会明确标示。"
        ],
        [
          "JSON / JSONL / Markdown",
          "你选择的文件",
          "为其他工具或文字工作导入明确文件，并保留原始来源。"
        ]
      ],
      "note": "读取记录、打开原对话、恢复原会话和发送新消息是不同能力。Carrythread 按目标展示可用动作，不会因为窗口打开了就声称 Agent 已读到交接内容。"
    },
    "privacy": {
      "kicker": "03 / 清楚的边界",
      "title": "你的记录，\n你选择的 AI。",
      "intro": "本次发布采用本地存储、明确选择后才进行 AI 分析的设计。你决定哪些内容、发送给谁、什么时候发送。",
      "points": [
        {
          "title": "读取原记录，保持原样。",
          "body": "源对话历史只读，索引和事项状态单独保存。不要求注册账号，也不设置遥测。"
        },
        {
          "title": "看清将分享哪些内容。",
          "body": "AI 只分析你选中的材料。脱敏降低明显凭证泄露风险，交接包可提前预览；分享前仍应检查敏感内容。"
        },
        {
          "title": "使用自己的密钥或本地模型。",
          "body": "选择外部模型时，所选内容会发送给该服务商并适用其政策。运行本地模型可让推理留在自己的设备上。"
        }
      ],
      "providerTitle": "v0.1 范围内的服务协议",
      "providers": [
        [
          "OpenAI-compatible",
          "自定义地址 + 模型"
        ],
        [
          "Anthropic",
          "你自己的 API 密钥"
        ],
        [
          "Ollama",
          "本地推理"
        ]
      ],
      "providerNote": "自行提供凭证，模型用量由服务商计费。即使无法自动获取模型列表，仍可手动填写模型。",
      "keyNote": "密钥使用操作系统保护的存储。安全存储不可用时，仅保留当前会话密钥，不悄悄改存明文。"
    },
    "open": {
      "kicker": "04 / 公开构建",
      "title": "实用的核心，\n可以一直留在你手上。",
      "intro": "核心开源，模型由你选择。本地历史读取、工作回顾与交接导出不计划设置付费门槛。",
      "coreLabel": "免费的开源核心",
      "coreTitle": "日常工作的接续台",
      "coreBody": "读取与整理本地记录，查看证据，把可携带的上下文带到下一个工具。",
      "coreFeatures": [
        "本地导入与回顾",
        "决定、纠正与事项历史",
        "交接预览与可携带导出",
        "自己的模型服务或本地模型"
      ],
      "coreCta": "查看开源仓库",
      "futureLabel": "未来可选服务",
      "futureTitle": "需要时，再提供额外帮助。",
      "futureBody": "以后可能探索托管同步、团队协作和支持服务。目前只是候选方向，不是已上线的套餐或发布日期承诺。",
      "futureItems": [
        "托管同步",
        "团队回顾与协作",
        "安装配置与支持"
      ],
      "futureState": "探索中",
      "futureNote": "本次发布范围没有实现收费、付费套餐或云同步。"
    },
    "faq": {
      "kicker": "先把这些说清楚",
      "title": "开始之前。",
      "items": [
        {
          "q": "Carrythread 会代我运行 Agent 吗？",
          "a": "Agent 仍在你选择的工具中执行。Carrythread 整理依据、准备上下文；部署、支付、发布和客户消息是需要单独处理的动作。"
        },
        {
          "q": "记录之间相互矛盾时怎么办？",
          "a": "保留来源和日期，AI 给出可复核的解释。新证据到来时，你明确做出的纠正、暂停与取消状态会继续保留。"
        },
        {
          "q": "能把工作带到另一台电脑吗？",
          "a": "v0.1 范围包含明确导出与导入事项和交接材料，不承诺透明的云端同步。"
        },
        {
          "q": "有哪些语言和安装包？",
          "a": "本站提供英语、简体中文、西班牙语和日语。应用翻译、系统安装包、签名状态及已测试适配器会在每次发布时列明。"
        }
      ]
    },
    "cta": {
      "title": "回到工作，接着向前。",
      "body": "接上工作脉络，把事情推进到结果。",
      "github": "在 GitHub 查看"
    },
    "footer": {
      "caption": "为跨 AI 工具工作的人构建的独立开源项目。",
      "docs": "使用文档",
      "issues": "反馈与问题",
      "brand": "品牌资源",
      "privacy": "数据边界",
      "languageNote": "不设置追踪。此网页仅用本地存储记住语言选择。"
    },
    "installation": {
      "title": "从你选择的工作开始。",
      "steps": [
        "打开 Releases，选择实际可用的安装包，先阅读系统、签名和验证说明。",
        "打开 Carrythread，选择一个本地历史来源，或明确导入文件。",
        "先查看记录。需要分析时，再配置可选的 AI 服务并选择回顾范围。"
      ],
      "note": "还没有发布安装包？可关注仓库，源码运行方法见 README。"
    }
  },
  "es": {
    "meta": {
      "title": "Carrythread — Conserva el contexto. Continúa el trabajo.",
      "description": "Un espacio local para revisar el trabajo entre agentes de IA, conservar decisiones y llevar el contexto al siguiente paso."
    },
    "nav": {
      "workflow": "Cómo funciona",
      "sources": "Tus herramientas",
      "privacy": "Privacidad",
      "open": "Código abierto",
      "language": "Idioma",
      "github": "GitHub",
      "skip": "Ir al contenido"
    },
    "hero": {
      "eyebrow": "Un espacio para el trabajo en curso",
      "preview": "v0.1 en desarrollo público",
      "released": "Código abierto · v{version}",
      "title": "Retoma el trabajo.",
      "accent": "Conserva la historia.",
      "body": "Convierte conversaciones dispersas entre agentes en una visión clara de decisiones, trabajo pendiente y próximos pasos. Continúa con el contexto que necesitas.",
      "previewCta": "Seguir la versión",
      "downloadCta": "Ver descargas",
      "demoCta": "Explorar el recorrido",
      "previewNote": "v0.1 está en preparación. Este recorrido muestra los objetivos de la versión.",
      "releaseNote": "Objetivos: Windows, macOS y Linux. Consulta las notas para conocer los paquetes y su estado de firma."
    },
    "demo": {
      "title": "Tu trabajo, con el hilo completo",
      "synthetic": "Ejemplo sintético",
      "workspace": "Mi espacio",
      "projectsLabel": "Proyectos",
      "sidebar": "Registros locales.\nEl siguiente paso, claro.",
      "scope": "Desde tu última revisión",
      "heading": "Un buen punto para continuar.",
      "tabs": [
        "Siguiente paso",
        "Evidencia",
        "Traspaso"
      ],
      "next": "Un siguiente paso útil",
      "sources": "Fuentes",
      "updated": "Estado de ejemplo · sin datos reales",
      "hint": "Elige un proyecto, revisa la evidencia o prepara un traspaso.",
      "note": "Esta ilustración usa proyectos y conversaciones inventados. No lee tus archivos.",
      "target": "Continuar con",
      "copy": "Copiar contexto de ejemplo",
      "copied": "Contexto de ejemplo copiado.",
      "copyFailed": "No se puede copiar aquí. Selecciona y copia el texto de la vista previa.",
      "handoffNote": "La demostración solo copia texto de ejemplo. No abre agentes ni envía mensajes.",
      "packageLabels": [
        "Objetivo",
        "Estado confirmado",
        "Siguiente paso",
        "Evidencia"
      ],
      "evidenceLabel": "Fragmentos de fuentes de ejemplo",
      "you": "Tú",
      "assistant": "Agente",
      "reference": "Referencias",
      "projects": [
        {
          "name": "Atlas escritorio",
          "item": "Completar la entrega de escritorio",
          "status": "Falta verificar",
          "states": [
            "Código listo",
            "Prueba real",
            "Publicado"
          ],
          "summary": "La implementación y las pruebas automáticas están completas. La última nota aún pide una prueba en un dispositivo; la publicación no está confirmada.",
          "next": "Ejecuta el instalador en un dispositivo limpio y adjunta el resultado antes de publicar.",
          "evidence": [
            {
              "role": "assistant",
              "date": "Lun · 14:20",
              "text": "La implementación y las pruebas automáticas están completas. Falta comprobar el instalador en un dispositivo limpio."
            },
            {
              "role": "you",
              "date": "Mar · 09:10",
              "text": "Mantén esto abierto hasta terminar la prueba. Todavía no he publicado la versión."
            }
          ]
        },
        {
          "name": "Fieldnotes",
          "item": "Llevar el artículo a publicación",
          "status": "Resultado sin confirmar",
          "states": [
            "Borrador listo",
            "Revisión final",
            "Publicado"
          ],
          "summary": "El artículo y la portada están listos. Una conversación posterior cambió la introducción. No hay enlace de publicación en los registros seleccionados.",
          "next": "Compara el borrador final con la última corrección y confirma si ya se ha publicado.",
          "evidence": [
            {
              "role": "assistant",
              "date": "Lun · 16:45",
              "text": "El artículo y la portada están guardados. No se han subido en esta conversación."
            },
            {
              "role": "you",
              "date": "Mar · 10:30",
              "text": "Usa la introducción más breve de este mensaje. Conserva los ejemplos anteriores."
            }
          ]
        },
        {
          "name": "Propuesta Northstar",
          "item": "Resolver la última decisión",
          "status": "Falta decidir",
          "states": [
            "Alcance fijado",
            "Decidir precio",
            "Aceptado"
          ],
          "summary": "Las tres etapas de entrega están confirmadas. La tarifa de soporte sigue siendo una propuesta y no consta aceptación del cliente.",
          "next": "Elige la tarifa y el horario de soporte antes de preparar la propuesta final.",
          "evidence": [
            {
              "role": "you",
              "date": "Lun · 11:00",
              "text": "Conserva las tres etapas. La tarifa de soporte anual sigue sin decidirse."
            },
            {
              "role": "assistant",
              "date": "Lun · 11:12",
              "text": "El borrador refleja el alcance acordado. El precio es una propuesta y no se ha enviado al cliente."
            }
          ]
        }
      ]
    },
    "bridge": [
      "Conversaciones",
      "Decisiones y trabajo",
      "El próximo paso útil"
    ],
    "workflow": {
      "kicker": "01 / Sigue el trabajo",
      "title": "La conversación termina.\nEl trabajo continúa.",
      "intro": "Carrythread sigue el resultado entre conversaciones para que una respuesta terminada no oculte un paso pendiente de entrega.",
      "steps": [
        {
          "title": "Reúne los registros.",
          "body": "Elige las fuentes locales y el período que quieres revisar. Comprueba qué se leyó, qué cambió y dónde falta cobertura.",
          "tags": [
            "Alcance explícito",
            "Historial de solo lectura"
          ]
        },
        {
          "title": "Recupera lo importante.",
          "body": "Revisa las tareas propuestas con sus decisiones, evidencia y preguntas abiertas. Corrige, combina o divide. Mantén en pausa lo que pausaste.",
          "tags": [
            "Evidencia vinculada",
            "Tus correcciones permanecen"
          ]
        },
        {
          "title": "Continúa con contexto.",
          "body": "Prepara un traspaso con el objetivo, las decisiones confirmadas, el estado y las referencias. Revísalo antes de elegir la siguiente herramienta.",
          "tags": [
            "Vista previa al compartir",
            "Capacidades claras"
          ]
        }
      ],
      "statement": "«Terminado de escribir» y «listo para publicar» son momentos distintos.",
      "statementBody": "Distingue creación, pruebas, publicación y aceptación. Si falta evidencia, el resultado sigue siendo desconocido. Una sugerencia no se convierte sin avisar en un compromiso."
    },
    "sources": {
      "kicker": "02 / Conserva tus herramientas",
      "title": "Distintos agentes.\nUn hilo de trabajo.",
      "intro": "v0.1 contempla los historiales locales de estas herramientas. Cada adaptador debe explicar sus límites; las notas de versión indican qué se verificó.",
      "columns": [
        "Fuente",
        "Lectura",
        "Límites"
      ],
      "rows": [
        [
          "Codex",
          "Historial local",
          "Registros locales de CLI o escritorio disponibles. Un registro indexado no garantiza que la sesión pueda reanudarse."
        ],
        [
          "Claude Code",
          "Conversaciones del proyecto",
          "Lee registros guardados. No se conecta a tu cuenta web de Claude."
        ],
        [
          "OpenCode",
          "JSON anterior, SQLite v1, exportaciones",
          "Las tablas session_message de OpenCode v2 aún no se leen; su detección se informa como cobertura parcial."
        ],
        [
          "Pi",
          "Sesiones JSONL guardadas (v1–v3)",
          "Conserva el árbol de sesiones. Verificado con datos sintéticos; las rutas propias se eligen explícitamente."
        ],
        [
          "Finch",
          "Registros nativos y copia de estado",
          "Se prefiere el historial nativo. Si una copia no tiene fechas de mensajes, se indica esa limitación."
        ],
        [
          "JSON / JSONL / Markdown",
          "Archivos elegidos",
          "Importa archivos concretos de otras herramientas y conserva la referencia original."
        ]
      ],
      "note": "Leer, abrir la conversación original, reanudar una sesión y enviar un mensaje son capacidades distintas. Carrythread muestra la acción disponible y no afirma que un agente leyó el traspaso solo porque se abrió una ventana."
    },
    "privacy": {
      "kicker": "03 / Límites deliberados",
      "title": "Tus registros.\nTu elección de IA.",
      "intro": "El diseño guarda los datos localmente y hace explícito el análisis con IA. Tú eliges la evidencia, el proveedor y cuándo enviarla.",
      "points": [
        {
          "title": "Lee los originales sin alterarlos.",
          "body": "Los historiales son de solo lectura. Carrythread guarda su índice y estado por separado. No requiere cuenta ni telemetría."
        },
        {
          "title": "Revisa qué vas a compartir.",
          "body": "La IA analiza la evidencia seleccionada. La ocultación reduce la exposición de credenciales evidentes y el traspaso tiene vista previa. Revisa los datos sensibles antes de compartir."
        },
        {
          "title": "Usa tu clave o un modelo local.",
          "body": "La inferencia externa envía el contenido elegido al proveedor y se rige por sus políticas. Un modelo local puede mantener la inferencia en tu equipo."
        }
      ],
      "providerTitle": "Protocolos incluidos en el alcance de v0.1",
      "providers": [
        [
          "OpenAI-compatible",
          "Endpoint y modelo propios"
        ],
        [
          "Anthropic",
          "Tu clave API"
        ],
        [
          "Ollama",
          "Inferencia local"
        ]
      ],
      "providerNote": "Aporta tus credenciales. El proveedor factura el uso. Puedes indicar el modelo manualmente si no está disponible la detección automática.",
      "keyNote": "Las claves se guardan con protección del sistema operativo. Si no está disponible, se usan solo durante la sesión; nunca se guardan silenciosamente en texto plano."
    },
    "open": {
      "kicker": "04 / Desarrollo abierto",
      "title": "Un núcleo útil.\nQue puedes seguir usando.",
      "intro": "El núcleo es de código abierto y tú eliges el modelo. No se planea cobrar por leer historiales locales, revisar trabajo o exportar contexto.",
      "coreLabel": "Núcleo gratuito y abierto",
      "coreTitle": "Tu espacio de trabajo diario",
      "coreBody": "Organiza registros locales, inspecciona evidencia y lleva un paquete de contexto portátil a la siguiente herramienta.",
      "coreFeatures": [
        "Importación y revisión local",
        "Decisiones, correcciones e historial",
        "Vista previa y exportación del traspaso",
        "Tu proveedor o un modelo local"
      ],
      "coreCta": "Explorar el repositorio",
      "futureLabel": "Posibles servicios futuros",
      "futureTitle": "Ayuda opcional, cuando aporte valor.",
      "futureBody": "Más adelante podrían explorarse sincronización alojada, colaboración y soporte. Son posibilidades, no planes disponibles ni promesas de lanzamiento.",
      "futureItems": [
        "Sincronización alojada",
        "Revisión y colaboración en equipo",
        "Configuración y soporte"
      ],
      "futureState": "En estudio",
      "futureNote": "Este alcance de versión no implementa cobros, planes de pago ni sincronización en la nube."
    },
    "faq": {
      "kicker": "Respuestas claras",
      "title": "Antes de empezar.",
      "items": [
        {
          "q": "¿Carrythread ejecuta mis agentes?",
          "a": "La ejecución sigue en la herramienta que elijas. Carrythread organiza evidencia y prepara contexto; desplegar, pagar, publicar y enviar mensajes a clientes son acciones separadas."
        },
        {
          "q": "¿Qué ocurre si los registros se contradicen?",
          "a": "Las fuentes y fechas siguen visibles. La IA propone una interpretación para revisar. Tus correcciones y los estados pausado o cancelado se conservan al llegar nueva evidencia."
        },
        {
          "q": "¿Puedo llevar el trabajo a otro equipo?",
          "a": "El alcance de v0.1 incluye exportación e importación explícitas de trabajo y contexto. No promete sincronización transparente en la nube."
        },
        {
          "q": "¿Qué idiomas y paquetes están disponibles?",
          "a": "La web está en inglés, chino simplificado, español y japonés. Cada versión detalla las traducciones de la app, los paquetes por sistema, las firmas y los adaptadores probados."
        }
      ]
    },
    "cta": {
      "title": "Vuelve al trabajo sabiendo por dónde seguir.",
      "body": "Conserva el contexto. Continúa el trabajo.",
      "github": "Ver en GitHub"
    },
    "footer": {
      "caption": "Un proyecto independiente y abierto para trabajar con varias herramientas de IA.",
      "docs": "Documentación",
      "issues": "Comentarios e incidencias",
      "brand": "Recursos de marca",
      "privacy": "Límites de datos",
      "languageNote": "Sin seguimiento. Esta página solo guarda localmente tu idioma."
    },
    "installation": {
      "title": "Empieza con el trabajo que elijas.",
      "steps": [
        "Abre Releases y elige un paquete disponible. Lee las notas del sistema, firma y verificación.",
        "Abre Carrythread y elige una fuente local o los archivos que quieres importar.",
        "Inspecciona primero los registros. Configura un proveedor de IA opcional cuando quieras revisar una selección."
      ],
      "note": "¿Todavía no hay un paquete publicado? Sigue el repositorio; el README explica cómo ejecutar el código fuente."
    }
  },
  "ja": {
    "meta": {
      "title": "Carrythread — 文脈を保ち、仕事の続きを。",
      "description": "複数のAIエージェントにまたがる仕事を振り返り、決定と根拠を残し、次の一歩へ文脈を引き継ぐローカルワークスペース。"
    },
    "nav": {
      "workflow": "使い方",
      "sources": "対応ツール",
      "privacy": "プライバシー",
      "open": "オープンソース",
      "language": "言語",
      "github": "GitHub",
      "skip": "本文へ移動"
    },
    "hero": {
      "eyebrow": "進行中の仕事に、戻れる場所を",
      "preview": "v0.1 を公開開発中",
      "released": "オープンソース · v{version}",
      "title": "仕事の続きを、",
      "accent": "文脈とともに。",
      "body": "エージェントごとに散らばった会話から、決定事項、残っている仕事、次の一歩を整理。必要な文脈を持って再開できます。",
      "previewCta": "リリースを確認",
      "downloadCta": "ダウンロードを見る",
      "demoCta": "操作例を見る",
      "previewNote": "v0.1 は準備中です。以下はリリース目標を示す操作例です。",
      "releaseNote": "Windows・macOS・Linux を対象としています。実際の配布物と署名状況はリリースノートをご確認ください。"
    },
    "demo": {
      "title": "仕事の流れを、見失わない",
      "synthetic": "架空データの例",
      "workspace": "マイワークスペース",
      "projectsLabel": "プロジェクト",
      "sidebar": "記録はローカルに。\n次の一歩を明確に。",
      "scope": "前回の振り返り以降",
      "heading": "ここから、続けよう。",
      "tabs": [
        "次の一歩",
        "根拠",
        "引き継ぎ"
      ],
      "next": "今、進められる一歩",
      "sources": "参照元",
      "updated": "操作例 · ライブデータではありません",
      "hint": "プロジェクトを選び、根拠や引き継ぎ内容を確認できます。",
      "note": "架空のプロジェクトと会話を使った操作例です。ファイルは読み取りません。",
      "target": "引き継ぎ先",
      "copy": "例の文脈をコピー",
      "copied": "例の文脈をコピーしました。",
      "copyFailed": "ここでは自動コピーできません。プレビューの文字を選択してコピーしてください。",
      "handoffNote": "このデモは例文をコピーするだけです。エージェントの起動や送信は行いません。",
      "packageLabels": [
        "目標",
        "確認済みの状態",
        "次の一歩",
        "根拠"
      ],
      "evidenceLabel": "架空の参照元の抜粋",
      "you": "あなた",
      "assistant": "エージェント",
      "reference": "参照元",
      "projects": [
        {
          "name": "Atlas デスクトップ",
          "item": "デスクトップ版の提供を完了する",
          "status": "検証待ち",
          "states": [
            "コード完了",
            "実機確認",
            "公開済み"
          ],
          "summary": "実装と自動テストは完了しています。最新の記録では実機確認が必要とされており、公開は確認されていません。",
          "next": "クリーンな端末でインストーラーを実行し、結果を記録してから公開します。",
          "evidence": [
            {
              "role": "assistant",
              "date": "月 · 14:20",
              "text": "実装と自動テストは完了しました。インストーラーはクリーンな端末での確認が残っています。"
            },
            {
              "role": "you",
              "date": "火 · 09:10",
              "text": "実機確認が終わるまでは未完了にしてください。まだ公開していません。"
            }
          ]
        },
        {
          "name": "Fieldnotes 記事",
          "item": "記事を公開まで進める",
          "status": "結果が未確認",
          "states": [
            "下書き完了",
            "最終確認",
            "公開済み"
          ],
          "summary": "記事とカバー画像は準備できています。その後の会話で導入文が変更されました。選択した記録には公開リンクがありません。",
          "next": "最終稿と最新の修正を照合し、すでに公開されていないか確認します。",
          "evidence": [
            {
              "role": "assistant",
              "date": "月 · 16:45",
              "text": "記事とカバー画像を保存しました。この会話では投稿先にアップロードしていません。"
            },
            {
              "role": "you",
              "date": "火 · 10:30",
              "text": "このメッセージの短い導入文を使ってください。以前の具体例は残します。"
            }
          ]
        },
        {
          "name": "Northstar 提案書",
          "item": "提案書の最後の判断をまとめる",
          "status": "判断待ち",
          "states": [
            "範囲を合意",
            "料金を決定",
            "顧客が承認"
          ],
          "summary": "3つの納品段階は確認済みです。サポート料金はまだ提案段階で、顧客の承認も記録されていません。",
          "next": "最終提案書の前に、サポート料金と対応時間を決めます。",
          "evidence": [
            {
              "role": "you",
              "date": "月 · 11:00",
              "text": "3つの納品段階は維持します。年間サポート料金はまだ決めていません。"
            },
            {
              "role": "assistant",
              "date": "月 · 11:12",
              "text": "合意した範囲を下書きに反映しました。料金は提案段階で、顧客には送っていません。"
            }
          ]
        }
      ]
    },
    "bridge": [
      "会話",
      "決定と仕事",
      "役立つ次の一歩"
    ],
    "workflow": {
      "kicker": "01 / 仕事の流れをたどる",
      "title": "会話が終わっても、\n仕事は続きます。",
      "intro": "Carrythread は会話をまたいで結果を追い、回答の完了後に残る納品の一歩を見える形にします。",
      "steps": [
        {
          "title": "記録をひとつの視点に。",
          "body": "振り返るローカルの参照元と期間を選択。何を読み、何が変わり、どこが未確認なのかを把握できます。",
          "tags": [
            "明確な範囲",
            "元の履歴は読み取り専用"
          ]
        },
        {
          "title": "大切な進展を取り戻す。",
          "body": "決定、根拠、未解決の質問とともに候補事項を確認。修正・統合・分割ができ、保留した仕事は保留のまま残ります。",
          "tags": [
            "根拠にリンク",
            "あなたの修正を維持"
          ]
        },
        {
          "title": "文脈を持って再開する。",
          "body": "目標、確認済みの決定、現在の状態、参照元を引き継ぎ資料に。内容を確認してから次のツールを選びます。",
          "tags": [
            "共有前のプレビュー",
            "実際の連携範囲を表示"
          ]
        }
      ],
      "statement": "「書き終えた」と「届けられた」は、別の瞬間です。",
      "statementBody": "作成、テスト、公開、受け入れを分けて記録。根拠がない結果は不明のまま保ち、提案を勝手にあなたの約束へ変えません。"
    },
    "sources": {
      "kicker": "02 / 使い慣れたツールをそのまま",
      "title": "ツールが違っても、\n仕事の流れはひとつ。",
      "intro": "v0.1 は以下のローカル履歴を対象とします。各アダプターが形式と範囲の制限を報告し、検証済みの範囲はリリースノートに明記します。",
      "columns": [
        "参照元",
        "読み取り範囲",
        "制限"
      ],
      "rows": [
        [
          "Codex",
          "ローカルの会話履歴",
          "利用可能なCLI・デスクトップ記録。検索できても、元のセッションを再開できるとは限りません。"
        ],
        [
          "Claude Code",
          "プロジェクト内の会話",
          "保存済みの記録を読みます。ClaudeのWebアカウントには接続しません。"
        ],
        [
          "OpenCode",
          "旧JSON・v1 SQLite・書き出し",
          "OpenCode v2のsession_messageテーブルは未対応です。検出時は部分的なカバー範囲として報告します。"
        ],
        [
          "Pi",
          "保存済みJSONL（v1–v3）",
          "会話ツリーを保持します。架空のサンプルで検証済み。独自の保存先は明示的に選択します。"
        ],
        [
          "Finch",
          "ネイティブログとスナップショット",
          "ネイティブ履歴を優先。スナップショットで日時が欠ける場合は、その不足を明示します。"
        ],
        [
          "JSON / JSONL / Markdown",
          "選択したファイル",
          "他のツールや文章のファイルを明示的に取り込み、元の参照情報を保持します。"
        ]
      ],
      "note": "記録の読み取り、元の会話を開くこと、セッション再開、メッセージ送信は別々の機能です。利用できる操作を表示し、ウィンドウが開いただけでエージェントが読んだとは扱いません。"
    },
    "privacy": {
      "kicker": "03 / 意図を持った境界",
      "title": "あなたの記録。\nあなたが選ぶAI。",
      "intro": "ローカル保存と、明示的に選択するAI分析を前提に設計しています。資料、サービス、送信のタイミングを自分で決められます。",
      "points": [
        {
          "title": "元の記録は変更しません。",
          "body": "履歴は読み取り専用です。索引と仕事の状態は別に保存し、アカウントやテレメトリーを必須にしません。"
        },
        {
          "title": "共有する内容を事前に確認。",
          "body": "AIは選択した資料を分析します。明らかな認証情報を伏せる処理と引き継ぎプレビューを用意します。共有前に機密情報を確認してください。"
        },
        {
          "title": "自分のキー、またはローカルモデル。",
          "body": "外部サービスを選ぶと、そのポリシーのもとで選択した内容を送信します。ローカルモデルなら推論を自分の端末内に留められます。"
        }
      ],
      "providerTitle": "v0.1 の対象プロトコル",
      "providers": [
        [
          "OpenAI-compatible",
          "任意のURLとモデル"
        ],
        [
          "Anthropic",
          "自分のAPIキー"
        ],
        [
          "Ollama",
          "ローカル推論"
        ]
      ],
      "providerNote": "認証情報は自分で用意し、利用料は各サービスが請求します。モデル一覧を取得できなくても手入力できます。",
      "keyNote": "キーはOSに保護された領域へ保存します。安全な保存先が利用できない場合はセッション内だけに保持し、黙って平文保存しません。"
    },
    "open": {
      "kicker": "04 / オープンに構築",
      "title": "使い続けられる、\n実用的な土台。",
      "intro": "コアはオープンソースで、モデルは自分で選べます。ローカル履歴の読み取り、振り返り、引き継ぎの書き出しに課金の壁を設ける予定はありません。",
      "coreLabel": "無料のオープンソースコア",
      "coreTitle": "日々の仕事を続ける場所",
      "coreBody": "ローカル記録を整理し、根拠を確認し、持ち運べる文脈を次のツールへ渡します。",
      "coreFeatures": [
        "ローカル取り込みと振り返り",
        "決定、修正、仕事の履歴",
        "引き継ぎプレビューと書き出し",
        "自分のサービスやローカルモデル"
      ],
      "coreCta": "リポジトリを見る",
      "futureLabel": "将来の任意サービス",
      "futureTitle": "必要なときに、追加の支援を。",
      "futureBody": "ホスト型同期、チーム連携、導入支援は今後検討する可能性があります。現在利用できるプランや公開日の約束ではありません。",
      "futureItems": [
        "ホスト型の同期",
        "チームの振り返りと連携",
        "導入設定とサポート"
      ],
      "futureState": "検討候補",
      "futureNote": "今回のリリース範囲には課金、有料プラン、クラウド同期を実装しません。"
    },
    "faq": {
      "kicker": "最初に知っておきたいこと",
      "title": "始める前に。",
      "items": [
        {
          "q": "Carrythreadがエージェントを実行しますか？",
          "a": "実行は選んだツール側で行います。Carrythreadは根拠を整理して文脈を準備します。デプロイ、支払い、公開、顧客への連絡は別の操作です。"
        },
        {
          "q": "記録が食い違った場合は？",
          "a": "参照元と日付を保持し、AIの解釈を確認できます。新しい根拠が増えても、明示的な修正や保留・中止の状態は保持します。"
        },
        {
          "q": "別のパソコンに仕事を持っていけますか？",
          "a": "v0.1には仕事と引き継ぎ資料の明示的な書き出し・取り込みを含めます。自動的なクラウド同期は約束しません。"
        },
        {
          "q": "対応言語と配布物は？",
          "a": "このサイトは英語、簡体字中国語、スペイン語、日本語で利用できます。アプリの翻訳、OSごとの配布物、署名状況、検証済みアダプターは各リリースに記載します。"
        }
      ]
    },
    "cta": {
      "title": "戻ったときには、次の一歩が見えている。",
      "body": "文脈を保ち、仕事の続きを。",
      "github": "GitHub で見る"
    },
    "footer": {
      "caption": "複数のAIツールで働く人のための、独立したオープンソースプロジェクト。",
      "docs": "ドキュメント",
      "issues": "フィードバック",
      "brand": "ブランド素材",
      "privacy": "データの境界",
      "languageNote": "追跡は行いません。このページは言語の選択だけをローカルに保存します。"
    },
    "installation": {
      "title": "選んだ仕事から、始めましょう。",
      "steps": [
        "Releasesから利用可能な配布物を選び、OS・署名・検証状況の説明を確認します。",
        "Carrythreadを開き、ローカルの履歴か取り込むファイルを選びます。",
        "まず記録を確認。AIで分析したいときに、任意のサービスと対象範囲を設定します。"
      ],
      "note": "配布物がまだない場合はリポジトリを確認してください。ソースからの実行方法はREADMEにあります。"
    }
  }
};
