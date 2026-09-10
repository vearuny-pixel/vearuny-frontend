# Vearuny checkout frontend

Reconstructed bilingual checkout integrated with the public Vearuny commercial API. Phase 5G assets are pinned at
`407f5f0b59fc861660d2837ed370a3e6e7f8c920`; production serves the restored historical version.

- `site/`: maintained checkout, local menu/font/rendering assets, API client.
- `recovered/`: original public assets, preserved byte-for-byte.
- `docs/phase5b-integration.md`: payload, retry semantics, validation evidence,
  remaining acceptance work and exact Firebase preview plan.
- `docs/inspection.md`: historical pre-integration assessment, not current API gaps.
- `evidence/integration-*.json`: public catalog fixtures and disposable smoke results.

With Node 22:

```sh
npm ci
npm run test:syntax
npm test
npm start
```

The server serves only `site/` at http://127.0.0.1:4173 and binds loopback.
Tests run offline with mocked API requests and jsdom; runtime has no new npm
browser dependencies. Reconstructed asset provenance tests remain intact.

Existing Docker runtime alternative:

```sh
docker run --rm -v "$PWD:/work" -w /work node:22-alpine npm ci
docker run --rm --network none -v "$PWD:/work:ro" -w /work node:22-alpine npm run test:syntax
docker run --rm --network none -v "$PWD:/work:ro" -w /work node:22-alpine npm test
docker run --rm --network host -v "$PWD:/work:ro" -w /work node:22-alpine npm start
```

`npm run test:smoke` is separate and opt-in: it requires
`DISPOSABLE_API_TEST=1` and `SMOKE_STATE_DIR` outside the repository, and creates
clearly marked unpaid test records against the live API. Reuse the same state
directory for retries to avoid additional orders. Do not run it casually.

Package prices come from the API; discounts and effective add-on charges are
shown from the created order response. The saved same-tab attempt retains its
payload/key across uncertain responses and reloads. Payment instructions are
shown after order creation; there is no browser payment confirmation or admin
access. Firebase preview/staging deployment remains a separate approval step.

Deployment status and the preview-only workflow: see
[firebase-deployment.md](docs/firebase-deployment.md). Phase 5D deployment notes
and its manifest are historical evidence. Phase 5G channel
`phase5g-acceptance-20260910` was deployed with approval on September 10;
its verified release and expiry are recorded in the deployment document.
All `firebase deploy` commands are blocked by the repository hook.
