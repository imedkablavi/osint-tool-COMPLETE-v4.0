# QA report

Branch: `release/desktop-casebook-productization`
Date: 2026-08-24

## Automated coverage

- JavaScript syntax and source-policy scan.
- Input and IPC payload validation helpers.
- Secret/email/URL redaction.
- HTTP URL boundary, timeout configuration, and transient retry behavior.
- HIBP disabled and synthetic response lifecycles.
- Synthetic RDAP response parsing.
- SQLite create/log-redact/delete lifecycle.
- Electron unpacked-package structure smoke check.

Automated provider tests use synthetic responses. They intentionally do not depend on GitHub, social networks, HIBP, or RDAP availability.

## Local command results

- `node scripts/check-source.mjs`: passed; 19 JavaScript files parsed and policy-scanned.
- `node --test`: passed; 12 tests, 0 failures.
- `npm audit --audit-level=high`: passed; 0 known vulnerabilities in the resolved dependency graph.
- Local unpacked Electron assembly plus `node scripts/package-smoke.mjs`: passed; executable and non-empty `app.asar` present.
- Native electron-builder installer jobs: delegated to GitHub Actions because the local execution sandbox blocks the builder's network/subprocess approval path. CI status is the source of truth for NSIS/portable/AppImage/deb artifacts.

## Security assertions

- Renderer Node integration disabled; context isolation, sandbox, CSP, and a narrow preload bridge enabled.
- External navigation denied in the web contents; explicit HTTPS links open through the OS browser.
- API keys remain in the main process.
- Random/fabricated breach and WHOIS records removed.
- Provider blocks and rate limits do not become positive evidence.

## Manual qualification still required for a signed release

- Install/uninstall NSIS and launch Windows portable build.
- Launch AppImage and install/remove deb on target distributions.
- Verify OS keychain/signing/notarization policy selected by the maintainer.
- Run one authorized HIBP test with a real key without recording the identifier in screenshots or logs.
- Confirm provider-specific UI behavior against current terms and rate limits.

Command results for this PR are recorded in the pull-request description after the local run completes.
