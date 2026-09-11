# Explicit production release gate

The accepted application checkpoint is `4d9a5baebdc484eb5b34d5a1e8f21abc559a5310`.
The release commit additionally contains deployment tooling. Supply its reviewed
full commit ID as `--expected-head`; do not substitute a dynamically resolved HEAD.

After explicit owner approval, from `/opt/vearuny/frontend`:

```sh
VEARUNY_ALLOW_PRODUCTION_DEPLOY=YES python3 -B scripts/deploy-production.py --expected-head FULL_REVIEWED_RELEASE_COMMIT --confirm 'DEPLOY VEARUNY PRODUCTION'
```

Add `--dry-run` to run every check and print the exact Firebase command without
executing deployment. Both authorization inputs are mandatory even in dry-run.
No deployment was authorized or performed during implementation of this path.

The wrapper requires a clean worktree (only untracked `firepit-log.txt` is
allowed), the supplied exact HEAD, the pinned application asset audit, exact
project/site configuration, passing syntax/frontend/both guard suites, and LIVE
version `9f7f9106ddaeadcf` with HTML SHA-256
`c08ad72d765027bb308af8fc9158ee7460feda693a8e56c812f526c33716466e`.
It prints HEAD, application checkpoint, LIVE version/hash, rollback ID and command.
The fixed command deploys Hosting only, using the checked-in config and hook.
No extra Firebase arguments are accepted. If host Node is absent, tests use the
existing `api-api` image in a disposable read-only container, without network,
image pulls, or access to the API container. Docker access is then required.

The hook retains every preview argument restriction and asset audit. Production
requires `VEARUNY_ALLOW_PRODUCTION_DEPLOY=YES`, the exact phrase passed internally
as `VEARUNY_PRODUCTION_CONFIRMATION`, the expected full HEAD passed internally as
`VEARUNY_PRODUCTION_EXPECTED_HEAD`, and the exact production command. It repeats
local checks, release tests and LIVE checks immediately before upload. Neither
the old authorization variable nor the new flag alone permits production.
There is no test-mode bypass in the hook; offline tests mock external operations.

Rollback version: `9f7f9106ddaeadcf`. Preserve this version. A rollback is a separate
LIVE mutation requiring owner approval; this wrapper intentionally rejects a
changed LIVE state, including after a successful deployment. Future releases
require a reviewed update to the pinned baseline and application checkpoint.

These are repository safeguards, not IAM restrictions. As with the preview
workflow, edits to the tooling or direct remote writes can bypass local hooks.
Concurrent remote changes after the final read cannot be prevented by a local
check; serialize release operations. No application or infrastructure settings
are changed by this preparation.

Offline tests:

```sh
python3 -B test/firebase-deploy-guard.test.py
python3 -B test/production-deploy-guard.test.py
```
