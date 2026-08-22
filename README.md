# OSINT Tool v4.1

Local-first Electron desktop workspace for lawful open-source intelligence investigations. The application is designed around case records, source attribution, conservative confidence scoring, and keeping investigation data on the operator's machine.

> **Status:** v4.1 commercial-foundation work. The active workflow uses live sources or explicitly skips unavailable sources; it does not fabricate breach or domain-registration results.

## What works now

- **Local case workspace** backed by SQLite in the operating system's application-data directory.
- **Case lifecycle controls** including opening and two-step deletion of local cases and their dependent records.
- **Portable case export** to JSON or self-contained HTML with source notes, confidence limitations, HIBP attribution, and safe HTML escaping.
- **Public profile URL checks** with conservative evidence and confidence levels. A URL match is presented as a *possible* account, never as proof of identity.
- **Have I Been Pwned integration** for authenticated email breach searches when the user provides an API key.
- **RDAP domain registration lookup** for non-consumer email domains.
- **Relationship graph and correlation summary** across collected case entities.
- **Source and activity logs** for investigation steps.
- **Hardened Electron renderer** using a narrow preload bridge, context isolation, renderer sandboxing, CSP, navigation restrictions, and IPC sender validation.
- **Secure API-key storage** using the operating system credential backend. Linux `basic_text` fallback is rejected rather than storing a weakly protected secret.
- **Desktop packaging** for Linux (AppImage/deb), Windows (NSIS), and macOS (DMG/zip).
- **CI quality gate** with JavaScript syntax checks and deterministic Node tests.

## Accuracy model

OSINT results are evidence, not identity proof. Social-profile checks can be affected by redirects, login walls, WAFs, anti-bot systems, and site changes. The application therefore labels those results as possible matches and keeps confidence deliberately conservative.

HIBP and RDAP results are source records. They should still be interpreted in context and verified before being used in a report or decision.

## Requirements

- Node.js 22 or newer for development
- npm
- A supported desktop environment for Electron
- Optional: a Have I Been Pwned API subscription/key for email breach lookup

## Install and run

```bash
git clone https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0.git
cd osint-tool-COMPLETE-v4.0/osint-tool
npm install
npm start
```

Developer mode:

```bash
npm run dev
```

## Case management and export

Open **Cases** to review locally stored investigations. Deletion uses a two-step in-app confirmation and removes dependent case data transactionally, including compatibility cleanup for databases created before cascade rules were introduced.

From an open report you can export:

- **JSON** — a versioned portable case object suitable for later tooling and archival workflows.
- **HTML** — a self-contained, printable report with a restrictive CSP, escaped source-controlled fields, source attribution, and confidence caveats.

Exports are written only after the user selects a destination through the operating-system Save dialog.

## Have I Been Pwned

Open **Settings** inside the application and enter your HIBP API key. The key is encrypted through Electron `safeStorage` and is not returned to the renderer after it is stored. If a secure OS credential backend is unavailable, the application refuses to save the key.

HIBP breach data is attributed in the user interface and exported reports. HIBP's breach and paste APIs require attribution under the Creative Commons Attribution 4.0 license; users are also responsible for complying with HIBP's API terms and rate limits.

## Build installers

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

Build output is written to `osint-tool/dist/`.

Native dependencies such as `better-sqlite3` are rebuilt for the installed Electron runtime during `npm install`.

## Quality checks

```bash
npm run check
```

This runs JavaScript syntax validation and the Node test suite. Pull requests also contain a GitHub Actions quality-gate workflow.

## Architecture

```text
osint-tool/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main process, IPC, storage and orchestration
│   │   └── preload.js     # Narrow contextBridge API
│   ├── renderer/          # Local UI only; no Node.js integration
│   ├── modules/           # Profile, HIBP, RDAP and optional analysis collectors
│   ├── database/          # SQLite schema and persistence
│   └── utils/             # Correlation, report export and supporting utilities
├── scripts/               # Static checks and test discovery
├── tests/                 # Deterministic automated tests
└── package.json           # Runtime, build and packaging configuration
```

## Data and privacy

Case records are stored locally. The active workflow sends only the identifiers required by the selected public data source. Database files, WAL/SHM files, API keys, exports, and private investigation material should never be committed to Git; common SQLite database file extensions are ignored by the repository.

The application is intended for authorized and lawful research, security work, due diligence, self-investigation, and other legitimate OSINT use. The UI requires an authorized-use confirmation before collection starts.

## Current commercial-readiness gaps

The v4.1 foundation is materially safer and more usable, but several features should still be completed before calling it a finished commercial release:

- signed/notarized installers and release provenance
- automatic update strategy
- case archiving and a configurable retention policy
- PDF-native export and stronger evidence provenance/signing workflows
- stronger per-platform username detection adapters and regression fixtures
- migration framework for future database schema changes
- accessibility and end-to-end desktop tests
- crash reporting that is explicitly opt-in and privacy-preserving
- release documentation, screenshots, and support policy

These are tracked as product work rather than being presented as already implemented.

## License

MIT. See [`osint-tool/LICENSE`](osint-tool/LICENSE).

Third-party services and datasets retain their own terms and licenses.

## Author

**iEmmAd / cybrex**  
GitHub: `imedkablavi`
