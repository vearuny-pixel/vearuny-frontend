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

Build a new immutable bundle from the reviewed gate checkout for each release;
do not reuse an earlier bundle. Transfer the archive and its checksum together
to the host that runs the staging commands below:

```sh
set -e
GATE_ROOT=/root/vearuny-release/worktrees/frontend-gate
ARTIFACT=/root/vearuny-release/artifacts/vearuny-frontend-94d08dfed85af29a53b54ee0a49ce4a7ea364184-release.tar.gz
ARTIFACT_MANIFEST=/root/vearuny-release/artifacts/vearuny-frontend-94d08dfed85af29a53b54ee0a49ce4a7ea364184-manifest.json
python3 -B "$GATE_ROOT/scripts/preview-preflight.py" > "$ARTIFACT_MANIFEST"
tar -czf "$ARTIFACT" -C "$GATE_ROOT" site firebase.json .firebaserc docker-compose.order.yml nginx.conf
sha256sum "$ARTIFACT" > "$ARTIFACT.sha256"
```

Use the staging helper from the exact reviewed gate checkout. Select a unique
`STAGE_ID` for each attempt. The helper refuses an existing temporary or final
directory, creates and verifies a new empty temporary directory beside the
final directory, rejects unsafe or unexpected archive entries, checks every
published site file against the reviewed manifest, and atomically renames the
audited directory into its new versioned path. A failed extraction or audit
cleans up staging without changing the active container. After explicit owner
approval, run:

```sh
set -e
ARTIFACT=/root/vearuny-release/artifacts/vearuny-frontend-94d08dfed85af29a53b54ee0a49ce4a7ea364184-release.tar.gz
GATE_ROOT=/root/vearuny-release/worktrees/frontend-gate
RELEASE_PARENT=/opt/vearuny/releases/frontend
RELEASE_ID=94d08dfed85af29a53b54ee0a49ce4a7ea364184
RELEASE_ROOT="$RELEASE_PARENT/$RELEASE_ID"
STAGE_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
TEMP_ROOT="$RELEASE_PARENT/.stage-$RELEASE_ID-$STAGE_ID"
ARTIFACT_MANIFEST=/root/vearuny-release/artifacts/vearuny-frontend-94d08dfed85af29a53b54ee0a49ce4a7ea364184-manifest.json
sha256sum -c "$ARTIFACT.sha256"
python3 -B "$GATE_ROOT/scripts/stage-nginx-release.py" \
  --archive "$ARTIFACT" \
  --temporary "$TEMP_ROOT" \
  --destination "$RELEASE_ROOT" \
  --manifest "$ARTIFACT_MANIFEST"
docker compose -p frontend --project-directory "$RELEASE_ROOT" \
  -f "$RELEASE_ROOT/docker-compose.order.yml" \
  up -d --no-deps --force-recreate order-frontend
```

Compose resolves the relative mounts from `RELEASE_ROOT`, so this serves only
the staged artifact and never the dirty checkout. If either path already
exists, stop and choose a new unique staging ID or release version; never
clear or reuse a release directory.

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
Use the same staging helper and fresh-directory procedure for rollback. It
audits the archive structure and symlink-free tree, refuses an existing
temporary or final destination, and atomically publishes only after successful
extraction. Recreate the frontend service only after staging succeeds:

```sh
set -e
GATE_ROOT=/root/vearuny-release/worktrees/frontend-gate
RELEASE_PARENT=/opt/vearuny/releases/frontend
ROLLBACK_ID=rollback-20261107
ROLLBACK_ROOT="$RELEASE_PARENT/$ROLLBACK_ID"
STAGE_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
TEMP_ROOT="$RELEASE_PARENT/.stage-$ROLLBACK_ID-$STAGE_ID"
python3 -B "$GATE_ROOT/scripts/stage-nginx-release.py" \
  --archive /root/vearuny-promotion-20261021/delivery-only-config-20261107T111902Z/vearuny-order-frontend-live-20261107.tar.gz \
  --temporary "$TEMP_ROOT" \
  --destination "$ROLLBACK_ROOT"
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
python3 -B test/nginx-release.test.py
```
