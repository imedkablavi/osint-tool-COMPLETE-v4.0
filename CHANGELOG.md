# Changelog

This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Repositioned the project as OSINT Casebook, a local desktop companion to OSINT-Roadmap.
- Moved the runnable application to the repository root.
- Replaced unisolated Electron renderer access with a sandboxed preload allowlist and CSP.
- Centralized provider requests behind bounded timeout/retry/error handling.
- Reclassified reachable social URLs as manual-review candidates rather than verified accounts.
- Updated Electron to 43.4.1 to remove the vulnerable archive-extraction dependency reported against the earlier runtime.
- Replaced simulated WHOIS data with real RDAP response parsing.
- Made HIBP explicitly optional and removed simulated breach results.
- Removed unvalidated shell-based, face-search, image-analysis, dorking, proxy, and export modules from the packaged surface.

### Added

- Unified `npm test`, source checks, synthetic collector tests, database lifecycle tests, and package smoke checks.
- Windows/Linux electron-builder targets and CI packaging jobs.
- Privacy, security, architecture/overlap, release, and QA documentation.
- Placeholder-only `.env.example` and investigation-data ignore rules.

## [1.0.0] - 2026-08-22

- Initial imported Electron prototype.
