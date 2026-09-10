"""Fail closed before Hosting uploads; inspect the actual Firebase CLI ancestor.

Linux /proc is required. No environment variable can authorize a preview as live.
All live deployment commands are rejected, regardless of environment flags.
"""
import os
from pathlib import Path
import re
import sys
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def preview_arguments(channel):
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', channel) or channel == 'live':
        raise ValueError('Preview channel must be lowercase and must not be live')
    if channel.startswith('restore-check'):
        raise ValueError('The verified historical preview is protected')
    return ['hosting:channel:deploy', channel,
            '--expires', '7d', '--project', 'vearuny', '--config',
            str(ROOT / 'firebase.json'), '--no-authorized-domains', '--non-interactive']


def firebase_arguments():
    pid = os.getppid()
    while pid > 1:
        proc = Path('/proc') / str(pid)
        argv = [x.decode() for x in (proc / 'cmdline').read_bytes().split(b'\0') if x]
        # Match an executable/script argument, never shell command text.
        for i, arg in enumerate(argv[:2]):
            if Path(arg).name in ('firebase', 'firebase.js'):
                return argv[i + 1:]
        status = (proc / 'status').read_text()
        pid = int(re.search(r'^PPid:\s+(\d+)', status, re.M).group(1))
    raise ValueError('Cannot verify the Firebase CLI invocation')


def authorize(args, environment):
    if environment.get('GCLOUD_PROJECT') != 'vearuny':
        raise ValueError('Only project vearuny is allowed')
    if args and args[0] == 'hosting:channel:deploy':
        if len(args) < 2 or args != preview_arguments(args[1]):
            raise ValueError('Use python3 scripts/deploy-preview.py CHANNEL; overrides are forbidden')
        return
    raise ValueError('Live deployment blocked. This repository workflow permits preview channels only.')


if __name__ == '__main__':
    try:
        authorize(firebase_arguments(), os.environ)
    except (ValueError, OSError, AttributeError, UnicodeError) as error:
        sys.exit('DEPLOYMENT REFUSED: ' + str(error))
    subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/preview-preflight.py')],
                   cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    print('Firebase deployment guard passed')
