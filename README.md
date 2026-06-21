# OSINT Tool Complete v4.0

Repository wrapper for an Electron-based Open Source Intelligence desktop application located in the `osint-tool` subdirectory.

## Features

- Desktop OSINT investigation interface
- Social account discovery modules
- Breach and WHOIS collection modules
- Local SQLite-backed data storage
- Relationship visualization with network graph libraries
- Arabic README and additional OSINT guides inside the app folder

## Tech Stack

- Electron
- Node.js
- SQLite via `better-sqlite3`
- Axios
- Cheerio
- vis-network / vis-data

## Screenshots

No root-level screenshots are available yet.

## Project Structure

```text
.
└── osint-tool/
    ├── src/
    │   ├── main/
    │   ├── renderer/
    │   ├── modules/
    │   ├── database/
    │   └── utils/
    ├── package.json
    ├── README.md
    ├── QUICKSTART.md
    └── TESTING_GUIDE.md
```

## Installation

```bash
cd osint-tool
npm install
```

## Development

```bash
cd osint-tool
npm run dev
```

## Run

```bash
cd osint-tool
npm start
```

## Build

No package build script is currently defined.

## Tests

The project includes standalone test files such as `test_modules.js`, `test_advanced_dorks.js`, and `test_face_search.js`. A unified test script is not currently defined in `package.json`.

## Environment Variables

Do not commit API keys or private investigation data. Add placeholder-only environment documentation before integrating external APIs.

## Usage

Open the Electron app and follow the investigation flow documented in `osint-tool/README.md` and the quickstart guides.

## Roadmap / TODO

- Add a root-level screenshot or demo GIF.
- Add a unified test script to `osint-tool/package.json`.
- Document optional API keys using `.env.example`.
- Add packaging/build scripts if desktop installers are required.

## Known Issues

- The runnable app is nested under `osint-tool`; commands must be run from that folder.
- No root-level license file is present, although `osint-tool/LICENSE` exists.
- Some advanced integrations are documented as planned or optional.

## License

MIT, see `osint-tool/LICENSE`.

## Author

Author: iEmmAd / cybrex  
GitHub: https://github.com/imedkablavi
