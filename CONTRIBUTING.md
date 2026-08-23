# Contributing

OSINT Casebook accepts changes that improve the local investigation workflow without duplicating the educational catalog maintained in [OSINT-Roadmap](https://github.com/imedkablavi/OSINT-Roadmap).

## Before opening a pull request

```bash
npm ci
npm run lint
npm test
npm run build
npm run package:smoke
```

Use synthetic fixtures in automated tests. Do not add live target identifiers, copied investigation output, API keys, or tests that require public providers on every CI run.

## Collector contract

A collector must:

1. Use `src/services/httpClient.js` for HTTPS requests.
2. Set a finite timeout and rely only on bounded idempotent retries.
3. Treat provider blocking, rate limiting, and ambiguous responses as `unknown`.
4. Store a result only when its evidence classification is explicit.
5. Never equate reachability with identity attribution.
6. Log stage/count information without target identifiers or secrets.
7. Include synthetic success, not-found, provider-failure, and redaction tests.

Do not invoke third-party CLIs or shell commands from a collector without a separate design review and an explicit permission boundary.

## Scope ownership

- Learning paths, tool catalogs, multilingual guides, and browser Tool Finder features belong in OSINT-Roadmap.
- Case storage, evidence capture, local privacy controls, packaging, and desktop UX belong here.
- Experimental integrations must not appear as supported features until their schemas and failure modes have tests.

## Pull requests

Describe the user-visible change, privacy impact, provider behavior, tests run, and any manual Windows/Linux checks still required. Keep unrelated cleanup out of the same PR.
