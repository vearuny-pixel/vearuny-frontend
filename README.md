# Vearuny checkout frontend

Maintained reconstruction of https://vearuny.web.app/, recovered 2026-09-07.
This is the Phase 5B inspection checkpoint; production API integration is not
implemented yet. Production hosting and pricing have not been changed.

- `site/`: editable frontend, local assets, original English/Khmer checkout rules.
- `recovered/`: original public assets; SHA-256 provenance in `evidence/assets.json`.
- `docs/inspection.md`: exact pricing, discrepancies, fulfillment/payment rules,
  API mappings and remaining backend gaps.
- `evidence/phase5b-*.json`: public API catalog snapshots; no customer information.
- `test/`: reconstruction, language and recovered-business-rule checks.

Run `npm test` with Node 22; no dependencies are required. Preview with
`npm start` at http://127.0.0.1:4173. The preview binds only to loopback. Do not
expose `recovered/` as the maintained site: it retains original analytics tags.
The maintained site uses local rendering assets and omits analytics. Maps,
merchant and social/Telegram links remain public navigation links.

Docker alternative without host Node/npm:

```sh
docker run --rm --network none -v "$PWD:/work:ro" -w /work node:22-alpine npm test
```

For a loopback-only preview using Docker on this host:

```sh
docker run --rm --network host -v "$PWD:/work:ro" -w /work node:22-alpine npm start
```

No Firebase deployment configuration, secret, API admin key, automatic payment
confirmation or production deployment command belongs in this repository.
`prepare.py` is a one-time reconstruction utility and refuses to overwrite an
existing maintained site. `recover.py` accepts an explicit JSON list of public
URL/path pairs; do not rerun recovery over edited maintained files.
