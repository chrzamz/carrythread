# Carrythread · 续迹

## Positioning

Carrythread is a local workspace for people working across multiple AI agents and projects. It connects conversation records to durable work items: what was decided, what changed, what remains unfinished, and the evidence needed to continue.

The audience is independent developers, consultants, and small teams. The benefit is less repeated explanation and fewer missed delivery steps. Agent execution remains in the existing tool the user chooses.

**English promise:** Keep the context. Carry the work forward.

**中文表达：** 接上工作脉络，把事情推进到结果。

**Repository description:** A local workspace for reviewing work across AI agents, preserving decisions, and carrying context into the next step.

## Name

- English: **Carrythread**. Use this capitalization in prose.
- Chinese: **续迹**. First mention may be **Carrythread 续迹**.
- Repository, directory, package, CLI candidate: `carrythread`.
- Pronunciation: **carry + thread**.

“Thread” is both a conversation and a thread of work. “Carry” brings that context into the next working session, tool, or action. “续迹” combines continuation with a trace that can be followed back to its source.

The name is eleven letters and benefits from a descriptive sentence on first introduction. It is not tied to a particular provider or to coding alone.

## Message hierarchy

1. **Recover the work.** Bring records together without changing the originals.
2. **Know what remains.** Distinguish creation, testing, publication, acceptance, decisions, and pauses.
3. **Continue with the right context.** Inspect evidence and preview a portable handoff.

Keep language concrete. A record can be imported; a proposal can be reviewed; a window can be opened. None of those events by itself means a model read the handoff or a customer accepted the work.

Use **Open original conversation**, **Prepare handoff**, **Copy context**, and **Submit** only for the action actually performed. Show unknown outcomes and incomplete source coverage. Do not promise support for every version of an agent or every web/cloud conversation.

Do not invent customer counts, time-savings statistics, testimonials, endorsements, or “never forget” guarantees. Demo projects and source excerpts must be visibly labelled as synthetic. Local storage does not mean external AI processing is local: the user must be told when selected content goes to a provider.

## Visual identity

The original mark is a folded page with a continuous thread passing through it and continuing forward. The page represents recorded decisions; the thread represents continuity. The forward end points to the next action without implying that the work is already complete.

Assets:

- `resources/brand/mark.svg`: square mark, 64 × 64 viewBox.
- `resources/brand/wordmark.svg`: text-only wordmark.
- `resources/brand/logo.svg`: mark and wordmark.
- `site/assets/`: identical source copies used by the static site.

The three brand files were drawn for Carrythread. They do not reuse competitor logos. The wordmark uses system-font fallback rather than an externally loaded font. Font outlines may be added later if consistent rendering is needed across design tools.

The project visual authority is `design/visual-system.md`; the application CSS owns application tokens. The website applies the same roles at an editorial scale:

| Role | Value | Meaning |
|---|---|---|
| Paper | `#F7F5F0` | Reading surface |
| Ink | `#202733` | Primary text |
| Indigo | `#4C5AC7` | Brand and main action |
| Muted | `#626A78` | Secondary text |
| Line | `#DEDCD6` | Quiet separation |
| Amber | `#9B641E` | Unverified outcome; not automatic urgency |
| Green | `#28725B` | Verified or completed state |

Keep the mark clear at small sizes. Do not add AI sparkles, robot faces, gradients across the whole page, or a wreath of provider logos. Colour must not be the only indication of status.

## Lightweight naming checks

Checked **2026-11-03** through public search and registry HTTP queries. These are collision checks, not trademark clearance. No domain was purchased or social account registered.

| Candidate | Result | Decision |
|---|---|---|
| **Carrythread** | No clear same-name AI work-management product found in the bounded search; a Rust type named `CarryThread` exists | Selected |
| Threadwake | Highly related public workgraph proposal and local Codex plugin | Excluded |
| Threadmark | AI conversation extensions, team memory workspace, and other established uses | Excluded |
| WorkBraid | Local architecture workbench for people and coding agents | Excluded |
| Trailkeep | Outdoor planning and safety software | Excluded |
| CarryTrail | Travel compression-bag brand | Excluded |
| WorkMargin | Job costing/profit app | Excluded |
| ThreadHarbor | ChatGPT local-backup extension and messaging software | Excluded |
| Workseam | AI business-experiment platform | Excluded |
| Afterlane | Car community app | Excluded |
| Aftercue | Existing company and clothing uses | Not selected |
| Seamnote | Existing physical notebook product | Not selected |
| Relayleaf | Related software identifier `RelayLeaf` and registered .com | Not selected |
| Loopfolio | Naming-directory and other product uses; less direct meaning | Not selected |

Primary references for clear conflicts:

- [Threadwake repository](https://github.com/albertbuchard/threadwake)
- [WorkBraid repository](https://github.com/luiscleto/workbraid)
- [Threadmark workspace](https://www.threadmark.space/)
- [Threadmark browser extension](https://addons.mozilla.org/en-US/firefox/addon/threadmark/)
- [Trailkeep](https://trailkeep.com/about)
- [CarryTrail](https://carrytrail.com/)
- [WorkMargin](https://apps.apple.com/ua/app/workmargin/id6816556580)
- [ThreadHarbor extension](https://chromewebstore.google.com/detail/threadharbor-%E2%80%94-automatic/kjdiepoggflegdoofigdhbjfdhemainj)
- [Workseam](https://workseam.ai/)
- [Afterlane](https://theafterlane.com/)

### Domain and package checks

| Candidate | Observed result | Interpretation |
|---|---|---|
| `carrythread.dev` | Registry RDAP HTTP 404 | No registration object returned; preferred candidate, not a purchase or guarantee |
| `carrythread.app` | Registry RDAP HTTP 404 | No registration object returned; alternative candidate |
| `carrythread.com` | Registry RDAP HTTP 200 with registration object | Already registered; do not advertise as owned or available |
| `carrythread.ai` | RDAP HTTP 403 | Unknown |
| npm `carrythread` | Registry HTTP 404 | No package returned at check time; check again before publishing |

Registry references: [`.dev`](https://pubapi.registry.google/rdap/domain/carrythread.dev), [`.app`](https://pubapi.registry.google/rdap/domain/carrythread.app), [`.com`](https://rdap.verisign.com/com/v1/domain/carrythread.com), [npm](https://registry.npmjs.org/carrythread).

Before a domain purchase or wider commercial launch, check the relevant software trademarks, exact registration terms, social handles, and pronunciation with people outside the project. Public search returning no result is not evidence that a name cannot conflict.

## Website language and release honesty

The static website has complete English, Simplified Chinese, Spanish, and Japanese catalogues in `site/messages.js`. The language choice is the only local-storage value this website writes. There are no analytics, trackers, third-party fonts, or provider calls.

`site/release.js` controls the release state. Before the release audit, keep `stage: 'pre-release'`; primary buttons go to the repository's releases page. After a verified public release, root may change the stage to `released`; buttons then go to `/releases/latest`. Never invent a direct installer URL or describe an unsigned build as signed/notarized.

The walkthrough is an interactive illustration using invented projects. It is not a live application screenshot. Its handoff control copies sample text only, and says so beside the button.

Run `node site/check.mjs` for catalogue parity, asset parity, browser runtime, responsive overflow, tab keyboard behaviour, copy behaviour, and preservation of selection when switching languages. Optional screenshots: `node site/check.mjs --screenshots /absolute/output/directory`.
