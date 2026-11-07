# Explicit production release gate

## Reviewed release and observed baseline

The delivery-only application assets are pinned to frontend `origin/main`
checkpoint `94d08dfed85af29a53b54ee0a49ce4a7ea364184`. Firebase Hosting publishes
the `site/` directory to project/site `vearuny`. The gate refuses changed,
missing, extra, hidden, symlinked, or credential-like publish files.

The Firebase LIVE baseline observed on 2026-11-07 is version
`8626bf2d58a9a6a0`, with HTML SHA-256
`bd27c381b3ef0811c1dc44436edbf3c7a4cd04fb0695ba8014ee175a0873cf54`.
The wrapper rechecks both immediately before upload and refuses if either
changes. Re-read the live baseline before every later release.

## Firebase Hosting release

Run from a fresh clean detached worktree containing this reviewed gate and the
exact merged release commit. Pass the full SHA of that commit; never resolve
`HEAD` dynamically in a release script. After explicit owner approval:

```sh
VEARUNY_ALLOW_PRODUCTION_DEPLOY=YES python3 -B scripts/deploy-production.py \
  --expected-head FULL_REVIEWED_RELEASE_COMMIT \
  --confirm 'DEPLOY VEARUNY PRODUCTION'
```

Append `--dry-run` to run release tests and live checks without deployment.
Both authorization inputs are mandatory even in dry-run. The fixed command
deploys Firebase Hosting only, from `site/`, using the checked-in project config
and hook. No extra Firebase arguments are accepted. Release tests cover syntax,
unit, DOM, integration, reconstruction, and both offline deployment guard
suites. They do not submit orders.

## Nginx frontend release

`order.vearuny.com` redirects to `healthymeal.vearuny.com`; its Traefik route
targets the `vearuny-order-frontend` nginx container. The container's Compose
file uses relative `./site` and `./nginx.conf` mounts. The public redirect
destination's origin mapping has not been independently established. The
release bundle keeps `site/` at Firebase's configured public path and includes
the Nginx/Firebase configuration files. Preserve the existing `frontend`
Compose project name and network.

Extract the immutable release bundle and verify its checksum first. After
explicit owner approval, run:

```sh
ARTIFACT=/root/vearuny-release/artifacts/vearuny-frontend-94d08dfed85af29a53b54ee0a49ce4a7ea364184-release.tar.gz
RELEASE_ROOT=/opt/vearuny/releases/frontend/94d08dfed85af29a53b54ee0a49ce4a7ea364184
sha256sum -c "$ARTIFACT.sha256"
install -d -m 0755 "$RELEASE_ROOT"
tar -xzf "$ARTIFACT" -C "$RELEASE_ROOT"
docker compose -p frontend --project-directory "$RELEASE_ROOT" \
  -f "$RELEASE_ROOT/docker-compose.order.yml" \
  up -d --no-deps --force-recreate order-frontend
```

Compose resolves the relative mounts from `RELEASE_ROOT`, so this serves only
the staged artifact and never the dirty checkout.

## Rollback

Before a future Firebase deployment, preserve the current LIVE release on a
non-live channel:

```sh
firebase hosting:clone vearuny:live vearuny:rollback-delivery-only-YYYYMMDD \
  --project vearuny --config firebase.json
```

If Firebase verification fails, restore it with:

```sh
firebase hosting:clone vearuny:rollback-delivery-only-YYYYMMDD vearuny:live \
  --project vearuny --config firebase.json
```

For nginx, the pre-deployment served files and Nginx configuration are captured
in `/root/vearuny-promotion-20261021/delivery-only-config-20261107T111902Z/vearuny-order-frontend-live-20261107.tar.gz`.
Restore that protected archive under a versioned directory and recreate only
the frontend service:

```sh
ROLLBACK_ROOT=/opt/vearuny/releases/frontend/rollback-20261107
install -d -m 0755 "$ROLLBACK_ROOT"
tar -xzf /root/vearuny-promotion-20261021/delivery-only-config-20261107T111902Z/vearuny-order-frontend-live-20261107.tar.gz \
  -C "$ROLLBACK_ROOT"
docker compose -p frontend --project-directory "$ROLLBACK_ROOT" \
  -f "$ROLLBACK_ROOT/docker-compose.order.yml" \
  up -d --no-deps --force-recreate order-frontend
```

Restore the frontend before any API rollback. The Firebase version and Nginx
origin snapshot are separate artifacts; verify both domains after restoration.

The wrapper requires `VEARUNY_ALLOW_PRODUCTION_DEPLOY=YES`, the exact
confirmation phrase, exact reviewed full HEAD, project `vearuny`, clean status,
passing tests, the pinned asset audit, and the recorded LIVE baseline. It
repeats local and LIVE checks immediately before upload. The hook has no test
bypass. These repository safeguards do not replace Firebase IAM; serialize
releases to prevent concurrent changes after the final check.

Offline gate tests:

```sh
python3 -B test/firebase-deploy-guard.test.py
python3 -B test/production-deploy-guard.test.py
```
