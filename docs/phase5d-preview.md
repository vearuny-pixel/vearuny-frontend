# Historical Phase 5D deployment record

This document preserves the original preparation/deployment notes below; their
aliases, commands, checkpoint and initial expiry are not current instructions.
Use [firebase-deployment.md](firebase-deployment.md) for the current workflow.
Authenticated recovery inspection on September 10 found Phase 5D version
`cd273dc7c9cb368c`, released September 7 at `02:49:01.811Z`, expiring September 14
at `02:48:58.086979718Z`. Production was subsequently deployed twice and then
restored to `9f7f9106ddaeadcf` on September 7 at `13:18:10.689Z`.
The earlier statements about unchanged production apply only to that earlier
operation, not the complete release history.

# Phase 5D Firebase preview deployment

The frontend remains byte-identical to integration checkpoint
`ae9fd807897e2ed3a065d511e79f00c5d4fc6774`. The `a9fd807…` checkpoint supplied
in the request appears to be a transcription error; no checkout/reset was done.

## Read-only inspection

The host initially had no Firebase CLI, Node/npm, Firebase login config,
Google application-default credential file, configured token or credential-path
environment variable, local Firebase aliases or Hosting targets. No credentials
were read or printed. Authenticated verification was subsequently completed as
`monioudom3@gmail.com`.

Firebase CLI **15.29.0** was installed only in `/tmp/phase5d-firebase-cli` using
the existing disposable Node 22 Docker runtime. No host/global/OS packages changed.

Read-only CLI results:

- `login:list`: `monioudom3@gmail.com`.
- `projects:list`: accessible project `vearuny`, number `132159274144`.
- `hosting:sites:list --project vearuny`: exactly one site, `vearuny`, URL
  `https://vearuny.web.app`.
- `hosting:channel:list`: exactly one existing channel, `live`; the proposed
  `phase5d-acceptance-20260907` channel does not exist.
- `target hosting --config firebase.json`: `phase5d-preview` resolves to `vearuny`.
- No project/site or Hosting release was created.

The Firebase-reserved public configuration endpoints on **both**
`https://vearuny.web.app/__/firebase/init.json` and
`https://vearuny.firebaseapp.com/__/firebase/init.json` identify project
**`vearuny`**, project number **`132159274144`**. The canonical Hosting domain
identifies site **`vearuny`**. This is public site-to-project evidence, not evidence
of authenticated account permissions; authenticated CLI results now match it.
The public API key was not copied into repository configuration or evidence.

[Firebase documents this endpoint as configuration for the project associated
with the Hosting site](https://firebase.google.com/docs/hosting/reserved-urls).

## Exact prepared target

| Setting | Value |
| --- | --- |
| Firebase project | `vearuny` (public mapping verified; account access pending) |
| Hosting site | `vearuny` |
| Existing production site/channel | `https://vearuny.web.app`, `vearuny:live` |
| Local alias | `phase5d` → `vearuny` |
| Local Hosting target | `phase5d-preview` → site `vearuny` |
| Proposed preview channel | `phase5d-acceptance-20260907` |
| Expiry | `7d` |
| Publish directory | `/opt/vearuny/frontend/site` |
| Proposed file count | 31 |
| Total uncompressed bytes | 4,745,939 |

`firebase.json` and `.firebaserc` were prepared only in this frontend repository.
There is deliberately no default project alias. The alias name is local metadata;
it does not denote or create a separate staging Firebase project/site. The proposal
is a temporary preview channel on the verified existing site's project.

The Firebase CLI also resolved the local `phase5d-preview` target to `vearuny`
in an offline read-only check.

The configuration contains only static Hosting, with no functions, rewrites,
pre/post-deployment hooks, rules, databases or infrastructure definitions. It
sets `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` for the preview.
Firebase config files are sent as deployment configuration, not hosted as files.

## Pre-deployment inspection

`python3 scripts/preview-preflight.py --write` checks exact checkpoint file paths
and contents, rejects symlinks, hidden entries, development/archive/credential
filenames and recognizable credential contents, and emits a SHA-256 manifest.
The repository root, `recovered/`, tests, evidence, Git metadata, backups, `.env`,
credentials and development tooling are outside `public: site` and are not uploaded.

The installed Firebase CLI's actual `lib/listFiles.js` function was executed in
an offline container using this configuration's ignore patterns. Its exact list
matches all 31 entries in `evidence/phase5d-upload-manifest.json`. The function is
the same discovery function called by Firebase Hosting's uploader. **No deploy
or nominal dry-run deployment command was used.**

The existing syntax checks (12 JavaScript files) and all 43 offline frontend tests passed again during preparation.
No additional disposable API orders are required or created during this phase.

Exact proposed hosted files (relative to `site/`):

```text
assets/LOGO+BG.png
assets/menus/A.jpg
assets/menus/B.jpg
assets/menus/C.jpg
assets/menus/D.jpg
assets/menus/E.jpg
assets/menus/F.jpg
assets/menus/a.jpg
assets/menus/b.jpg
assets/menus/c.jpg
assets/menus/d.jpg
assets/menus/e.jpg
assets/menus/f.jpg
graylogo.png
index.html
js/api.js
js/checkout.js
js/nutrition-fallback.js
lang-en.js
lang-kh.js
manifest.json
nutrition.js
style.css
vendor/fonts.css
vendor/fonts/ijw3s5roRME5LLRxjsRb-gssOenAyendxrgV2c-Zw-9vbVUti_Z_dWgtWYtTB5z4.ttf
vendor/fonts/ijw3s5roRME5LLRxjsRb-gssOenAyendxrgV2c-Zw-9vbVUti_Z_dWgtWYuNAJz4.ttf
vendor/html2canvas.min.js
vendor/jspdf.umd.min.js
vendor/qrcode.min.js
vendor/tailwind.js
vendor/telegram-web-app.js
```

Full sizes and SHA-256 hashes are in `evidence/phase5d-upload-manifest.json`;
inspection evidence is in `evidence/phase5d-firebase-inspection.json`.

## Approval boundary

Authenticated read-only verification is complete. Do not send tokens or
credential files in chat or put them in this repository.

To authenticate the prepared isolated CLI on this host, an authorized operator
can run the following in a trusted interactive terminal (not executed by this task):

```sh
mkdir -p /tmp/phase5d-firebase-auth
chmod 700 /tmp/phase5d-firebase-auth
docker run --rm -it -v /tmp/phase5d-firebase-cli:/tool:ro -v /tmp/phase5d-firebase-auth:/auth -e XDG_CONFIG_HOME=/auth -w /tmp node:22-alpine node /tool/node_modules/firebase-tools/lib/bin/firebase.js login --no-localhost
```

The login is kept outside the repository. Subsequent inspection commands must
mount that same `/auth` directory and set `XDG_CONFIG_HOME=/auth`; otherwise a
new disposable container will correctly report no authorized accounts.

For an independent recheck, perform only read-only verification:

```sh
firebase login:list
firebase projects:list --json --non-interactive
firebase hosting:sites:list --project vearuny --json --non-interactive
firebase hosting:channel:list --site vearuny --project vearuny --json --non-interactive
firebase target hosting --project vearuny --json --non-interactive
python3 scripts/preview-preflight.py
```

Confirm the account can access project `vearuny`/site `vearuny`, confirm the live
channel is the existing production channel, and verify the proposed channel is
new or an explicitly approved existing acceptance preview. If the mapping differs,
or access is absent, stop; do not guess another ID or create any project/site.

The verified target and exact manifest were approved for deployment.

The original committed Phase 5D record lists this historical command (do not
reuse it with the current configuration):

```sh
firebase hosting:channel:deploy phase5d-acceptance-20260907 --only phase5d-preview --expires 7d --project vearuny --config firebase.json --no-authorized-domains --non-interactive
```

The pinned CLI supports `--no-authorized-domains`; it prevents the preview command
from synchronizing the preview domain into Firebase Authentication configuration.
The CLI's preview command rejects channel `live`. Do not substitute `firebase
deploy`, clone/promote to live, or change production Hosting content/configuration.
The command completed successfully. It uploaded 31 files, finalized a version,
and released it to the preview channel. No live-channel deploy, promotion or
clone was run.

The returned HTTPS URL is
`https://vearuny--phase5d-acceptance-20260907-vq7w50sd.web.app` and expires
`2026-09-14T01:40:20.566897610Z` (seven days). It returned HTTP 200; sampled
HTML, API client, scripts, styles, translations, menu images, manifest and QR
assets fetched successfully. The preview origin read the public plans endpoint
(`OK`, three plans). Production HTML hashes before and after deployment are
identical (`c08ad72d765027bb308af8fc9158ee7460feda693a8e56c812f526c33716466e`).
Firebase confirms `live` remains at `https://vearuny.web.app`; no promotion or
clone occurred. Continue mobile/browser acceptance with disposable data only.
The preview
will still use `https://api.vearuny.com`; any checkout creates an actual unpaid
API order. No payment activation, backend pricing change, DNS change, Firebase
production release, public port 4173 exposure or unrelated infrastructure action
is part of this work.

[Firebase preview-channel workflow](https://firebase.google.com/docs/hosting/test-preview-deploy)
and [CLI authentication/reference](https://firebase.google.com/docs/cli).
