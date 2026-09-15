"""Explicit production release gate. Dry-run performs every check but never deploys."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
# Reviewed release checkpoint and verified LIVE baseline.
# Superseded values, retained for rollback and audit:
#   CHECKPOINT   4d9a5baebdc484eb5b34d5a1e8f21abc559a5310
#   LIVE_VERSION 9f7f9106ddaeadcf
#   LIVE_HASH    c08ad72d765027bb308af8fc9158ee7460feda693a8e56c812f526c33716466e
# The previous LIVE pins were stale: they did not describe the release that
# was actually serving. Re-baselined to the live release confirmed by the
# site owner on 2026-09-15 (released 2026-09-11T12:01:58Z), whose content is
# byte-identical to the reviewed local/checkpoint site.
CHECKPOINT = 'c5c96725c4325456ddb85da814131f7298a58096'
LIVE_VERSION = 'b58dfe1e7e08873b'
LIVE_HASH = 'bd27c381b3ef0811c1dc44436edbf3c7a4cd04fb0695ba8014ee175a0873cf54'
PHRASE = 'DEPLOY VEARUNY PRODUCTION'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def command():
    return ['firebase', 'deploy', '--only', 'hosting', '--project', 'vearuny',
            '--config', str(ROOT / 'firebase.json'), '--non-interactive']


def authorization(environment, confirmation):
    require(environment.get('VEARUNY_ALLOW_PRODUCTION_DEPLOY') == 'YES', 'Missing production authorization')
    require(confirmation == PHRASE, 'Exact production confirmation required')


def run(args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def local_state(expected_head):
    require(bool(re.fullmatch('[0-9a-f]{40}', expected_head)), 'Expected HEAD must be a full commit hash')
    head = run(['git', 'rev-parse', 'HEAD'])
    require(head == expected_head, 'HEAD does not match expected release commit')
    status = run(['git', 'status', '--porcelain=v1', '--untracked-files=all'])
    require(status in ('', '?? firepit-log.txt'), 'Dirty worktree')
    config = json.loads((ROOT / 'firebase.json').read_text())
    require(json.loads((ROOT / '.firebaserc').read_text()) == {'projects': {'default': 'vearuny'}}, 'Wrong project')
    require(config.get('hosting', {}).get('site') == 'vearuny', 'Wrong Hosting site')
    manifest = json.loads(run([sys.executable, '-B', 'scripts/preview-preflight.py']))
    require(manifest['frontendCheckpoint'] == CHECKPOINT, 'Wrong asset checkpoint')
    return head


def live_state():
    # CLI performs credential refresh; this command only reads channel metadata.
    # A standalone CLI hook inherits pkg's Node-mode flags. Start a fresh CLI
    # runtime without changing authentication, PATH, HOME, or project settings.
    environment = os.environ.copy()
    for name in ('PKG_EXECPATH', 'PKG_INVOKE_NODEJS'):
        environment.pop(name, None)
    with tempfile.TemporaryDirectory(prefix='vearuny-live-read-') as directory:
        data = json.loads(subprocess.check_output(
            ['firebase', 'hosting:channel:list', '--project', 'vearuny',
             '--config', str(ROOT / 'firebase.json'), '--json'], cwd=directory,
            text=True, env=environment))
    require(data.get('status') == 'success', 'Cannot inspect LIVE')
    channels = data['result']['channels']
    live = [c for c in channels if c['name'] == 'projects/vearuny/sites/vearuny/channels/live']
    require(len(live) == 1, 'Cannot identify LIVE channel')
    version = live[0]['release']['version']['name'].rsplit('/', 1)[-1]
    with urllib.request.urlopen('https://vearuny.web.app/', timeout=30) as response:
        require(response.status == 200 and response.url == 'https://vearuny.web.app/', 'Unexpected LIVE HTTP response')
        digest = hashlib.sha256(response.read()).hexdigest()
    require(version == LIVE_VERSION, 'LIVE version mismatch')
    require(digest == LIVE_HASH, 'LIVE HTML hash mismatch')
    return version, digest


def release_tests():
    if shutil.which('node'):
        run(['node', 'scripts/syntax.js'])
        tests = sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'test').glob('*.test.js'))
        run(['node', '--test', *tests])
    else:
        # Existing local image only; no pull, network, writable mount, or API exec.
        run(['docker', 'run', '--rm', '--pull=never', '--network', 'none', '--read-only',
             '-v', str(ROOT) + ':/work:ro', '-w', '/work', '--entrypoint', 'sh', 'api-api',
             '-c', 'node scripts/syntax.js && node --test test/*.test.js'])
    run([sys.executable, '-B', 'test/firebase-deploy-guard.test.py'])
    run([sys.executable, '-B', 'test/production-deploy-guard.test.py'])


def hook_check(args, environment):
    authorization(environment, environment.get('VEARUNY_PRODUCTION_CONFIRMATION'))
    require(args == command()[1:], 'Only the fixed production Hosting command is allowed')
    require(environment.get('GCLOUD_PROJECT') == 'vearuny', 'Wrong project')
    local_state(environment.get('VEARUNY_PRODUCTION_EXPECTED_HEAD', ''))
    # Tests invoke this guard; only the wrapper may run the release test suite.
    # Recheck local and LIVE state before upload without recursing into tests.
    live_state()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--confirm', required=True)
    parser.add_argument('--dry-run', action='store_true')
    options = parser.parse_args(argv)
    authorization(os.environ, options.confirm)
    head = local_state(options.expected_head)
    release_tests()
    version, digest = live_state()
    local_state(options.expected_head)
    print(json.dumps({'HEAD': head, 'appAssetCheckpoint': CHECKPOINT,
                      'liveVersion': version, 'liveHtmlSha256': digest,
                      'rollbackVersion': LIVE_VERSION, 'command': shlex.join(command()),
                      'dryRun': options.dry_run}, indent=2), flush=True)
    if options.dry_run:
        return 0
    environment = dict(os.environ, VEARUNY_PRODUCTION_CONFIRMATION=options.confirm,
                       VEARUNY_PRODUCTION_EXPECTED_HEAD=options.expected_head)
    return subprocess.call(command(), cwd=ROOT, env=environment)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError, KeyError) as error:
        sys.exit('PRODUCTION DEPLOYMENT REFUSED: ' + str(error))
