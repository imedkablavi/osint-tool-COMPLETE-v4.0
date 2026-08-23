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

### Search and passive infrastructure intelligence

The case pipeline can combine several real structured providers without active scanning from the user's machine:

- **Brave Search API** — bounded structured web search using a user-supplied token.
- **Internet Archive / Wayback CDX** — historical captures for a case-derived domain.
- **IP RDAP** — registration/allocation context for public A/AAAA addresses returned by DNS.
- **urlscan.io Search API** — existing historical scan records only; the app does not automatically submit new scans.
- **VirusTotal API v3** — read-only domain reputation and existing analysis context.
- **Shodan Host API** — read-only `minify=true` host-index information for public DNS-derived IPs; no active Shodan scan/alert/monitor endpoints are used.

Wayback and IP RDAP work without credentials. Brave, urlscan, VirusTotal and Shodan are optional and their keys are stored through Electron `safeStorage`. Private, link-local, documentation, multicast and other reserved IP ranges are filtered before third-party IP enrichment.

Discovery/archive/reputation/host-index records are kept separate from identity probability: they provide source context, not proof that a person owns or controls a domain, IP or service.

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

### Local image evidence

The desktop UI includes a **Local Image Analyzer**:

- file selection is owned by the Electron main process
- SHA-256 is always calculated locally
- ExifTool metadata is extracted when ExifTool is installed
- camera, capture and GPS metadata are normalized when present
- no automatic third-party upload
- when attached to a case, the database stores an opaque SHA-256 reference and metadata, not the original image path or bytes

## Evidence provenance

Results are backed by a separate SQLite `source_evidence` model containing source, entity, method, URL, observation time, evidence-quality score and provider-specific metadata/caveats. JSON/HTML exports use schema **1.2** and include discovery/enrichment, local-media and provenance records.

> Evidence quality measures how direct/reliable the source observation is. It is **not** an identity probability.

## Deliberately disabled unreliable behavior

The project no longer treats the following legacy behavior as real evidence:

- fabricated/random reverse-face or reverse-image matches
- Holehe-style account-recovery/rate-limit inference in the commercial evidence pipeline
- search-result HTML scraping
- random/mock breach records
- mock WHOIS/registrant data
- automatic urlscan submissions or Shodan active scans

Reverse face/image search returns an explicit unavailable state until an audited live provider with appropriate terms is integrated.

## Electron security

- `nodeIntegration: false`
- `contextIsolation: true`
- renderer sandbox + web security
- narrow `contextBridge` preload API
- restrictive CSP
- IPC sender validation
- HTTPS-only external links
- OS-backed credential storage; Linux `basic_text` fallback is rejected
- external tools launched with `spawn(..., { shell: false })`
- local image file picker is handled by the main process instead of exposing filesystem access to the renderer
- third-party IP enrichment receives public addresses only after reserved/private filtering

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

Current GitHub Actions verification on the feature branch validates **54 JavaScript files and 53/53 tests**, followed by a successful Electron 43.4.1 native dependency rebuild for `better-sqlite3`.

The regression suite covers provider parsing/mapping, credential fail-closed behavior, private/reserved-IP filtering, urlscan submission prohibition, Shodan active-scan prohibition, raw-banner exclusion, provenance/export escaping, and Electron isolation.

Build installers:

```bash
npm run build:linux
npm run build:win
npm run build:mac
```

For detailed endpoint contracts, evidence grades and fail-closed behavior, see [`osint-tool/docs/DATA_SOURCES.md`](osint-tool/docs/DATA_SOURCES.md).

## Commercial-release gaps

The data pipeline is substantially more real and auditable, but a final commercial release still needs:

- signed/notarized releases and secure updater
- versioned database migrations
- E2E/accessibility desktop tests
- native PDF export
- deeper provider abstraction with configurable rate/budget policy
- image magic-byte validation and deeper local image analysis
- opt-in privacy-preserving crash reporting
- release screenshots/support policy

## License

MIT. Third-party services retain their own terms, licenses and rate-limit policies.
