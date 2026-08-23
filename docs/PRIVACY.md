# Privacy model

OSINT Casebook is local-first, not offline-only. Case records live in Electron's per-user data directory. Enabled collectors send the relevant username, email address, or domain to the public provider named in the UI and logs.

## Data stored locally

- Case name, email, and username supplied by the user.
- Candidate profile URLs and evidence classification.
- HIBP records returned for the configured email query.
- RDAP domain metadata.
- Redacted operational stage logs.

The database is not included in application packages. Repository ignore rules cover common database, log, cache, export, key, and `.env` paths.

The current database is not encrypted by the application. Protect the OS account and enable full-disk encryption. The earlier prototype's adjacent-file encryption key was removed because it did not provide a meaningful security boundary.

## Credentials

`HIBP_API_KEY` is read from the process environment in the Electron main process. It is not sent to the renderer, stored in localStorage, written to SQLite, or included in application logs. `.env.example` contains an empty placeholder only; `.env` files are excluded from source and packages.

## Redaction

Logs mask email local-parts, bearer values, common secret assignments, credential-bearing URLs, and secret-like object fields. Redaction is defense in depth, not permission to log case content. Collectors should log stages and counts, not raw identifiers or response bodies.

## Deletion and retention

Deleting a case removes its related social candidates, breach rows, domains, relations, media, search results, and logs in one SQLite transaction. The application does not delete OS-level backups, filesystem snapshots, or copies made by the user. Establish a retention period appropriate to your authorization and jurisdiction.

## Network disclosure

- Profile candidate checks disclose a username in provider URL paths.
- HIBP receives the email address and API key when configured.
- RDAP receives a custom domain. Common consumer mail domains are skipped.

Provider privacy policies and rate limits apply. Do not use the app for data you are not authorized to process.
