# Data Source Contracts

This document defines which sources may create evidence records in OSINT Tool v4.1 and how failures are interpreted.

A source adapter must never convert a timeout, rate limit, anti-bot page, generic HTTP 200, or missing credential into a positive finding.

## Evidence score semantics

`quality_score` measures how directly and reliably the source supports the stored observation. It is **not** the probability that two identities are the same person.

| Range | Meaning |
| --- | --- |
| 90–100 | Direct structured record from a primary/official public API or source record |
| 70–89 | Structured result from a specialized external enumeration engine or combined infrastructure sources |
| 50–69 | Public page metadata or other indirect but inspectable evidence |
| 1–49 | Weak URL/page observation that requires substantial manual verification |
| 0 | No positive evidence; should not normally create an entity record |

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

### ExifTool

- Input: explicit local file path only
- Remote URLs are rejected
- Maximum file size: 100 MB
- Always computed locally: SHA-256, filename, extension, size and modified timestamp
- Optional: ExifTool camera/image/capture/GPS fields when `exiftool` is installed
- No automatic third-party image upload

## Disabled sources

### Reverse face / reverse image search

Disabled until an audited live provider with suitable commercial terms is integrated. The compatibility module returns an unavailable state and no matches.

### Holehe/password-recovery enumeration

Disabled in the evidence pipeline. Password recovery, signup and rate-limit behavior is too ambiguous and volatile to be treated as reliable positive evidence for commercial reports.

### Google result-page scraping

Disabled. The legacy module now builds investigator-assisted queries only and does not scrape or persist search-engine HTML results.

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
