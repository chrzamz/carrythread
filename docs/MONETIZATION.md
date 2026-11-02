# Open-source core and optional services

## Current decision

Carrythread's everyday local workflow is a free open-source core. Users bring their own model credentials or use a locally running model. The v0.1 release scope does not contain billing, payment processing, paid tiers, hosted synchronization, or a required account.

This document describes boundaries and future candidates. It is not a price list or a promise that those services will ship.

## Free core

The core should remain useful on its own:

- Read explicitly selected local agent histories and user-provided files without editing the originals.
- Index and search records, show source coverage, and retain evidence references.
- Review AI-proposed work items with confirmed decisions, open questions, corrections, merge/split, and pause/cancel history.
- Use a supported external provider with the user's own credentials, or a local provider.
- Preview, copy, and export a redacted handoff; open supported destinations with accurate capability reporting.
- Export/import portable work material and keep access to existing local records.

No artificial limit on imported conversations, projects, manual corrections, or handoff exports is proposed for monetization. Security fixes, source-format compatibility, accessible navigation, and language improvements belong in the core.

## Bring your own model

External API usage is billed by the selected provider under its terms. Carrythread should make the endpoint, model, selection of evidence, and applicable limits understandable before a review starts. A failed model-list endpoint must not force a paid plan or prevent manual model selection.

Using an external model sends selected content to that provider. The free local core must not imply that those calls are free or that the data remains on-device. A local model is an option for users who need local inference; no particular hardware performance is promised.

## Future candidates

| Candidate | Value that could justify payment | Boundary |
|---|---|---|
| Optional hosted synchronization | Carry reviewed work and corrections between devices with reliable conflict handling and recovery | Explicit opt-in. Local use and manual export/import remain available. No claim that current v0.1 syncs automatically. |
| Team review and collaboration | Shared review queues, clear ownership, reviewer history, and organization-controlled data access | Explore only after a real collaboration need appears. Do not turn a personal workspace into mandatory team administration. |
| Setup, migration, and support | Help connect unusual storage formats, configure providers, verify handoffs, and operate the software | A service agreement, not a restriction on the user's own data. Do not promise response times or custom integrations without an agreement. |
| Sponsorship or maintenance support | Fund sustained compatibility work and upstream contributions | Optional. No fabricated sponsor list or donation links before an actual channel exists. |

Pricing is deliberately unspecified. Costs, support obligations, and willingness to pay must be understood before choosing a monthly, per-team, or service fee.

## What should be validated first

Use a small set of voluntary users who already work across multiple agents and projects. Observe actual recurring work: whether they return to the review, recover a missed delivery step, trust its evidence, and successfully carry context back into their chosen tool.

For any paid candidate, identify a concrete buyer and recurring benefit. Compare the saved coordination work with setup and review effort. If a simpler local feature solves the problem, keep it local instead of constructing a hosted dependency.

A signal such as “interesting,” a repository star, or a downloaded installer is not a payment commitment. Requests for sync or teams should be traced to a real working situation rather than generated from a generic SaaS roadmap.

## User trust

- No sale of conversation data, behavioral advertising, or hidden usage collection.
- No auto-enrollment, payment form, or external subscription call in the free desktop workflow.
- No loss of local read/export access if an optional service is later stopped.
- Preserve user corrections and paused work across any future service boundary.
- Explicitly distinguish opening an app, pre-filling context, submitting it, and confirmed receipt.
- Future service accounts and permissions must be designed separately from local provider credentials.

## 中文说明

当前版本采用**免费开源核心 + 自备模型密钥（BYOK）或本地模型**。本地导入、工作回顾、证据核对、事项纠正和交接导出不设置人为付费门槛；模型API费用由所选服务商计收。

未来可以探索托管同步、团队协作、安装配置与支持服务，但都只是候选方向。本版本没有收费、付费套餐、强制账号或自动云同步，也没有价格和服务时效承诺。先验证实际重复需求，再决定是否提供这些服务。
