# OSINT Tool v4.1

Local-first Electron workspace for lawful open-source intelligence investigations. The v4.1 branch is built around **live source adapters, explicit evidence provenance, and fail-closed collection**: unavailable or ambiguous sources are skipped instead of generating plausible-looking data.

## Real data pipeline

### Public usernames

Built-in sources:

- **GitHub REST API** — exact public username records with profile metadata returned by GitHub.
- **GitLab Users API** — exact username lookup and public profile fields returned by GitLab.
- **Official Hacker News API** — case-sensitive user IDs, about text, karma and public activity metadata.
- A small set of **public-page probes** for sources without a suitable anonymous profile API. These are deliberately lower-confidence and require manual verification.

Optional local extended search:

- **Sherlock**, when installed and enabled by the operator.
- **Maigret**, when installed and enabled. The integration consumes Maigret's machine-readable `simple JSON` report rather than parsing human console text.

Sherlock/Maigret results are deduplicated against built-in API results and are never presented as identity proof.

### Email breaches

- **Have I Been Pwned API v3** with a user-provided API key.
- Missing/rejected/rate-limited credentials create no synthetic breach records.
- HIBP attribution is retained in the UI, evidence records and exports.

### Domain intelligence

For non-consumer email domains the application collects, independently and in parallel:

- **RDAP** registration data
- **Google Public DNS DoH**: A, AAAA, MX, NS, TXT, CAA and DMARC TXT
- SPF/DMARC signals derived from live DNS
- best-effort **Certificate Transparency** names

One failed source does not discard valid evidence from the others. Missing/redacted RDAP registrant values remain null rather than being invented.

## Evidence provenance

Results are backed by a separate SQLite `source_evidence` model containing:

- source name and type
- related entity
- evidence method/type
- source URL when available
- observation timestamp
- evidence-quality score
- source-specific metadata and caveats

The application includes an **Evidence** tab. JSON/HTML exports use schema **1.1** and include `evidence[]` plus provenance metadata.

> Evidence quality measures how direct/reliable the source observation is. It is **not** an identity probability.

## Deliberately disabled unreliable behavior

The project no longer treats the following legacy behavior as real evidence:

- fabricated/random reverse-face or reverse-image matches
- Holehe-style account-recovery/rate-limit inference in the commercial evidence pipeline
- Google result-page HTML scraping
- random/mock breach records
- mock WHOIS/registrant data

Reverse face/image search returns an explicit unavailable state until an audited live provider with appropriate terms is integrated. Local image analysis is limited to SHA-256/file metadata and real EXIF via ExifTool when installed.

## Case workspace

- local SQLite storage in the OS application-data directory
- two-step case deletion with dependent-data cleanup
- relationship graph using evidence-aware semantics
- source/activity logs
- JSON and self-contained HTML exports
- Evidence provenance review
- source-readiness indicators for HIBP, Sherlock, Maigret and ExifTool

## Electron security

- `nodeIntegration: false`
- `contextIsolation: true`
- renderer sandbox + web security
- narrow `contextBridge` preload API
- restrictive CSP
- IPC sender validation
- HTTPS-only external links
- OS-backed HIBP credential storage; Linux `basic_text` fallback is rejected
- external tools launched with `spawn(..., { shell: false })`

## Install and run

```bash
git clone https://github.com/imedkablavi/osint-tool-COMPLETE-v4.0.git
cd osint-tool-COMPLETE-v4.0/osint-tool
npm install
npm start
```

Run quality checks:

```bash
npm run check
```

Build installers:

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

For the detailed source contract, evidence grades and failure behavior, see [`osint-tool/docs/DATA_SOURCES.md`](osint-tool/docs/DATA_SOURCES.md).

## Commercial-release gaps

The data pipeline is now substantially more real and auditable, but a final commercial release still needs:

- signed/notarized releases and secure updater
- versioned database migrations
- E2E/accessibility desktop tests
- native PDF export
- full Local Image Analyzer UI
- an official Search API adapter instead of investigator-assisted query generation
- opt-in privacy-preserving crash reporting
- release screenshots/support policy

## License

MIT. Third-party services retain their own terms, licenses and rate-limit policies.
