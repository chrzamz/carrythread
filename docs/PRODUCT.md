# Carrythread · 续迹 — v1 product

## Promise
Leave a project and return without losing its decisions, unfinished work, or the evidence needed to take the next step. Keep using existing agents. Carrythread connects their records to durable work items and prepares context for continuation.

The primary users are independent developers, consultants and small teams working across several real projects and at least two AI tools. Success is fewer missed delivery steps, less repeated explanation and faster resumption, not the number of generated tasks.

## Frequent scenarios

1. **Start the day.** Read what changed since the last review, where projects stopped and a small set of possible next actions. Unknown and unscanned sources remain visible. Do not demand confirmation of every old transcript.
2. **Switch projects.** Find a work item with decisions, artifacts, evidence and a pause point. One conversation may concern several projects; several conversations may describe the same item.
3. **Finish delivery.** Separate creation, testing, publishing and acceptance. Generated code is not a successful deployment; a written article is not a published post.
4. **Continue a decision.** Preserve the latest confirmed inputs and expose only unresolved choices. Distinguish a user's decision from an assistant proposal and from a customer's acceptance.
5. **Continue in another agent.** Preview a package with goal, confirmed decisions, state, open questions, recent source excerpts and file pointers. Choose a supported target, verify the working directory and carry the package there. Report launch/pre-fill/submission accurately.
6. **Correct the record.** Edit, merge or split items, attach a reason and preserve history. Manual state overrides survive subsequent AI reviews. Paused and cancelled work does not silently return to the active queue.
7. **Review changes.** Import only new or changed source material, review a selected time/project scope, display failures without discarding healthy sources, and reconcile new proposals into existing items.

## AI and language
AI extracts and proposes work state from selected, redacted evidence. No credentials are sent with a transcript. Invalid or unsupported model output must not create authoritative state. Existing records remain usable without AI. Supply OpenAI-compatible, Anthropic and Ollama protocols with visible domestic/international presets, custom endpoint and model fields, connection testing and clear limits. A failed model-list endpoint is not a failed provider: manual model entry is always supported.

English and Simplified Chinese must be complete at launch. Spanish and Japanese will use the same catalogue and ship only with complete key parity. Language switches preserve current work. Source text is retained in its original language; generated reviews use the selected output language.

## Release scope
Local desktop app with Electron, React and a local SQLite database. Windows, macOS and Linux build targets; tested and unsigned/notarized status must be stated per artifact. There is no account requirement or telemetry. Data stays local unless the user explicitly runs analysis through a selected external provider or exports a package. A local model can keep inference local.

The first version includes real Codex, Claude Code, OpenCode, Pi and Finch history adapters and generic JSON/Markdown import. Source capability and version limitations are disclosed. All agent execution remains in the chosen existing tool. Multi-device portability is provided through explicit export/import of work and handoff material; transparent cloud synchronization is not claimed.

The public site contains a faithful product walkthrough, supported-source matrix, model/privacy details, downloads, docs and GitHub links. Demo data is synthetic. No invented customers, performance statistics or testimonials.

## Not automatic
Publishing, deployment, payments, customer messages, modifying native agent histories, and wholesale ingestion of the home directory. A handoff of a pending task does not inherit old execution authorization.

## End-to-end acceptance
Synthetic fixture suite and separately selected local records: import → inspect provenance → AI review → correct one state → create a redacted handoff → open the supported destination → verify the delivered material → import new evidence → reconcile without overriding confirmed or paused states. Test the negative cases: no duplicate mirror messages, no revival of stopped work, no fabricated completion, no unsupported source IDs, no secrets in exports or logs, and readable failures when an application/session/file is unavailable.

