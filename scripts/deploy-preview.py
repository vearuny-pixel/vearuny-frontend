"""Deploy an explicitly named preview channel using fixed Hosting-only options."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('guard', ROOT / 'scripts/firebase-deploy-guard.py')
guard = importlib.util.module_from_spec(spec)
sys.dont_write_bytecode = True
spec.loader.exec_module(guard)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('channel')
parser.add_argument('--prepare', action='store_true', help='Audit files and print command without invoking Firebase')
options = parser.parse_args()
try:
    args = guard.preview_arguments(options.channel)
except ValueError as error:
    sys.exit(str(error))
# Firebase creates/extends channels before predeploy hooks: audit before CLI invocation.
result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/preview-preflight.py')],
                        cwd=ROOT, capture_output=True, text=True)
if result.returncode:
    sys.exit(result.stderr or result.stdout or 'Publish-tree audit failed')
manifest = json.loads(result.stdout)
print(json.dumps({'command': ['firebase', *args], 'publicDirectory': manifest['publicDirectory'],
                  'frontendCheckpoint': manifest['frontendCheckpoint'],
                  'fileCount': manifest['fileCount'], 'totalBytes': manifest['totalBytes'],
                  'previewChannel': options.channel, 'expiry': '7d',
                  'deploymentExecuted': False}, indent=2), flush=True)
if options.prepare:
    sys.exit(0)
environment = dict(os.environ)
environment.pop('VEARUNY_PRODUCTION_AUTHORIZATION', None)
sys.exit(subprocess.call(['firebase', *args], cwd=ROOT, env=environment))
