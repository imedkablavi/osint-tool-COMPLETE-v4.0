# Security policy

## Supported versions

Security fixes are applied to the latest released minor version and the default branch.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow for this repository. Do not open a public issue containing an exploit, API key, real investigation data, or a database sample.

Include the affected version, platform, impact, minimal reproduction using synthetic data, and any proposed mitigation. Remove target identifiers and secrets from logs before attaching them.

## Security boundaries

- The renderer has no direct Node.js access and may call only the APIs exposed by `preload.js`.
- The local OS user and the Electron user-data directory are the storage trust boundary.
- API credentials are supplied by the process environment and are never returned to the renderer or written to the case database.
- Collector URLs are application-defined, subject to protocol/credential/private-literal checks, and use bounded requests.
- A profile candidate is not identity proof. Provider responses can be incomplete, blocked, stale, or misleading.

## Out of scope

Reports based solely on running the application as an already-compromised local OS user, provider availability, or the absence of code signing on development artifacts are not treated as application vulnerabilities. Release signing remains a documented maintainer step.
