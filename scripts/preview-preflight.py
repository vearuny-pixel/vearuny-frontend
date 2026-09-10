"""Local publish-tree audit only; never authenticates, uploads, or deploys."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = '4d9a5baebdc484eb5b34d5a1e8f21abc559a5310'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true')
options = parser.parse_args()

def require(condition, message):
    if not condition:
        raise SystemExit(message)

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

config = json.loads((ROOT / 'firebase.json').read_text())
rc = json.loads((ROOT / '.firebaserc').read_text())
require(set(config) == {'hosting'}, 'Only static Hosting is allowed')
require(set(config['hosting']) == {'headers', 'ignore', 'public', 'site', 'predeploy'}, 'Unexpected Hosting options/hooks')
require(config['hosting']['public'] == 'site', 'Publish source must be site/')
require(config['hosting']['site'] == 'vearuny', 'Unexpected Hosting site')
require(rc == {'projects': {'default': 'vearuny'}}, 'Unexpected alias/target mapping')
require(config['hosting']['predeploy'] == ['python3 -B scripts/firebase-deploy-guard.py'], 'Deployment guard must remain enabled')
tracked = sorted(git('ls-tree', '-r', '--name-only', CHECKPOINT, '--', 'site').decode().splitlines())
paths = []

def walk(directory):
    require(not directory.is_symlink(), f'Symlink publish directory: {directory}')
    for item in sorted(directory.iterdir()):
        require(not item.is_symlink(), f'Symlink is not publishable: {item}')
        require(not item.name.startswith('.'), f'Hidden publish entry: {item}')
        if item.is_dir():
            walk(item)
        else:
            require(item.is_file(), f'Non-file publish entry: {item}')
            paths.append(item.relative_to(ROOT).as_posix())

walk(ROOT / 'site')
require(sorted(paths) == tracked, 'Publish files differ from the reviewed checkpoint; re-review is required')
forbidden = re.compile(r'(?:^|/)(?:node_modules|tests?|backups?|docs|evidence|scripts|recovered)(?:/|$)|\.(?:env|pem|key|p12|pfx|log|bak|sql|zip|tar|gz|map)$|service.account|firebase.adminsdk', re.I)
secret_patterns = [rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', rb'"type"\s*:\s*"service_account"', rb'ADMIN_API_KEYS\s*[=:]', rb'FIREBASE_TOKEN\s*[=:]']
files = []
for name in sorted(paths):
    require(not forbidden.search(name), f'Forbidden development/credential file: {name}')
    data = (ROOT / name).read_bytes()
    require(data == git('show', f'{CHECKPOINT}:{name}'), f'Changed frontend asset requires review: {name}')
    if Path(name).suffix in ['.html', '.js', '.json', '.css']:
        for pattern in secret_patterns:
            require(not re.search(pattern, data), f'Credential-like material in {name}')
    files.append({'path': name[5:], 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
report = {
    'frontendCheckpoint': CHECKPOINT, 'projectId': 'vearuny', 'hostingSiteId': 'vearuny',
    'productionChannel': 'live', 'productionUrl': 'https://vearuny.web.app',
    'alias': 'default',
    'previewChannel': 'phase5g-acceptance-20260910', 'expiry': '7d', 'publicDirectory': 'site',
    'deploymentExecuted': False, 'authenticatedAccessVerified': False,
    'fileCount': len(files), 'totalBytes': sum(f['bytes'] for f in files), 'files': files,
}
text = json.dumps(report, indent=2) + '\n'
if options.write:
    (ROOT / 'evidence/phase5g-upload-manifest.json').write_text(text)
print(text, end='')
