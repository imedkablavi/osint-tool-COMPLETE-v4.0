# Data Source Contracts

This document defines which sources may create evidence records in OSINT Tool v4.1 and how failures are interpreted.

A source adapter must never convert a timeout, rate limit, anti-bot page, generic HTTP 200, missing credential, or parser failure into a positive finding.

## Evidence score semantics

`quality_score` measures how directly and reliably the source supports the stored observation. It is **not** the probability that two identities are the same person.

| Range | Meaning |
| --- | --- |
| 90–100 | Direct structured record from a primary/official public API, deterministic local-file observation, or source record |
| 70–89 | Structured search/enumeration result or combined infrastructure evidence |
| 50–69 | Public page metadata or other indirect but inspectable evidence |
| 1–49 | Weak URL/page observation that requires substantial manual verification |
| 0 | No positive evidence; should not normally create an entity record |

## Credential handling

HIBP, Brave Search, urlscan.io, VirusTotal and Shodan credentials are user-supplied and stored with Electron `safeStorage`. The renderer receives only `has...ApiKey` readiness booleans; decrypted secret values remain in the trusted main process. On Linux, the application rejects Electron's `basic_text` safeStorage backend for secret persistence.

## Built-in profile sources

### GitHub REST API

- Input: username
- Endpoint family: `api.github.com/users/{username}`
- Authentication: not required for normal public lookups; service rate limits apply
- Positive condition: HTTP 200 and returned `login` exactly matches the requested username case-insensitively
- Stored fields: login, display name, avatar, bio, followers/following, company, location, public email, website, public repositories/gists and timestamps when returned
- Evidence type: `exact_username_api_record`
- Default quality: 95
- 404: not found; creates no account record
- 403/429: inconclusive/rate limited; creates no account record

### GitLab Users API

- Input: username
- Endpoint family: `gitlab.com/api/v4/users?username=...`
- Authentication: not required for supported public fields; service limits/policies apply
- Positive condition: returned array contains an exact username match
- Stored fields: public fields returned by GitLab, including display name, avatar, bio, public email, organization/location/website when present
- Evidence type: `exact_username_api_record`
- Default quality: 95
- Empty result/rate limit/access restriction: creates no account record

### Hacker News API

- Input: username
- Endpoint family: `hacker-news.firebaseio.com/v0/user/{id}.json`
- Authentication: none
- Positive condition: object exists and returned `id` exactly equals the requested case-sensitive username
- Stored fields: about text, karma, created timestamp, submitted item count
- Evidence type: `exact_username_api_record`
- Default quality: 95
- Null/404: creates no account record

## Web Search Intelligence

### Brave Search API

- Inputs: available case email, username, and case name
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Authentication: user-supplied subscription token stored through Electron `safeStorage`; the token is used only by the main process in `X-Subscription-Token`
- Query budget: at most 6 queries per case run and 8 requested results per query
- Query plan: exact email, email PDF search, exact username, username-in-URL, exact name, and name PDF search when the corresponding identifier exists
- Positive condition: provider returns a structured web result with a valid HTTP(S) URL
- Deduplication: normalized URL within the case; URL fragments are removed before storage
- Stored fields: provider, title, URL, text-only snippet, observation time
- Evidence type: `web_search_result`
- Source type: `official_search_api`
- Default quality: 85
- Missing key: source is skipped without any network request
- 401/403: credential rejected; no result stored
- 422: query rejected; no result stored
- 429: rate limited; no result stored
- Search results are **retrieval evidence only** and are excluded from aggregate identity-style confidence scoring

The application deliberately does not scrape Google/Brave result HTML as a substitute for the API.

## Public page probes

Current low-confidence page probes are limited to a small set of public profile URLs such as Telegram, Medium, Twitch and Pinterest.

A positive page observation requires more than HTTP 200. The adapter rejects:

- 404/410
- 401/403/409/429 and other error responses
- cross-host redirects
- redirects to generic login/home/explore pages
- known not-found text markers
- CAPTCHA/WAF/challenge markers
- pages without a path or metadata relationship to the requested username

Evidence quality is lower than official APIs and every result carries an explicit manual-verification caveat.

## Have I Been Pwned

- Input: email address
- Source: HIBP API v3
- Authentication: user-supplied API key stored with OS-backed Electron `safeStorage`
- Positive condition: HIBP returns breach records for the queried account
- Evidence type: `breached_account_record`
- Quality: 100 for source-verified breach records, 80 otherwise
- 404: no breach records
- missing key: source is skipped explicitly
- 401/403/429: error/inconclusive; no fabricated result
- Attribution: HIBP source attribution is retained in the application and exports

## Domain Intelligence

Domain intelligence is only run for non-consumer email domains.

### RDAP

- Input: domain derived from the case email
- Source: RDAP bootstrap/service through `rdap.org`
- Output: registration data that the registry exposes publicly
- Missing/redacted registrant data remains `null`; the adapter does not invent replacement values

### Google Public DNS DoH

- Input: domain
- Records: A, AAAA, MX, NS, TXT, CAA and `_dmarc` TXT
- Output includes TTL and normalized record values
- SPF and DMARC presence are derived from real TXT answers
- DNS failure is tracked independently from RDAP/CT failure

### Certificate Transparency

- Input: domain
- Source adapter: best-effort `crt.sh` JSON query
- Output: unique certificate names within the domain suffix, capped before storage/display
- CT failure does not discard valid RDAP/DNS evidence

Domain evidence describes the infrastructure of the email domain. It does **not** prove that the email user owns or operates that domain.

## Passive Infrastructure Enrichment

The passive enrichment pipeline runs only on infrastructure already derived from the case: a non-consumer email domain and public A/AAAA addresses returned by the domain-intelligence stage. Private, link-local, documentation, multicast and other reserved IP ranges are removed before IP-based third-party enrichment.

All results in this section are stored as discovery/enrichment records with explicit provenance. They are not added to identity probability or ownership scoring.

### Internet Archive Wayback CDX

- Input: validated case-derived domain
- Endpoint: `https://web.archive.org/cdx/search/cdx`
- Authentication: none
- Mode: passive archive lookup only
- Query budget: at most 3 domains and 12 deduplicated captures per domain
- Positive condition: CDX returns a valid 14-digit capture timestamp and an HTTP(S) original URL
- Stored fields: original URL, capture timestamp, HTTP status, MIME type and digest when returned
- Evidence type: `archived_web_capture`
- Source type: `public_archive_api`
- Default quality: 90
- Caveat: an archive capture establishes that the URL was indexed at a historical time; it does not prove ownership or identity

### IP RDAP

- Input: public A/AAAA addresses observed in live DNS evidence
- Endpoint family: `https://rdap.org/ip/{ip}`
- Authentication: none
- Private/reserved addresses: rejected before lookup
- Query budget: at most 8 unique public IP addresses per case run
- Stored fields: registry handle/name, allocation type, country, start/end address and CIDR blocks when returned
- Evidence type: `public_ip_registration_record`
- Source type: `network_registry_api`
- Default quality: 95
- Caveat: registry allocation does not prove the investigated person controls the IP or network

### urlscan.io Search API

- Input: validated case-derived domain
- Endpoint: `https://urlscan.io/api/v1/search/`
- Authentication: user-supplied API key stored through Electron `safeStorage`
- Mode: existing-scan search only
- The application does **not** call urlscan's submission endpoint and does not automatically create public/unlisted/private scans
- Query budget: at most 3 domains and 12 historical results per domain
- Stored fields: scan ID/time, task/page URL, page domain/IP, country, ASN, server/status, request count and existing provider verdict where available
- Evidence type: `historical_website_scan`
- Source type: `website_scan_index_api`
- Default quality: 88
- Missing/rejected/rate-limited credential: no result is created
- Caveat: metadata describes an existing third-party scan and may be historical

### VirusTotal API v3

- Input: validated case-derived domain
- Endpoint family: `https://www.virustotal.com/api/v3/domains/{domain}`
- Authentication: user-supplied API key stored through Electron `safeStorage` and sent as `x-apikey`
- Mode: read-only domain report lookup
- The application does **not** upload files, submit URLs for analysis, or request a rescan through this adapter
- Query budget: at most 3 domains per case run
- Stored fields: provider reputation, analysis statistics, categories, tags, registrar and provider timestamps/votes when available
- Evidence type: `domain_reputation_report`
- Source type: `threat_intelligence_api`
- Default quality: 90
- Missing/rejected/rate-limited credential: no result is created
- Caveat: threat-intelligence reputation is context about a domain, not evidence about the identity of the email user

### Shodan Host API

- Input: public A/AAAA addresses observed in live DNS evidence after the same reserved-address filtering used by IP RDAP
- Endpoint family: `https://api.shodan.io/shodan/host/{ip}`
- Authentication: user-supplied API key stored through Electron `safeStorage`
- Mode: read-only indexed-host lookup with `minify=true`
- The application does **not** call Shodan scan, alert, monitor, or other active-scan endpoints
- Query budget: at most 8 unique public IP addresses per case run
- Stored fields: organization, ISP, ASN, OS, country/city, coordinates, ports, hostnames/domains, tags and vulnerability identifiers returned by the minified host record
- Raw service banners are intentionally not persisted by this adapter
- Evidence type: `indexed_host_service_record`
- Source type: `internet_device_index_api`
- Default quality: 88
- Missing/rejected/rate-limited credential: no result is created
- Caveat: Shodan represents an existing third-party index snapshot; it does not prove current exposure, ownership or control

## Optional local username engines

### Sherlock

- Availability: executable must be installed and in `PATH`
- Invocation: subprocess with `shell: false`
- Input validation blocks shell metacharacters and unsupported usernames
- Positive lines are parsed only from Sherlock's found-result output
- Existing profile URLs are deduplicated before insert
- Evidence type: `username_engine_claimed_record`
- Default quality: 70
- Manual verification is mandatory

### Maigret

- Availability: executable must be installed and in `PATH`
- Invocation: subprocess with `shell: false`
- Machine output: `--json simple` report written to a temporary directory
- Only entries present in Maigret's simple CLAIMED report are considered
- Extracted `ids_data` may enrich stored public fields
- Temporary output is deleted after parsing
- Existing URLs are deduplicated before insert
- Evidence quality: 65, raised to 72 when structured extracted fields are present
- Manual verification is mandatory because Maigret documents possible false positives

## Local image evidence

### Built-in local analyzer + ExifTool

- Input selection: OS file-picker owned by the Electron main process; renderer code cannot submit arbitrary filesystem paths
- Supported extensions: JPEG, PNG, WebP, GIF, BMP, TIFF, HEIC/HEIF
- Remote URLs are rejected by the analyzer
- Maximum file size: 100 MB
- Always computed locally: SHA-256, filename, extension, size and modified timestamp
- Optional: ExifTool camera/image/capture/GPS fields when `exiftool` is installed
- No automatic third-party image upload
- When attached to a case, the application stores an opaque `urn:sha256:<hash>` reference plus normalized metadata; the original local path and image bytes are not stored in the case database
- Evidence type: `local_image_metadata`
- Source type: `local_file`
- Quality: 100 for deterministic hash/file observation; this quality does not establish creator/owner/subject identity
- Ephemeral analyses outside a case do not create orphan case logs or evidence rows

## Disabled sources

### Reverse face / reverse image search

Disabled until an audited live provider with suitable commercial terms is integrated. The compatibility module returns an unavailable state and no matches.

### Holehe/password-recovery enumeration

Disabled in the evidence pipeline. Password recovery, signup and rate-limit behavior is too ambiguous and volatile to be treated as reliable positive evidence for commercial reports.

### Search-result HTML scraping

Disabled. The legacy query-builder remains only for investigator-assisted query generation. Automated web results come from configured structured provider adapters instead of scraping result pages.

## Provenance requirements for new adapters

Any new adapter that inserts a result must provide enough data to create a `source_evidence` record containing:

- `source_name`
- `source_type`
- `entity_type` / `entity_id`
- `evidence_type`
- `source_url` when available
- `quality_score`
- `observed_at`
- source-specific metadata and caveats

Adapters must fail closed: if a response cannot be confidently interpreted as positive evidence, it must be logged as skipped/inconclusive rather than stored as a finding.
