# Carrythread visual direction

## Intent
An editorial workspace for recovering a thread of work. Prioritize an understandable next action, quiet provenance and stable project orientation. The home surface shows recent changes and unresolved outcomes rather than large numeric productivity cards.

The brand mark is an original continuous line following a folded page and continuing forward. Main action color is restrained indigo; warm paper and dark ink support long reading. Amber identifies unverified outcomes, not urgency. Green is reserved for verified or completed status. These colors are provisional design choices, not facts about the industry.

## Product surfaces
Desktop: compact left navigation, a calm header with current scope, project/work list and an evidence/detail surface. Focus work hides routine noise. Settings organize sources, AI providers, language/appearance, privacy/export and about. Avoid nested cards or excessive badges. One primary action per stage.

Marketing: oversized editorial typography, paper/ink contrast, original thread artwork, a real synthetic-data application walkthrough, clear source/provider support and direct download/GitHub paths. No fake testimonials or performance metrics.

## Tokens
`src/renderer/styles.css` will be authoritative for app CSS variables. Initial light palette: paper #F7F5F0, surface #FFFFFF, ink #202733, secondary #626A78, line #DEDCD6, action #4C5AC7, amber #9B641E, success #28725B, danger #AF4444. Dark mode uses independently checked contrast. Site may use the same palette with a larger typographic scale.

System typography: Inter when bundled with licensed assets, otherwise system sans; Chinese PingFang SC/Microsoft YaHei/Noto Sans CJK; Japanese Yu Gothic/Meiryo. Body 14px desktop, 16px forms; generous 1.55–1.65 reading line height. Keyboard focus visible, no color-only meaning, reduced-motion supported.

## Components and verification
Use semantic native controls and a small set of local React components for buttons, fields, dialogs, tabs and lists. The workflow does not require a large enterprise table library. Lucide supplies licensed icons; the logo is original vector work. Rich source content is rendered as text, never arbitrary HTML.

Check English/Chinese/Spanish/Japanese long labels, 1100px/1440px desktop and marketing mobile widths, keyboard navigation, selection persistence, empty scans, import failures, missing AI keys, model errors, review cancellation, item conflict, paused/cancelled state, handoff failure and dark mode. Record actual results in the release audit.

