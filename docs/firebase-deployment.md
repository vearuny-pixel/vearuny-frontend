# Firebase preview-only deployment safeguards

Project and Hosting site: `vearuny`. Production channel: `live`.
`firebase.json` explicitly selects site `vearuny` and publish directory `site`.
There are no Hosting target aliases. A Firebase site contains both live and
preview channels; a site or target name never isolates a preview. Isolation
comes from `hosting:channel:deploy` with an explicit non-live channel ID.

## Phase 5G preview — deployed September 10, 2026

Reviewed frontend asset checkpoint: `407f5f0b59fc861660d2837ed370a3e6e7f8c920`.
New channel: `phase5g-acceptance-20260910`. Expiry: seven days from creation.
The owner approved creation and deployment. The guarded workflow released version
`2c841578e7f2799f` to
https://vearuny--phase5g-acceptance-20260910-gsof5not.web.app, expiring September 17
at `13:02:44.966410894Z`. All 31 served files match the reviewed checkpoint; LIVE
version and HTML hash remained unchanged. See
[evidence](../evidence/phase5g-preview-deployment-20260910.json).

The first attempt created the channel but the hook rejected the standalone CLI
argument layout before upload. Process detection was corrected to recognize its
nested CLI script and skip the internal cross-env helper. All 12 offline tests
passed before retrying the same guarded command successfully. No guard bypass
or live deployment was used. Further deployments require their own approval.

Safe local preparation (never invokes Firebase):

```sh
python3 -B scripts/deploy-preview.py phase5g-acceptance-20260910 --prepare
```

Only after the owner approves preview creation:

```sh
python3 -B scripts/deploy-preview.py phase5g-acceptance-20260910
```

The wrapper audits all publish files before invoking exactly:

```sh
firebase hosting:channel:deploy phase5g-acceptance-20260910 --expires 7d --project vearuny --config /opt/vearuny/frontend/firebase.json --no-authorized-domains --non-interactive
```

No `--only` target selector or plain `deploy` is used. The single Hosting config
selects the site. Additional arguments, `live`, channel normalization tricks and
protected `restore-check*` channel names are rejected. The CLI's own channel
command also rejects `live`. `--no-authorized-domains` prevents Firebase Auth
domain synchronization.

## Enforcement and validation

The wrapper runs the pinned publish-tree audit before the CLI, because the CLI
creates or extends a preview channel before running Hosting predeploy hooks.
The hook checks Linux `/proc` ancestry for the actual CLI argument list, rejects
unrecognized invocations, validates project and exact channel command arguments,
and reruns the asset audit before uploads. All `firebase deploy` commands,
including `firebase deploy --only hosting`, are rejected even if the old
`VEARUNY_PRODUCTION_AUTHORIZATION` flag is set. There is no live authorization
branch in this workflow.

The audit requires exactly the tracked `site/` files and their bytes at the
Phase 5G checkpoint, checks the single-site config and hook, rejects symlinks,
hidden files and development/credential material, and computes SHA-256 hashes.
`python3 -B scripts/preview-preflight.py --write` records the new manifest in
`evidence/phase5g-upload-manifest.json`; the Phase 5D manifest remains historical.
This local manifest is not evidence of a Firebase upload.

Run all safeguard tests with:

```sh
python3 -B test/firebase-deploy-guard.test.py
```

Tests cover live commands and old authorization flags, reserved channels,
argument overrides, missing/wrong projects, removal of target aliases, actual
process ancestry through an inert CLI fixture, and wrapper preparation/audit
failure preventing invocation. No real Firebase deployment command is run in tests.

These are repository safeguards, not Firebase IAM restrictions. Another config,
removed hooks, a deliberately impersonated process or direct Hosting clone/REST
writes can bypass them. The predeploy hook alone cannot prevent preview channel
creation before rejection; use the wrapper. No global executable or OS changes
are part of this safeguard.

## Verified restoration and historical records

Live must remain version `9f7f9106ddaeadcf`, with HTML SHA-256
`c08ad72d765027bb308af8fc9158ee7460feda693a8e56c812f526c33716466e`.
Authenticated September 10 inspection confirmed the September 7
`13:18:10.689Z` rollback release, following two intervening live deployments.
See `evidence/approved-live-restoration.json` for the original restoration record.

The preserved `restore-check-20260907` preview has the same historical version
and expires September 14 at `12:06:25.105305236Z`. Phase 5D preview currently has
version `cd273dc7c9cb368c` and expires September 14 at `02:48:58.086979718Z`.
Older Phase 5B/5D preparation notes are historical, not deployment instructions.
Neither the restored live site nor the Phase 5D preview establishes Phase 5G
acceptance. Preview checkout submissions would create real unpaid API orders;
this safeguard task does not submit orders or change payment configuration.

Before approved execution, recheck live version/hash and that the new channel
is absent. After execution, verify the preview and confirm live is unchanged.
