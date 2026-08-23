# Architecture and overlap report

Date: 2026-08-24
Repositories reviewed: `imedkablavi/osint-tool-COMPLETE-v4.0` and `imedkablavi/OSINT-Roadmap`

## Decision

Keep this repository independent and reposition it as **OSINT Casebook**, a local desktop case workspace that complements OSINT-Roadmap. Do not merge the Electron runtime, investigation database, or case UI into the static Roadmap site.

## Evidence

| Capability | OSINT-Roadmap | Original desktop repository | Ownership after this change |
|---|---|---|---|
| Learning paths and research methods | Core capability in `docs/`, `tracks/`, `challenges/` | Duplicated across many long guides | Roadmap only |
| Tool catalog and discovery | `site/tools.json`, Tool Finder, multilingual tool libraries | Hard-coded platform/dork lists | Roadmap owns discovery; Casebook keeps only runtime provider definitions |
| Static web/search/SEO | GitHub Pages, search, sitemap, localized routes | None | Roadmap only |
| Local investigation records | None | SQLite persons, evidence, logs and graph | Casebook only |
| Provider execution | Links users to tools | Electron collectors | Casebook, only when evidence/failure semantics are tested |
| Desktop packaging | None | Electron prototype without build scripts | Casebook only |
| Sensitive case-data lifecycle | Not applicable to public reference content | Previously stored beside source | Casebook, moved to Electron user-data with deletion/redaction controls |

## Why not merge

The Roadmap is a public, static, low-trust-content site. Casebook handles user-entered identifiers, API credentials, a mutable SQLite database, native dependencies, and desktop release artifacts. Combining them would enlarge the Roadmap's attack surface and CI burden while making its public educational deployment responsible for sensitive local state.

## Overlap removed or redirected

- Removed duplicate advanced-feature, Google dork, face-search, and multi-dimensional-search guides. Maintained educational material belongs in OSINT-Roadmap.
- Removed unvalidated face/image search, shell-launched Sherlock/Maigret/Holehe, proxy/Tor, export, and experimental dork modules from the shipped code. Their earlier documentation exceeded tested behavior.
- Kept a small platform provider list only because the desktop app executes bounded candidate checks. It is not a general tool catalog.
- Added an explicit Roadmap companion link and scope rules to README/CONTRIBUTING.

## Target architecture

The renderer is an unprivileged presentation layer. A narrow preload bridge calls validated main-process handlers. The main process owns Node's built-in SQLite connection and invokes collectors through one HTTP abstraction. Logs pass through redaction before console/database storage. Investigation results remain local unless a configured collector sends the minimum query required to its documented public provider.

## Re-evaluation trigger

Reconsider independence only if the desktop case database and native packaging are removed. Individual educational pages, provider-selection explanations, or maintained tool metadata should be contributed to OSINT-Roadmap rather than recreated here.
