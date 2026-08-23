# Release and versioning

The project uses Semantic Versioning. The `package.json` version is the release source of truth and must match the Git tag (`v1.2.3`). User-visible changes belong in `CHANGELOG.md`.

## Qualification

1. Run `npm ci`, `npm run lint`, and `npm test` on Linux and Windows.
2. Produce native packages with `npm run package:linux` and `npm run package:win` on their matching operating systems.
3. Run `npm run package:smoke` after each build.
4. Launch the installed package manually, create a synthetic case, verify provider-skip/failure states, delete it, and confirm no case data appears beside the installation.
5. Generate SHA-256 checksums and sign release artifacts using the maintainer's platform signing identities.
6. Publish release notes that list verified platforms and any remaining manual checks.

CI artifacts are unsigned qualification outputs. Do not describe them as trusted production installers until the signing and manual-install checklist is complete.

## Channels

- Patch releases: backwards-compatible fixes and provider resilience updates.
- Minor releases: new tested collectors or substantial desktop workflow changes.
- Major releases: incompatible database, preload API, or privacy-model changes.

Provider-only changes still require a release when they affect evidence interpretation.
